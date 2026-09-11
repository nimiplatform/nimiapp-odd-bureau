import type { Prop } from './game.js';

export type MachineOp = 'source' | 'echo' | 'reverse' | 'raise' | 'slow' | 'store';
export type Note = { pitch: number; beats: number };
export type MachineNode = { objectId: string; op: MachineOp; melody: number[]; line: string };
export type MachinePlan = { title: string; invitation: string; nodes: MachineNode[] };
export type MachineTrace = { objectId: string; notes: Note[] };
export type MachineRun = { path: string[]; notes: Note[]; trace: MachineTrace[]; cost: number; receiver: string };
export type MachineState = { path: string[]; stored: Record<string, Note[]>; runs: number; solved: boolean; lastRun: MachineRun | null };
export type MachineRound = { kind: 'machine'; plan: MachinePlan; state: MachineState };
export const NOTE_NAMES = ['咚', '叮', '铃', '啵', '铛'] as const;
export const OP_COPY: Record<MachineOp, { name: string; rule: string }> = {
  source: { name: '发声', rule: '每次启动，送出自己的小旋律' },
  echo: { name: '回声', rule: '把收到的旋律完整重复一次' },
  reverse: { name: '倒放', rule: '把收到的声音按相反顺序送出' },
  raise: { name: '变亮', rule: '每个音向上走两级，到顶后从头开始' },
  slow: { name: '慢长', rule: '每个声音的时长翻倍，最多四拍' },
  store: { name: '装起来', rule: '保存收到的声音；最多装 32 个音' },
};

export function allowedOps(label: string): MachineOp[] {
  if (/杯|瓶|餐盘|碗|包|椅|鞋/.test(label)) return ['store'];
  if (/时钟|闹钟/.test(label)) return ['source'];
  if (/书|相框/.test(label)) return ['echo', 'reverse', 'source'];
  if (/耳机/.test(label)) return ['echo', 'raise'];
  if (/盆栽/.test(label)) return ['slow', 'store'];
  if (/灯/.test(label)) return ['raise', 'reverse', 'source'];
  if (/钥匙/.test(label)) return ['reverse', 'source'];
  return ['source', 'echo', 'store'];
}

