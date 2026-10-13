// @nimi-authority: rule.odd-bureau.playground.language
import { t, outputLanguage, language, type Language } from './i18n.js';
import type { Prop } from './game.js';

export type MachineOp = 'source' | 'echo' | 'reverse' | 'raise' | 'slow' | 'store';
export type Note = { pitch: number; beats: number };
export type MachineNode = { objectId: string; op: MachineOp; melody: number[]; line: string };
export type MachinePlan = { title: string; invitation: string; nodes: MachineNode[] };
export type MachineTrace = { objectId: string; notes: Note[] };
export type MachineRun = { path: string[]; notes: Note[]; trace: MachineTrace[]; cost: number; receiver: string };
export type MachineState = { path: string[]; stored: Record<string, Note[]>; runs: number; solved: boolean; lastRun: MachineRun | null };
export type MachineRound = { kind: 'machine'; plan: MachinePlan; state: MachineState };
export const NOTE_NAMES = [t("咚"), t("叮"), t("铃"), t("啵"), t("铛")] as const;
export const OP_COPY: Record<MachineOp, { name: string; rule: string }> = {
  source: { name: t("发声"), rule: t("每次启动，送出自己的小旋律") },
  echo: { name: t("回声"), rule: t("把收到的旋律完整重复一次") },
  reverse: { name: t("倒放"), rule: t("把收到的声音按相反顺序送出") },
  raise: { name: t("变亮"), rule: t("每个音向上走两级，到顶后从头开始") },
  slow: { name: t("慢长"), rule: t("每个声音的时长翻倍，最多四拍") },
  store: { name: t("装起来"), rule: t("保存收到的声音；最多装 32 个音") },
};

export function allowedOps(label: string): MachineOp[] {
  if (/杯|瓶|餐盘|碗|包|椅|鞋|^(cup|bottle|plate|bag|chair|shoes)$/i.test(label)) return ['store'];
  if (/时钟|闹钟|^clock$/i.test(label)) return ['source'];
  if (/书|相框|^(book|picture frame)$/i.test(label)) return ['echo', 'reverse', 'source'];
  if (/耳机|^headphones$/i.test(label)) return ['echo', 'raise'];
  if (/盆栽|^plant$/i.test(label)) return ['slow', 'store'];
  if (/灯|^lamp$/i.test(label)) return ['raise', 'reverse', 'source'];
  if (/钥匙|^key$/i.test(label)) return ['reverse', 'source'];
  return ['source', 'echo', 'store'];
}

