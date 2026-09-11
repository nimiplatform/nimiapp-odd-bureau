import type { Prop } from './game.js';
import { getClient, locatePhoto, photoFromFile, rememberInventory, textTurn, type Photo } from './nimi.js';
import { commitPromises, initialMachine, jsonObject, machinePrompt, parseActions, parseMachine, parsePerformance, parseStrike, record, shortText, simulateMachine, strikePrompt, strikeReady, type Note, type PlayRound, type PromiseAction, type StrikePlan } from './play-rules.js';
import type { JsonValue } from '@nimiplatform/sdk/types';

export type PlaySave = { id: string; photoPath: string; photoName: string; photoSource: Photo['source']; props: Prop[]; round: PlayRound };
const photoPaths = new WeakMap<Blob, string>();

// @nimi-authority: rule.odd-bureau.playground.photo
export async function preparePlay(photo: Photo, kind: PlayRound['kind'], signal: AbortSignal, status: (text: string) => void, found: (props: Prop[]) => void): Promise<PlaySave> {
  status('正在认领照片里的物品…');
  const props = await locatePhoto(photo, signal, found);
  status(kind === 'machine' ? '给每件物品一条奇怪又讲理的规则…' : '听听大家为什么不肯开工…');
  const prompt = kind === 'machine' ? machinePrompt(props) : strikePrompt(props);
  let draft = await textTurn(prompt, signal, kind === 'machine' ? 1800 : 2600);
  const parse = (): PlayRound => kind === 'machine'
    ? { kind, plan: parseMachine(jsonObject(draft), props), state: initialMachine() }
    : { kind, plan: parseStrike(jsonObject(draft), props), state: { promises: [], journal: [], performance: null, curtain: 0 } };
  let round: PlayRound;
  try { round = parse(); }
  catch (error) {
    signal.throwIfAborted();
    status('让 AI 补齐刚才没说清的规则…');
    draft = await textTurn(`${prompt}\n上次方案不完整：${error instanceof Error ? error.message : '格式错误'}\n请纠正后返回完整 JSON：${draft}`, signal, 2800);
    round = parse();
  }
  signal.throwIfAborted();
  return { id: crypto.randomUUID(), photoPath: photoPaths.get(photo.blob) ?? '', photoName: photo.name, photoSource: photo.source, props, round };
}

export async function interpretProposal(plan: StrikePlan, props: Prop[], promises: PromiseAction[], message: string, signal: AbortSignal) {
  const text = await textTurn(`你是奇物局的桌面管家。把玩家的话理解成待确认的安排，不能执行、不能声称已经获得同意。只用照片里的精确id。动作：rest批准休假，credit给署名，assign安排task(story/reading/stage)。每次最多5项；无法理解或只是问问题时actions为空，reply解释并提出一个具体的下一步。现有承诺不可撤回、转送或伪造；只有一个休假和一个署名，先分配名额再安排工作。不要隐藏或豁免角色的条件。
返回JSON {"reply":"80字内中文说明","actions":[{"kind":"rest或credit","objectId":"精确id"},{"kind":"assign","objectId":"精确id","task":"精确task"}]}。
物品：${JSON.stringify(props.map(p => ({ id: p.id, label: p.label })))}
固定诉求：${JSON.stringify(plan.people)}
已兑现承诺：${JSON.stringify(promises)}
玩家说：${JSON.stringify(message)}`, signal, 1000);
  const response = jsonObject(text);
  return { reply: shortText(response.reply, 350), actions: parseActions(response.actions, props) };
}

// @nimi-authority: rule.odd-bureau.playground.promises
export async function writePerformance(plan: StrikePlan, props: Prop[], promises: PromiseAction[], signal: AbortSignal): Promise<string[]> {
  const state = commitPromises(plan, [], promises);
  if (!strikeReady(state)) throw new Error('先落实休假、署名和三份工作，故事会才能开场。');
  const text = await textTurn(`写一个可以朗读的三幕微型童话，中文，每幕60字以内。故事从一个小愿望展开，经过一次误会，最后温暖好笑地收尾。不是会议实录，也不是筹备工作。不要涉及署名、休假、罢工、名额、加班或工作分配，不要使用这些词。不要写元叙事或任务完成提示。
角色灵感来自这些物品：${props.map(p => p.label).join('、')}。让它们经历一段独立的小冒险。
只返回JSON {"parts":["第一幕正文","第二幕正文","第三幕正文"]}。`, signal, 1000);
  return parsePerformance(jsonObject(text));
}

