import { getNimiLocalAppClient } from '../shell/auth/local-app-client.js';
import { createNimiLocalAppRuntimeScenarioJobClient } from '@nimiplatform/sdk/app';
import { runNimiRuntimeScenarioJob } from '@nimiplatform/sdk/runtime';
import { ExecutionMode, ScenarioType, VisionLocateGeometry } from '@nimiplatform/sdk/runtime/generated';
import { runRuntimeSpeechSynthesize } from '@nimiplatform/kit/features/generation/runtime';
import { casePrompt, dialoguePrompt, overlap, parseMystery, propsFromLocate, type Character, type MoodId, type Prop, type Session } from './game.js';
import type { JsonValue } from '@nimiplatform/sdk/types';

export const getClient = getNimiLocalAppClient;
export type Photo = { url: string; blob: Blob; name: string; width: number; height: number; source: 'sample' | 'upload' };
export type Stage = 'locating' | 'writing';
const inventories = new WeakMap<Blob, Prop[]>();

export async function photoFromFile(file: Blob, name: string): Promise<Photo> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 照片。');
  if (file.size > 32 * 1024 * 1024) throw new Error('这张照片超过 32 MB，请换一张小一点的照片。');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { throw new Error('照片没有成功打开，请换一张完整的 JPG、PNG 或 WebP 图片。'); }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('照片处理失败，请换一张重试。')), 'image/jpeg', 0.9));
  return { url: URL.createObjectURL(blob), blob, name, width: canvas.width, height: canvas.height, source: 'upload' };
}

export async function samplePhoto(): Promise<Photo> {
  const response = await fetch(new URL('breakfast-scene.png', document.baseURI));
  if (!response.ok) throw new Error('开箱场景没有加载成功，请重新打开 App，或上传自己的照片。');
  return { ...await photoFromFile(await response.blob(), '早餐之后'), source: 'sample' };
}

async function textTurn(prompt: string, signal: AbortSignal, maxTokens: number, onDelta?: (text: string) => void): Promise<string> {
  signal.throwIfAborted();
  const stream = await getClient().ai.text.streamTurn({ messages: [{ role: 'user', text: prompt }], temperature: 0.8, maxTokens });
  let text = ''; let complete = false;
  const cancel = () => { void stream.cancel().catch(() => undefined); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    signal.throwIfAborted();
    for await (const event of stream) {
      signal.throwIfAborted();
      if (event.type === 'failed') throw new Error(`故事暂时无法继续（${event.reasonCode}）。请检查 Nimi 的文字生成能力后重试。`);
      if (event.type === 'delta') { text += event.text; onDelta?.(text); }
      if (event.type === 'completed') {
        if (event.finishReason !== 'stop') throw new Error('这段故事没有写完，请再试一次。');
        complete = true;
      }
    }
    if (!complete || !text.trim()) throw new Error('没有收到完整的故事，请重试。');
    return text;
  } finally { signal.removeEventListener('abort', cancel); await stream.cancel().catch(() => undefined); }
}

// @nimi-authority: rule.nimi.sdks.feature-clients.r102
export async function openCase(photo: Photo, mood: MoodId, signal: AbortSignal, onStage: (stage: Stage) => void, onFound?: (props: Prop[]) => void): Promise<Session> {
  signal.throwIfAborted();
  onStage('locating');
  let props = inventories.get(photo.blob);
  if (!props) {
    const upload = await getClient().ai.artifacts.upload({ bytes: new Uint8Array(await photo.blob.arrayBuffer()), mimeType: 'image/jpeg' });
    signal.throwIfAborted();
  // A locate label may echo the query. Query one object category at a time;
  // a match supplies its real geometry, while its identity comes from that exact query.
  const subjects = [
    ['a cup or mug', '杯子'], ['a book', '书本'], ['a lamp', '灯'], ['a potted plant', '盆栽'],
    ['a clock', '时钟'], ['a whole fruit', '水果'], ['headphones', '耳机'], ['a key', '钥匙'],
    ['a bottle', '瓶子'], ['a toy', '玩具'], ['a bag', '包'], ['a phone', '手机'],
    ['a pair of shoes', '鞋子'], ['a chair', '椅子'], ['a computer keyboard', '键盘'], ['a pen', '笔'],
    ['a bowl or plate', '餐盘'], ['a picture frame', '相框'], ['a cushion', '抱枕'], ['a bicycle', '自行车'],
  ];
  props = [];
  for (const [query, label] of subjects) {
    signal.throwIfAborted();
    const located = await runNimiRuntimeScenarioJob({
    ai: createNimiLocalAppRuntimeScenarioJobClient(getClient().ai),
    request: {
      head: { appId: 'nimi.odd-bureau', subjectUserId: '', timeoutMs: 180000 }, scenarioType: ScenarioType.VISION_LOCATE, executionMode: ExecutionMode.ASYNC_JOB,
      spec: { spec: { oneofKind: 'visionLocate', visionLocate: {
        imageArtifactId: upload.artifactId,
        query,
        geometry: VisionLocateGeometry.BOX,
      } } },
      requestId: '', idempotencyKey: '', labels: {}, extensions: [],
    }, signal, abortReason: 'player-canceled-case',
  });
  signal.throwIfAborted();
  if (!located.visionLocate) throw new Error('没有收到照片里的物品位置，请重新开案。');
  const result = located.visionLocate;
  const matches = propsFromLocate({ imageArtifactId: result.imageArtifactId, width: result.width, height: result.height,
    locations: result.locations.map(location => {
      if (location.geometry.oneofKind !== 'box') throw new Error('照片定位没有返回物品边界，请重新开案。');
      return { type: 'box', ...location.geometry.box, label };
    }),
  }, 0);
  for (const match of matches) {
    if (props.some(prop => overlap(prop.box, match.box) > 0.6)) continue;
    props.push({ ...match, id: `object-${props.length + 1}` });
    if (props.length === 6) break;
  }
  onFound?.([...props]);
  if (props.length === 6) break;
  }
  if (props.length < 3) throw new Error('这张照片里还没找到至少三件可以登场的物品。试试杯子、书、台灯、玩具等物品分开摆放的照片。');
  inventories.set(photo.blob, props);
  }
  onFound?.([...props]);
  onStage('writing');
  const mystery = parseMystery(await textTurn(casePrompt(props, mood), signal, 3500), props);
  signal.throwIfAborted();
  return { id: crypto.randomUUID(), createdAt: new Date().toISOString(), photoPath: '', photoName: photo.name, photoSource: photo.source,
    props, mood, mystery, discovered: [], evidence: [], messages: {}, accusation: null };
}