export function jsonObject(input: string): Record<string, unknown> {
  let value: unknown;
  try { value = JSON.parse(input.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
  catch { throw new Error(t("这次 AI 没有给出完整的玩法。照片还在，可以重新生成。")); }
  return record(value);
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(t("玩法数据不完整，请重新生成。"));
  return value as Record<string, unknown>;
}
export function shortText(value: unknown, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(t("一段角色说明没有完整生成，请重试。"));
  return value.trim();
}
function validActor(id: unknown, props: readonly Prop[]): string {
  if (typeof id !== 'string' || !props.some(p => p.id === id)) throw new Error(t("角色没有对齐这张照片，请重新生成。"));
  return id;
}
function exactCast(ids: string[], props: readonly Prop[]) {
  if (ids.length !== props.length || new Set(ids).size !== props.length) throw new Error(t("每件物品都需要一份独立的规则，请重新生成。"));
}
export function parseMachine(raw: unknown, props: readonly Prop[]): MachinePlan {
  const value = record(raw);
  if (!Array.isArray(value.nodes)) throw new Error(t("机器缺少器件规则，请重新生成。"));
  const nodes = value.nodes.map(item => {
    const node = record(item); const objectId = validActor(node.objectId, props);
    const op = node.op as MachineOp;
    if (!allowedOps(props.find(p => p.id === objectId)!.label).includes(op)) throw new Error(t("这件物品的转换方式不适用，请重新生成。"));
    const melody = node.melody;
    if (!Array.isArray(melody) || melody.length > 3 || melody.some(n => !Number.isInteger(n) || n < 0 || n > 4) || (op === 'source' && !melody.length)) throw new Error(t("发声器没有给出可演奏的旋律，请重新生成。"));
    return { objectId, op, melody: melody as number[], line: shortText(node.line, 120) };
  });
  exactCast(nodes.map(n => n.objectId), props);
  const plan = { title: shortText(value.title, 45), invitation: shortText(value.invitation, 160), nodes };
  machineChallenge(plan, props);
  return plan;
}
export function initialMachine(): MachineState { return { path: [], stored: {}, runs: 0, solved: false, lastRun: null }; }
export function editMachinePath(plan: MachinePlan, path: readonly string[], id: string): string[] {
  const node = plan.nodes.find(n => n.objectId === id);
  if (!node) throw new Error(t("没有这个器件。"));
  if (node.op === 'source') return [id];
  if (!path.length) throw new Error(t("先点一个「发声」物品作为起点。"));
  const existing = path.indexOf(id);
  if (existing >= 0) return path.slice(0, existing + 1);
  const previous = plan.nodes.find(n => n.objectId === path[path.length - 1]);
  return [...(previous?.op === 'store' ? path.slice(0, -1) : path), id];
}
export function lineCost(path: readonly string[], props: readonly Prop[]): number {
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    const a = props.find(p => p.id === path[i - 1])?.box, b = props.find(p => p.id === path[i])?.box;
    if (!a || !b) throw new Error(t("线路经过了照片之外的物品。"));
    cost += Math.max(1, Math.round(Math.hypot((a.x1 + a.x2 - b.x1 - b.x2) / 2, (a.y1 + a.y2 - b.y1 - b.y2) / 2) * 10));
  }
  return cost;
}
// @nimi-authority: rule.odd-bureau.playground.machine
export function simulateMachine(plan: MachinePlan, props: readonly Prop[], path: readonly string[]): MachineRun {
  if (path.length < 2 || path.length > plan.nodes.length || new Set(path).size !== path.length) throw new Error(t("连接发声器和容器，每件物品只经过一次。"));
  const nodes = path.map(id => { const node = plan.nodes.find(n => n.objectId === id); if (!node) throw new Error(t("线路包含未知物品。")); return node; });
  if (nodes[0].op !== 'source' || nodes.at(-1)!.op !== 'store') throw new Error(t("线路需要从「发声」出发，以「装起来」结束。"));
  let notes: Note[] = []; const trace: MachineTrace[] = [];
  nodes.forEach((node, i) => {
    if (i > 0 && node.op === 'source') throw new Error(t("一条线只能有一个发声起点。"));
    if (i < nodes.length - 1 && node.op === 'store') throw new Error(t("容器是这一条线的终点。"));
    if (node.op === 'source') notes = node.melody.map(pitch => ({ pitch, beats: 1 }));
    if (node.op === 'echo') notes = [...notes, ...notes].map(n => ({ ...n }));
    if (node.op === 'reverse') notes = [...notes].reverse();
    if (node.op === 'raise') notes = notes.map(n => ({ ...n, pitch: (n.pitch + 2) % 5 }));
    if (node.op === 'slow') notes = notes.map(n => ({ ...n, beats: Math.min(4, n.beats * 2) }));
    if (notes.length > 32) throw new Error(t("声音太多啦，这条线一次最多传递 32 个音。"));
    trace.push({ objectId: node.objectId, notes: notes.map(n => ({ ...n })) });
  });
  return { path: [...path], notes, trace, cost: lineCost(path, props), receiver: path.at(-1)! };
}
export function sameNotes(a: readonly Note[], b: readonly Note[]) { return a.length === b.length && a.every((n, i) => n.pitch === b[i].pitch && n.beats === b[i].beats); }
export function machineChallenge(plan: MachinePlan, props: readonly Prop[]): MachineRun {
  const sources = plan.nodes.filter(n => n.op === 'source'), stores = plan.nodes.filter(n => n.op === 'store');
  const transforms = plan.nodes.filter(n => !['source', 'store'].includes(n.op));
  const choices: MachineRun[] = [];
  for (const source of sources) for (const store of stores) for (const middle of transforms) {
    for (const tail of [null, ...transforms.filter(n => n !== middle)]) {
      const run = simulateMachine(plan, props, [source.objectId, middle.objectId, ...(tail ? [tail.objectId] : []), store.objectId]);
      const original = source.melody.map(pitch => ({ pitch, beats: 1 }));
      if (!sameNotes(original, run.notes)) choices.push(run);
    }
  }
  choices.sort((a, b) => b.path.length - a.path.length || a.cost - b.cost);
  if (!choices.length) throw new Error(t("这台机器还缺一个有效的改造器、发声器或容器，请重新生成。"));
  return choices[0];
}
export function runMachine(plan: MachinePlan, props: readonly Prop[], state: MachineState): MachineState {
  const run = simulateMachine(plan, props, state.path), goal = machineChallenge(plan, props);
  const stored = [...(state.stored[run.receiver] ?? []), ...run.notes];
  if (stored.length > 32) throw new Error(t("这个容器装不下了，先把声音倒出来或清空。"));
  return { ...state, runs: state.runs + 1, stored: { ...state.stored, [run.receiver]: stored }, lastRun: run,
    solved: state.solved || (run.receiver === goal.receiver && run.cost <= goal.cost && sameNotes(run.notes, goal.notes)) };
}

export const TASKS = ['story', 'reading', 'stage'] as const;
export type StrikeTask = typeof TASKS[number];
export const TASK_NAMES: Record<StrikeTask, string> = { story: t("写故事"), reading: t("朗读"), stage: t("布置现场") };
export type StrikeOffer = { task: StrikeTask; needsCredit: boolean; needsRest: string | null };
export type StrikePerson = { objectId: string; persona: string; offers: StrikeOffer[] };
export type StrikePlan = { title: string; situation: string; people: StrikePerson[] };
export type PromiseAction = { kind: 'rest'; objectId: string } | { kind: 'credit'; objectId: string } | { kind: 'assign'; objectId: string; task: StrikeTask };
export type PromiseState = { rest: string | null; credit: string | null; tasks: Partial<Record<StrikeTask, string>>; promises: PromiseAction[] };
export type StrikeState = { promises: PromiseAction[]; journal: string[]; performance: string[] | null; curtain: number };
export type StrikeRound = { kind: 'strike'; plan: StrikePlan; state: StrikeState };
export type PlayRound = MachineRound | StrikeRound;

export function parseStrike(raw: unknown, props: readonly Prop[]): StrikePlan {
  const value = record(raw);
  if (!Array.isArray(value.people)) throw new Error(t("故事会缺少参加者，请重新生成。"));
  const people = value.people.map(item => {
    const person = record(item), objectId = validActor(person.objectId, props);
    if (!Array.isArray(person.offers) || person.offers.length < 1 || person.offers.length > 3) throw new Error(t("角色需要说明愿意做哪些工作。"));
    const offers = person.offers.map(item => {
      const offer = record(item), task = offer.task as StrikeTask;
      if (!TASKS.includes(task) || typeof offer.needsCredit !== 'boolean') throw new Error(t("工作条件没有完整生成。"));
      const needsRest = offer.needsRest === null ? null : validActor(offer.needsRest, props);
      if (needsRest === objectId) throw new Error(t("角色不能同时要求自己休息和工作。"));
      return { task, needsCredit: offer.needsCredit, needsRest };
    });
    if (new Set(offers.map(o => o.task)).size !== offers.length) throw new Error(t("同一件工作不能有互相冲突的条件。"));
    return { objectId, persona: shortText(person.persona, 80), offers };
  });
  exactCast(people.map(p => p.objectId), props);
  const plan = { title: shortText(value.title, 45), situation: shortText(value.situation, 220), people };
  if (!findStrikeSolution(plan)) throw new Error(t("大家的条件还谈不拢，AI 需要重新准备一场有解的故事会。"));
  return plan;
}
export function parseActions(raw: unknown, props: readonly Prop[]): PromiseAction[] {
  if (!Array.isArray(raw) || raw.length > 5) throw new Error(t("提议需要一到五个明确的安排。"));
  return raw.map(item => {
    const a = record(item), objectId = validActor(a.objectId, props);
    if (a.kind === 'rest' || a.kind === 'credit') return { kind: a.kind, objectId };
    if (a.kind === 'assign' && TASKS.includes(a.task as StrikeTask)) return { kind: a.kind, objectId, task: a.task as StrikeTask };
    throw new Error(t("这次提议包含不能执行的动作，请换一种说法。"));
  });
}
// @nimi-authority: rule.odd-bureau.playground.promises
export function commitPromises(plan: StrikePlan, previous: readonly PromiseAction[], proposed: readonly PromiseAction[]): PromiseState {
  const state: PromiseState = { rest: null, credit: null, tasks: {}, promises: [] };
  const apply = (action: PromiseAction) => {
    const person = plan.people.find(p => p.objectId === action.objectId);
    if (!person) throw new Error(t("这件物品没有参加故事会。"));
    const working = Object.values(state.tasks).filter(id => id === person.objectId).length;
    if (action.kind === 'rest') {
      if (state.rest) throw new Error(t("唯一的休假名额已经答应给别人了。"));
      if (working || state.credit === person.objectId) throw new Error(t("这位已经接受工作或署名，不能再批准休假。"));
      state.rest = person.objectId;
    } else if (action.kind === 'credit') {
      if (state.credit) throw new Error(t("唯一的署名已经许出，不能转送给别人。"));
      if (state.rest === person.objectId) throw new Error(t("署名需要交给参加演出的伙伴。"));
      state.credit = person.objectId;
    } else {
      if (!TASKS.includes(action.task)) throw new Error(t("没有这项工作。"));
      if (state.tasks[action.task]) throw new Error(t("这项工作已经有人答应承担。"));
      if (state.rest === person.objectId) throw new Error(t("已经批准休假的伙伴不能再被安排工作。"));
      if (working >= 2) throw new Error(t("一件物品最多承担两份工作。"));
      const offer = person.offers.find(o => o.task === action.task);
      if (!offer) throw new Error(t("这位没有答应做这份工作。"));
      if (offer.needsCredit && state.credit !== person.objectId) throw new Error(t("这份工作需要先兑现它的署名条件。"));
      if (offer.needsRest && state.rest !== offer.needsRest) throw new Error(t("这份工作需要先批准它指定的伙伴休息。"));
      state.tasks[action.task] = person.objectId;
    }
    state.promises.push(action);
  };
  previous.forEach(apply);
  // A reviewed multi-part proposal grants allocations before assigning work.
  const order = { rest: 0, credit: 1, assign: 2 };
  [...proposed].sort((a, b) => order[a.kind] - order[b.kind]).forEach(apply);
  return state;
}
export function strikeReady(state: PromiseState): boolean {
  return !!state.rest && !!state.credit && TASKS.every(task => !!state.tasks[task]) && Object.values(state.tasks).includes(state.credit);
}
export function findStrikeSolution(plan: StrikePlan, existing: readonly PromiseAction[] = []): PromiseAction[] | null {
  const ids = plan.people.map(p => p.objectId);
  const options = TASKS.map(task => plan.people.filter(p => p.offers.some(o => o.task === task)).map(p => p.objectId));
  for (const rest of ids) for (const credit of ids) {
    if (rest === credit) continue;
    for (const story of options[0]) for (const reading of options[1]) for (const stage of options[2]) {
      const work = [story, reading, stage];
      if (work.includes(rest) || !work.includes(credit) || new Set(work).size === 1) continue;
      const actions: PromiseAction[] = [{ kind: 'rest', objectId: rest }, { kind: 'credit', objectId: credit },
        { kind: 'assign', objectId: story, task: 'story' }, { kind: 'assign', objectId: reading, task: 'reading' }, { kind: 'assign', objectId: stage, task: 'stage' }];
      if (!existing.every(a => actions.some(b => a.kind === b.kind && a.objectId === b.objectId && (a.kind !== 'assign' || (b.kind === 'assign' && a.task === b.task))))) continue;
      try { if (strikeReady(commitPromises(plan, [], actions))) return actions; } catch { /* This allocation does not satisfy the declared wishes. */ }
    }
  }
  return null;
}
export function actionText(action: PromiseAction, props: readonly Prop[]): string {
  const name = props.find(p => p.id === action.objectId)?.label ?? t("物品");
  return action.kind === 'rest' ? t("批准{0}休息", name) : action.kind === 'credit' ? t("把唯一署名给{0}", name) : t("请{0}{1}", name, TASK_NAMES[action.task]);
}
export function offerText(offer: StrikeOffer, props: readonly Prop[]): string {
  const conditions = [offer.needsCredit ? t("要有我的署名") : '', offer.needsRest ? t("先让{0}休息", props.find(p => p.id === offer.needsRest)?.label) : ''].filter(Boolean);
  return conditions.length ? conditions.join(language === 'zh' ? '；' : '; ') : t("我愿意直接帮忙");
}

export function parsePerformance(raw: unknown): string[] {
  const value = record(raw);
  if (!Array.isArray(value.parts) || value.parts.length !== 3) throw new Error(t("故事还没写成完整的三幕，可以保留安排再试一次。"));
  const parts = value.parts.map(part => shortText(part, 450));
  if (parts.some(part => /署名|休假|罢工|名额|加班|\b(?:credit|leave allocation|on leave|strike|quota|overtime|work assignment)\b/i.test(part))) throw new Error(t("童话把后台的约定混进来了。承诺仍然保留，请重新写今晚的故事。"));
  return parts;
}

export function machinePrompt(props: readonly Prop[]): string {
  return `Create a playful odd sound machine for Odd Bureau in ${outputLanguage}. Observed object identities and coordinates are immutable. Pick one of each object's allowedOps. The op field must be one exact ASCII enum: source, echo, reverse, raise, slow, store. Never translate enums or return rule names as op values. Include at least one source, one store and one actual melody transformer (echo, reverse, raise or slow). Operations should reflect objects' uses: clock rhythms, book repetition, lamp brightness, cup containment. The program owns rules and effects; line is only playful character dialogue, never a new rule. A source melody has 1–3 integer pitches from 0 to 4; other melodies are []. Do not return a goal or coordinates.
Only JSON; all prose in ${outputLanguage}, IDs and operations unchanged. Character limits including spaces: title 45, invitation 160, line 120.
{"title":"machine name","invitation":"one-sentence invitation to invent","nodes":[{"objectId":"exact id","op":"allowed operation","melody":[0,2],"line":"character dialogue"}]}
Operation semantics: ${JSON.stringify(OP_COPY)}.
Objects: ${JSON.stringify(props.map(p => ({ id: p.id, label: p.label, allowedOps: allowedOps(p.label) })))}. Include all ${props.length} objects exactly once, with their exact IDs.`;
}
export function strikePrompt(props: readonly Prop[]): string {
  return `Design a warm, funny object strike for Odd Bureau in ${outputLanguage}. Fixed jobs: story (write a tale), reading (read it aloud), stage (set the stage). There is one leave slot and one credit slot. An object on leave cannot work; credit must go to a worker. Each object can take at most two jobs. Preserve observed identities. Each object offers 1–3 jobs fitting its use. An offer may require its own credit (needsCredit) or another object's leave (needsRest: exact id); otherwise false/null. These fields express every condition, with no hidden dialogue conditions. Include at least one credit request and one request for a friend's leave, plus enough unconditional options to fill all three jobs, leave and credit together. This is not a culprit hunt; multiple solutions are allowed.
Situation describes atmosphere and persona describes personality, without leave, credit or work conditions. Conditions belong only in offers, which the UI displays.
Only JSON; all prose in ${outputLanguage}, IDs and enums unchanged. Character limits including spaces: title 45, situation 220, persona 80.
{"title":"story show title","situation":"two amusing opening sentences","people":[{"objectId":"exact id","persona":"personality","offers":[{"task":"story or reading or stage","needsCredit":false,"needsRest":null}]}]}
Inventory: ${JSON.stringify(props.map(p => ({ id: p.id, label: p.label })))}. Include every object exactly once.`;
}

export type PlaySave = { language: Language; id: string; photoPath: string; photoName: string; photoSource: "sample" | "upload"; props: Prop[]; round: PlayRound };

function restoreNotes(value: unknown): Note[] {
  if (!Array.isArray(value) || value.length > 32) throw new Error(t("保存的声音不完整。"));
  return value.map(item => {
    const n = record(item);
    if (!Number.isInteger(n.pitch) || Number(n.pitch) < 0 || Number(n.pitch) > 4 || !Number.isInteger(n.beats) || Number(n.beats) < 1 || Number(n.beats) > 4) throw new Error(t("保存的音符不完整。"));
    return { pitch: Number(n.pitch), beats: Number(n.beats) };
  });
}
// @nimi-authority: rule.odd-bureau.playground.persistence
// @nimi-authority: rule.odd-bureau.playground.photo
export function parsePlaySave(input: unknown): PlaySave {
  const value = record(input);
  if (value.language !== undefined && value.language !== 'zh' && value.language !== 'en') throw new Error(t("保存的语言不完整。"));
  if (!Array.isArray(value.props) || value.props.length < 3 || value.props.length > 6) throw new Error(t("保存的照片物品不完整。"));
  const props = value.props.map((item, index) => {
    const p = record(item), b = record(p.box);
    const { x1, y1, x2, y2 } = b;
    if (typeof x1 !== 'number' || typeof y1 !== 'number' || typeof x2 !== 'number' || typeof y2 !== 'number'
      || ![x1, y1, x2, y2].every(n => Number.isFinite(n) && n >= 0 && n <= 1) || x1 >= x2 || y1 >= y2) throw new Error(t("保存的位置不完整。"));
    if (p.id !== `object-${index + 1}`) throw new Error(t("保存的物品身份不完整。"));
    return { id: p.id, label: shortText(p.label, 100), box: { x1, y1, x2, y2 } };
  });
  if (value.photoSource !== 'sample' && value.photoSource !== 'upload') throw new Error(t("保存的照片身份不完整。"));
  const r = record(value.round), s = record(r.state);
  let round: PlayRound;
  if (r.kind === 'machine') {
    const plan = parseMachine(r.plan, props), rawStored = record(s.stored), stored: Record<string, Note[]> = {};
    for (const [id, notes] of Object.entries(rawStored)) {
      if (!plan.nodes.some(n => n.objectId === id && n.op === 'store')) throw new Error(t("保存的容器没有对齐照片。"));
      stored[id] = restoreNotes(notes);
    }
    if (!Array.isArray(s.path) || s.path.length > props.length || new Set(s.path).size !== s.path.length || s.path.some(id => !props.some(p => p.id === id)) || !Number.isSafeInteger(s.runs) || Number(s.runs) < 0 || typeof s.solved !== 'boolean') throw new Error(t("保存的线路不完整。"));
    const last = s.lastRun === null ? null : record(s.lastRun);
    if (last && (!Array.isArray(last.path) || last.path.some(id => typeof id !== 'string'))) throw new Error(t("保存的运行结果不完整。"));
    const lastRun = last ? simulateMachine(plan, props, last.path as string[]) : null;
    if ((s.runs === 0 && (lastRun || s.solved || Object.values(stored).some(notes => notes.length))) || (Number(s.runs) > 0 && !lastRun)) throw new Error(t("保存的运行次数与结果不一致。"));
    if (lastRun) {
      const goal = machineChallenge(plan, props);
      const won = lastRun.receiver === goal.receiver && lastRun.cost <= goal.cost && sameNotes(lastRun.notes, goal.notes);
      if ((s.runs === 1 && s.solved !== won) || (won && !s.solved)) throw new Error(t("保存的挑战结果与线路不一致。"));
    }
    round = { kind: 'machine', plan, state: { path: s.path as string[], stored, runs: Number(s.runs), solved: s.solved, lastRun } };
  } else if (r.kind === 'strike') {
    const plan = parseStrike(r.plan, props), promises = parseActions(s.promises, props), committed = commitPromises(plan, promises, []);
    if (!Array.isArray(s.journal) || s.journal.length > 12 || !Number.isInteger(s.curtain) || Number(s.curtain) < 0 || Number(s.curtain) > 3) throw new Error(t("保存的故事会不完整。"));
    const performance = s.performance === null ? null : parsePerformance({ parts: s.performance });
    if (s.performance !== null && (!performance || !strikeReady(committed))) throw new Error(t("故事会的承诺还没有落实。"));
    if (!performance && s.curtain !== 0) throw new Error(t("尚未开场的故事会不能已经谢幕。"));
    round = { kind: 'strike', plan, state: { promises, journal: s.journal.map(x => shortText(x, 500)), performance, curtain: Number(s.curtain) } };
  } else throw new Error(t("没有这种已保存的活动。"));
  const id = shortText(value.id, 100), photoPath = shortText(value.photoPath, 512);
  if (!/^[a-zA-Z0-9-]+$/.test(id) || !/^play-scenes\/[a-zA-Z0-9-]+\.jpg$/.test(photoPath)) throw new Error(t("保存的照片路径不完整。"));
  // Published 0.1.1 saves predate localization and contain Chinese fiction.
  return { language: (value.language ?? 'zh') as Language, id, photoPath, photoName: shortText(value.photoName, 200), photoSource: value.photoSource, props, round };
}

export function proposalPrompt(plan: StrikePlan, props: readonly Prop[], promises: readonly PromiseAction[], message: string): string {
  return `You are Odd Bureau's table steward. Interpret the player's message as a proposal for confirmation, never execute it or claim agreement. Use only exact observed IDs. Actions: rest (grant leave), credit (give credit), assign (task story/reading/stage). At most five actions. For unclear messages or questions, return no actions and explain a concrete next step. Existing promises cannot be revoked, transferred or invented. There is one leave slot and one credit slot; allocate them before assigning dependent work. Never hide or waive a character's conditions.
Return only JSON; reply in ${outputLanguage}, at most 350 characters including spaces. IDs, field names and enums unchanged.
{"reply":"explanation","actions":[{"kind":"rest or credit","objectId":"exact id"},{"kind":"assign","objectId":"exact id","task":"exact task"}]}
Objects: ${JSON.stringify(props.map(p => ({ id: p.id, label: p.label })))}
Fixed offers: ${JSON.stringify(plan.people)}
Fulfilled promises: ${JSON.stringify(promises)}
Player says: ${JSON.stringify(message)}`;
}

export function performancePrompt(props: readonly Prop[]): string {
  return `Write a tiny, speakable fairy tale in ${outputLanguage}, exactly three acts, each at most 450 characters including spaces. Begin with a little wish, pass through a misunderstanding, and end warmly and humorously. It is an independent adventure, not meeting minutes or backstage preparation. Do not mention credit, leave allocation, being on leave, strikes, quotas, overtime or work assignments; do not use those terms. No metanarrative or task-completion notices.
Characters inspired by: ${props.map(p => p.label).join(', ')}.
Return only JSON {"parts":["act one prose","act two prose","act three prose"]}, with all prose in ${outputLanguage}.`;
}