// @nimi-authority: rule.odd-bureau.playground.persistence
export async function persistPlay(save: PlaySave, photo: Photo): Promise<PlaySave> {
  let photoPath = save.photoPath || photoPaths.get(photo.blob);
  if (!photoPath) {
    photoPath = `play-scenes/${crypto.randomUUID()}.jpg`;
    await getClient().storage.assets.write({ relativePath: photoPath, body: photo.blob, mediaType: 'image/jpeg' });
    photoPaths.set(photo.blob, photoPath);
  }
  const next = { ...save, photoPath };
  await getClient().storage.writeJson('current-play.json', JSON.parse(JSON.stringify(next)) as JsonValue);
  return next;
}

function restoreNotes(value: unknown): Note[] {
  if (!Array.isArray(value) || value.length > 32) throw new Error('保存的声音不完整。');
  return value.map(item => {
    const n = record(item);
    if (!Number.isInteger(n.pitch) || Number(n.pitch) < 0 || Number(n.pitch) > 4 || !Number.isInteger(n.beats) || Number(n.beats) < 1 || Number(n.beats) > 4) throw new Error('保存的音符不完整。');
    return { pitch: Number(n.pitch), beats: Number(n.beats) };
  });
}
export function parsePlaySave(input: unknown): PlaySave {
  const value = record(input);
  if (!Array.isArray(value.props) || value.props.length < 3 || value.props.length > 6) throw new Error('保存的照片物品不完整。');
  const props = value.props.map(item => {
    const p = record(item), b = record(p.box);
    const box = { x1: Number(b.x1), y1: Number(b.y1), x2: Number(b.x2), y2: Number(b.y2) };
    if (!Object.values(box).every(n => Number.isFinite(n) && n >= 0 && n <= 1) || box.x1 >= box.x2 || box.y1 >= box.y2) throw new Error('保存的位置不完整。');
    return { id: shortText(p.id, 50), label: shortText(p.label, 100), box };
  });
  if (new Set(props.map(p => p.id)).size !== props.length || !['sample', 'upload'].includes(String(value.photoSource))) throw new Error('保存的照片身份不完整。');
  const r = record(value.round), s = record(r.state);
  let round: PlayRound;
  if (r.kind === 'machine') {
    const plan = parseMachine(r.plan, props), rawStored = record(s.stored), stored: Record<string, Note[]> = {};
    for (const [id, notes] of Object.entries(rawStored)) {
      if (!plan.nodes.some(n => n.objectId === id && n.op === 'store')) throw new Error('保存的容器没有对齐照片。');
      stored[id] = restoreNotes(notes);
    }
    if (!Array.isArray(s.path) || s.path.length > props.length || new Set(s.path).size !== s.path.length || s.path.some(id => !props.some(p => p.id === id)) || !Number.isSafeInteger(s.runs) || Number(s.runs) < 0 || typeof s.solved !== 'boolean') throw new Error('保存的线路不完整。');
    const last = s.lastRun === null ? null : record(s.lastRun);
    if (last && (!Array.isArray(last.path) || last.path.some(id => typeof id !== 'string'))) throw new Error('保存的运行结果不完整。');
    round = { kind: 'machine', plan, state: { path: s.path as string[], stored, runs: Number(s.runs), solved: s.solved, lastRun: last ? simulateMachine(plan, props, last.path as string[]) : null } };
  } else if (r.kind === 'strike') {
    const plan = parseStrike(r.plan, props), promises = parseActions(s.promises, props), committed = commitPromises(plan, [], promises);
    if (!Array.isArray(s.journal) || s.journal.length > 12 || !Number.isInteger(s.curtain) || Number(s.curtain) < 0 || Number(s.curtain) > 3) throw new Error('保存的故事会不完整。');
    const performance = s.performance === null ? null : parsePerformance({ parts: s.performance });
    if (s.performance !== null && (!performance || !strikeReady(committed))) throw new Error('故事会的承诺还没有落实。');
    if (!performance && s.curtain !== 0) throw new Error('尚未开场的故事会不能已经谢幕。');
    round = { kind: 'strike', plan, state: { promises, journal: s.journal.map(x => shortText(x, 500)), performance, curtain: Number(s.curtain) } };
  } else throw new Error('没有这种已保存的活动。');
  return { id: shortText(value.id, 100), photoPath: shortText(value.photoPath, 512), photoName: shortText(value.photoName, 200), photoSource: value.photoSource as Photo['source'], props, round };
}
export async function restorePlay(): Promise<{ save: PlaySave; photo: Photo } | null> {
  const document = await getClient().storage.readJson('current-play.json');
  if (document.value === null) return null;
  const save = parsePlaySave(document.value), asset = await getClient().storage.assets.read({ relativePath: save.photoPath });
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  for await (const bytes of asset.body) chunks.push(new Uint8Array(bytes));
  const photo = { ...await photoFromFile(new Blob(chunks, { type: 'image/jpeg' }), save.photoName), source: save.photoSource };
  rememberInventory(photo, save.props); photoPaths.set(photo.blob, save.photoPath);
  return { save, photo };
}