export function interrogate(session: Session, character: Character, question: string, signal: AbortSignal, onDelta: (text: string) => void): Promise<string> {
  return textTurn(dialoguePrompt(session, character, question), signal, 400, onDelta);
}

export async function speak(text: string, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted();
  const catalog = await getClient().aiConfig.listOptions({ kind: 'preset-voices' });
  const voice = catalog.kind === 'preset-voices' ? catalog.options.find(option => option.supportedLangs.length === 0 || option.supportedLangs.includes('zh')) : undefined;
  if (!voice) throw new Error('当前语音能力没有提供可用的中文声音。请在能力设置中选择支持中文的语音模型。');
  signal.throwIfAborted();
  const result = await runRuntimeSpeechSynthesize({
    runtime: { ai: createNimiLocalAppRuntimeScenarioJobClient(getClient().ai) }, appId: 'nimi.odd-bureau',
    text, language: 'zh', audioFormat: 'wav', voiceRef: { kind: 'preset_voice_id', presetVoiceId: voice.voiceId }, scenarioId: crypto.randomUUID(), surfaceId: 'odd-bureau-witness',
    signal, abortReason: 'player-stopped-voice',
  });
  signal.throwIfAborted();
  if (!result.ok) throw new Error('这个角色暂时发不出声音。可继续阅读证词；在 Nimi 配置语音合成后再试。', { cause: result.error });
  const artifact = result.output.firstArtifact;
  if (!artifact?.artifactId) throw new Error('没有收到角色的声音文件，请重试。');
  const audio = await getClient().ai.artifacts.read(artifact.artifactId);
  signal.throwIfAborted();
  return URL.createObjectURL(new Blob([new Uint8Array(audio.bytes)], { type: audio.mimeType }));
}

// App-owned game progress is stored through Nimi's admitted App storage, not browser storage.
export async function savePhoto(session: Session, photo: Photo): Promise<Session> {
  const photoPath = `cases/${session.id}.jpg`;
  await getClient().storage.assets.write({ relativePath: photoPath, body: photo.blob, mediaType: 'image/jpeg' });
  return { ...session, photoPath };
}
export async function saveSession(session: Session): Promise<void> {
  await getClient().storage.writeJson('current-case.json', JSON.parse(JSON.stringify(session)) as JsonValue);
}
export async function restoreSession(): Promise<{ session: Session; photo: Photo } | null> {
  const document = await getClient().storage.readJson('current-case.json');
  if (document.value === null) return null;
  const session = document.value as unknown as Session;
  if (!session || !Array.isArray(session.props) || !session.photoPath || !Array.isArray(session.evidence) || !Array.isArray(session.discovered) || !session.messages) throw new Error('保存的案卷不完整，可以重新选择照片开案。');
  parseMystery(JSON.stringify(session.mystery), session.props);
  const asset = await getClient().storage.assets.read({ relativePath: session.photoPath });
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  for await (const chunk of asset.body) chunks.push(new Uint8Array(chunk));
  const photo = { ...await photoFromFile(new Blob(chunks, { type: 'image/jpeg' }), session.photoName), source: session.photoSource };
  inventories.set(photo.blob, session.props);
  return { session, photo };
}

export function errorMessage(error: unknown): string {
  const reason = typeof error === 'object' && error !== null && 'reasonCode' in error ? String(error.reasonCode) : '';
  if (reason === 'ai-local-configuration-not-configured') return '本机 AI 的运行环境还没有准备好。请在 Nimi 的 Runtime → 环境中准备对应能力的运行环境，然后回来重新开案。';
  if (reason === 'ai-config-not-found' || reason === 'ai-config-invalid') return '事务所还没有接通所需能力。打开右上角「能力设置」，配置看见物品和编故事后再试。';
  if (reason === 'ai-execution-interrupted') return 'Nimi 在本次操作中重新启动了。照片还在，你可以重新开案。';
  if (error instanceof Error) return error.message;
  return '这次操作没有完成，请重试。';
}