export function jsonObject(input: string): Record<string, unknown> {
  let value: unknown;
  try { value = JSON.parse(input.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
  catch { throw new Error('这次 AI 没有给出完整的玩法。照片还在，可以重新生成。'); }
  return record(value);
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('玩法数据不完整，请重新生成。');
  return value as Record<string, unknown>;
}
export function shortText(value: unknown, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('一段角色说明没有完整生成，请重试。');
  return value.trim();
}
function validActor(id: unknown, props: readonly Prop[]): string {
  if (typeof id !== 'string' || !props.some(p => p.id === id)) throw new Error('角色没有对齐这张照片，请重新生成。');
  return id;
}
function exactCast(ids: string[], props: readonly Prop[]) {
  if (ids.length !== props.length || new Set(ids).size !== props.length) throw new Error('每件物品都需要一份独立的规则，请重新生成。');
}
export function parseMachine(raw: unknown, props: readonly Prop[]): MachinePlan {
  const value = record(raw);
  if (!Array.isArray(value.nodes)) throw new Error('机器缺少器件规则，请重新生成。');
  const nodes = value.nodes.map(item => {
    const node = record(item); const objectId = validActor(node.objectId, props);
    const op = node.op as MachineOp;
    if (!allowedOps(props.find(p => p.id === objectId)!.label).includes(op)) throw new Error('这件物品的转换方式不适用，请重新生成。');
    const melody = node.melody;
    if (!Array.isArray(melody) || melody.length > 3 || melody.some(n => !Number.isInteger(n) || n < 0 || n > 4) || (op === 'source' && !melody.length)) throw new Error('发声器没有给出可演奏的旋律，请重新生成。');
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
  if (!node) throw new Error('没有这个器件。');
  if (node.op === 'source') return [id];
  if (!path.length) throw new Error('先点一个「发声」物品作为起点。');
  const existing = path.indexOf(id);
  if (existing >= 0) return path.slice(0, existing + 1);
  const previous = plan.nodes.find(n => n.objectId === path[path.length - 1]);
  return [...(previous?.op === 'store' ? path.slice(0, -1) : path), id];
}
export function lineCost(path: readonly string[], props: readonly Prop[]): number {
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    const a = props.find(p => p.id === path[i - 1])?.box, b = props.find(p => p.id === path[i])?.box;
    if (!a || !b) throw new Error('线路经过了照片之外的物品。');
    cost += Math.max(1, Math.round(Math.hypot((a.x1 + a.x2 - b.x1 - b.x2) / 2, (a.y1 + a.y2 - b.y1 - b.y2) / 2) * 10));
  }
  return cost;
}
// @nimi-authority: rule.odd-bureau.playground.machine
export function simulateMachine(plan: MachinePlan, props: readonly Prop[], path: readonly string[]): MachineRun {
  if (path.length < 2 || path.length > plan.nodes.length || new Set(path).size !== path.length) throw new Error('连接发声器和容器，每件物品只经过一次。');
  const nodes = path.map(id => { const node = plan.nodes.find(n => n.objectId === id); if (!node) throw new Error('线路包含未知物品。'); return node; });
  if (nodes[0].op !== 'source' || nodes.at(-1)!.op !== 'store') throw new Error('线路需要从「发声」出发，以「装起来」结束。');
  let notes: Note[] = []; const trace: MachineTrace[] = [];
  nodes.forEach((node, i) => {
    if (i > 0 && node.op === 'source') throw new Error('一条线只能有一个发声起点。');
    if (i < nodes.length - 1 && node.op === 'store') throw new Error('容器是这一条线的终点。');
    if (node.op === 'source') notes = node.melody.map(pitch => ({ pitch, beats: 1 }));
    if (node.op === 'echo') notes = [...notes, ...notes].map(n => ({ ...n }));
    if (node.op === 'reverse') notes = [...notes].reverse();
    if (node.op === 'raise') notes = notes.map(n => ({ ...n, pitch: (n.pitch + 2) % 5 }));
    if (node.op === 'slow') notes = notes.map(n => ({ ...n, beats: Math.min(4, n.beats * 2) }));
    if (notes.length > 32) throw new Error('声音太多啦，这条线一次最多传递 32 个音。');
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
  if (!choices.length) throw new Error('这台机器还缺一个有效的改造器、发声器或容器，请重新生成。');
  return choices[0];
}
export function runMachine(plan: MachinePlan, props: readonly Prop[], state: MachineState): MachineState {
  const run = simulateMachine(plan, props, state.path), goal = machineChallenge(plan, props);
  const stored = [...(state.stored[run.receiver] ?? []), ...run.notes];
  if (stored.length > 32) throw new Error('这个容器装不下了，先把声音倒出来或清空。');
  return { ...state, runs: state.runs + 1, stored: { ...state.stored, [run.receiver]: stored }, lastRun: run,
    solved: state.solved || (run.receiver === goal.receiver && run.cost <= goal.cost && sameNotes(run.notes, goal.notes)) };
}

export const TASKS = ['story', 'reading', 'stage'] as const;
export type StrikeTask = typeof TASKS[number];
export const TASK_NAMES: Record<StrikeTask, string> = { story: '写故事', reading: '朗读', stage: '布置现场' };
export type StrikeOffer = { task: StrikeTask; needsCredit: boolean; needsRest: string | null };
export type StrikePerson = { objectId: string; persona: string; greeting: string; offers: StrikeOffer[] };
export type StrikePlan = { title: string; situation: string; people: StrikePerson[] };
export type PromiseAction = { kind: 'rest'; objectId: string } | { kind: 'credit'; objectId: string } | { kind: 'assign'; objectId: string; task: StrikeTask };
export type PromiseState = { rest: string | null; credit: string | null; tasks: Partial<Record<StrikeTask, string>>; promises: PromiseAction[] };
export type StrikeState = { promises: PromiseAction[]; journal: string[]; performance: string[] | null; curtain: number };
export type StrikeRound = { kind: 'strike'; plan: StrikePlan; state: StrikeState };
export type PlayRound = MachineRound | StrikeRound;

export function parseStrike(raw: unknown, props: readonly Prop[]): StrikePlan {
  const value = record(raw);
  if (!Array.isArray(value.people)) throw new Error('故事会缺少参加者，请重新生成。');
  const people = value.people.map(item => {
    const person = record(item), objectId = validActor(person.objectId, props);
    if (!Array.isArray(person.offers) || person.offers.length < 1 || person.offers.length > 3) throw new Error('角色需要说明愿意做哪些工作。');
    const offers = person.offers.map(item => {
      const offer = record(item), task = offer.task as StrikeTask;
      if (!TASKS.includes(task) || typeof offer.needsCredit !== 'boolean') throw new Error('工作条件没有完整生成。');
      const needsRest = offer.needsRest === null ? null : validActor(offer.needsRest, props);
      if (needsRest === objectId) throw new Error('角色不能同时要求自己休息和工作。');
      return { task, needsCredit: offer.needsCredit, needsRest };
    });
    if (new Set(offers.map(o => o.task)).size !== offers.length) throw new Error('同一件工作不能有互相冲突的条件。');
    return { objectId, persona: shortText(person.persona, 80), greeting: shortText(person.greeting, 150), offers };
  });
  exactCast(people.map(p => p.objectId), props);
  const plan = { title: shortText(value.title, 45), situation: shortText(value.situation, 220), people };
  if (!findStrikeSolution(plan)) throw new Error('大家的条件还谈不拢，AI 需要重新准备一场有解的故事会。');
  return plan;
}
export function parseActions(raw: unknown, props: readonly Prop[]): PromiseAction[] {
  if (!Array.isArray(raw) || raw.length > 5) throw new Error('提议需要一到五个明确的安排。');
  return raw.map(item => {
    const a = record(item), objectId = validActor(a.objectId, props);
    if (a.kind === 'rest' || a.kind === 'credit') return { kind: a.kind, objectId };
    if (a.kind === 'assign' && TASKS.includes(a.task as StrikeTask)) return { kind: a.kind, objectId, task: a.task as StrikeTask };
    throw new Error('这次提议包含不能执行的动作，请换一种说法。');
  });
}
// @nimi-authority: rule.odd-bureau.playground.promises
export function commitPromises(plan: StrikePlan, previous: readonly PromiseAction[], proposed: readonly PromiseAction[]): PromiseState {
  const state: PromiseState = { rest: null, credit: null, tasks: {}, promises: [] };
  const apply = (action: PromiseAction) => {
    const person = plan.people.find(p => p.objectId === action.objectId);
    if (!person) throw new Error('这件物品没有参加故事会。');
    const working = Object.values(state.tasks).filter(id => id === person.objectId).length;
    if (action.kind === 'rest') {
      if (state.rest) throw new Error('唯一的休假名额已经答应给别人了。');
      if (working || state.credit === person.objectId) throw new Error('这位已经接受工作或署名，不能再批准休假。');
      state.rest = person.objectId;
    } else if (action.kind === 'credit') {
      if (state.credit) throw new Error('唯一的署名已经许出，不能转送给别人。');
      if (state.rest === person.objectId) throw new Error('署名需要交给参加演出的伙伴。');
      state.credit = person.objectId;
    } else {
      if (!TASKS.includes(action.task)) throw new Error('没有这项工作。');
      if (state.tasks[action.task]) throw new Error('这项工作已经有人答应承担。');
      if (state.rest === person.objectId) throw new Error('已经批准休假的伙伴不能再被安排工作。');
      if (working >= 2) throw new Error('一件物品最多承担两份工作。');
      const offer = person.offers.find(o => o.task === action.task);
      if (!offer) throw new Error('这位没有答应做这份工作。');
      if (offer.needsCredit && state.credit !== person.objectId) throw new Error('这份工作需要先兑现它的署名条件。');
      if (offer.needsRest && state.rest !== offer.needsRest) throw new Error('这份工作需要先批准它指定的伙伴休息。');
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
  const name = props.find(p => p.id === action.objectId)?.label ?? '物品';
  return action.kind === 'rest' ? `批准${name}休息` : action.kind === 'credit' ? `把唯一署名给${name}` : `请${name}${TASK_NAMES[action.task]}`;
}
export function offerText(offer: StrikeOffer, props: readonly Prop[]): string {
  const conditions = [offer.needsCredit ? '要有我的署名' : '', offer.needsRest ? `先让${props.find(p => p.id === offer.needsRest)?.label}休息` : ''].filter(Boolean);
  return conditions.length ? conditions.join('；') : '我愿意直接帮忙';
}

export function parsePerformance(raw: unknown): string[] {
  const value = record(raw);
  if (!Array.isArray(value.parts) || value.parts.length !== 3) throw new Error('故事还没写成完整的三幕，可以保留安排再试一次。');
  const parts = value.parts.map(part => shortText(part, 450));
  if (parts.some(part => /署名|休假|罢工|名额|加班/.test(part))) throw new Error('童话把后台的约定混进来了。承诺仍然保留，请重新写今晚的故事。');
  return parts;
}

export function machinePrompt(props: readonly Prop[]): string {
  return `为奇物局准备一台照片里的声音怪机器。中文，俏皮具体。物品身份与坐标已确认，不可改变。每件必须选一个 allowedOps 里的操作。至少一个 source、一个 store、一个真正改变旋律的改造器。时钟的节拍、书的重复、灯的变亮、杯子的容纳，应呼应物品用途。规则名称和实际效果由程序提供，line 只是一句物品的俏皮自述，不能编新规则。source 的 melody 是1–3个音高整数，每个在0–4之间；其他物品 melody 为[]。不要返回目标或坐标。
只输出JSON：{"title":"15字内的机器名字","invitation":"一句话邀请玩家发明，50字以内","nodes":[{"objectId":"精确id","op":"合法操作","melody":[0,2],"line":"30字内角色台词"}]}。
操作语义：${JSON.stringify(OP_COPY)}。
物品：${JSON.stringify(props.map(p => ({ id: p.id, label: p.label, allowedOps: allowedOps(p.label) })))}。必须返回所有${props.length}件物品，objectId严格使用给定id。`;
}
export function strikePrompt(props: readonly Prop[]): string {
  return `为奇物局设计一场温暖好笑的物品罢工。任务固定：办完故事会，需要story写故事、reading朗读、stage布置现场三个岗位。只有一个休假名额和一个署名名额；休假的角色不能工作，署名必须给工作者；每件物品最多承担两份工作。物品身份不可改，每件提供1–3种可做的工作，体现它的用途。每个offer可要求先给自己署名(needsCredit)或先让另一件物品休息(needsRest精确id)，不要求时写false/null。所有条件必须由这些字段完整表达，不能在台词里增加隐含条件。至少一个角色想要署名、至少一个要求让朋友休息；同时提供足够无条件选择，确保三个岗位、休假和署名能同时落实。不是找坏人，最终安排可以不止一种。
只输出中文JSON：{"title":"15字内故事会标题","situation":"两句有趣的开场冲突，80字内","people":[{"objectId":"精确id","persona":"20字内性格","greeting":"40字内第一人称诉求","offers":[{"task":"story或reading或stage","needsCredit":false,"needsRest":null}]}]}。
物品清单：${JSON.stringify(props.map(p => ({ id: p.id, label: p.label })))}。每件恰好出现一次。`;
}
