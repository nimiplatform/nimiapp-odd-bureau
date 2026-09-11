import assert from 'node:assert/strict';
import test from 'node:test';
import { allowedOps, commitPromises, editMachinePath, findStrikeSolution, initialMachine, lineCost, machineChallenge, parseActions, parseMachine, parsePerformance, parseStrike, runMachine, simulateMachine, strikeReady } from '../src/odd-bureau/play-rules.ts';

// Synthetic rule examples only. Live acceptance uses actual Runtime generation.
const props = [
  { id: 'clock', label: '时钟', box: { x1: .05, y1: .1, x2: .15, y2: .3 } },
  { id: 'book', label: '书本', box: { x1: .3, y1: .1, x2: .45, y2: .3 } },
  { id: 'lamp', label: '灯', box: { x1: .55, y1: .1, x2: .65, y2: .3 } },
  { id: 'cup', label: '杯子', box: { x1: .8, y1: .1, x2: .9, y2: .3 } },
];
const machine = {
  title: 'A strange machine', invitation: 'Connect these objects.', nodes: [
    { objectId: 'clock', op: 'source', melody: [0, 2], line: 'tick' },
    { objectId: 'book', op: 'echo', melody: [], line: 'again' },
    { objectId: 'lamp', op: 'raise', melody: [], line: 'brighter' },
    { objectId: 'cup', op: 'store', melody: [], line: 'keep it' },
  ],
};
test('rerouting the same real anchors changes a predictable melody; input rules stay immutable', () => {
  const before = structuredClone(machine);
  assert.deepEqual(simulateMachine(machine, props, ['clock', 'book', 'lamp', 'cup']).notes.map(n => n.pitch), [2, 4, 2, 4]);
  assert.deepEqual(simulateMachine(machine, props, ['clock', 'lamp', 'cup']).notes.map(n => n.pitch), [2, 4]);
  assert.deepEqual(simulateMachine(machine, props, ['clock', 'cup']).notes.map(n => n.pitch), [0, 2]);
  assert.deepEqual(machine, before);
  assert.notEqual(lineCost(['clock', 'book', 'cup'], props), lineCost(['clock', 'book', 'cup'], props.map(p => p.id === 'book' ? { ...p, box: { x1: .3, y1: .8, x2: .45, y2: .95 } } : p)));
});
test('a challenge has a valid witness route and cannot be won by an unrelated direct connection', () => {
  const plan = parseMachine(machine, props), goal = machineChallenge(plan, props);
  const empty = initialMachine();
  const direct = runMachine(plan, props, { ...empty, path: ['clock', 'cup'] });
  assert.equal(direct.solved, false);
  const solved = runMachine(plan, props, { ...empty, path: goal.path });
  assert.equal(solved.solved, true);
  assert.deepEqual(empty.stored, {});
  assert.equal(runMachine(plan, props, { ...solved, path: ['clock', 'cup'] }).solved, true);
});
test('containers accumulate actual notes, reject overflow atomically, and paths cannot loop', () => {
  let state = { ...initialMachine(), path: ['clock', 'book', 'cup'] };
  for (let i = 0; i < 8; i++) state = runMachine(machine, props, state);
  assert.equal(state.stored.cup.length, 32);
  assert.throws(() => runMachine(machine, props, state), /装不下/);
  assert.equal(state.runs, 8);
  assert.throws(() => simulateMachine(machine, props, ['clock', 'book', 'book', 'cup']));
  assert.throws(() => simulateMachine(machine, props, ['clock', 'unknown', 'cup']));
  assert.deepEqual(editMachinePath(machine, ['clock', 'book', 'cup'], 'lamp'), ['clock', 'book', 'lamp']);
});
test('AI cannot invent an operation, reclassify a container, or omit a device', () => {
  assert.deepEqual(allowedOps('杯子'), ['store']);
  assert.throws(() => parseMachine({ ...machine, nodes: machine.nodes.map(n => n.objectId === 'cup' ? { ...n, op: 'source', melody: [1] } : n) }, props));
  assert.throws(() => parseMachine({ ...machine, nodes: machine.nodes.slice(1) }, props));
  assert.throws(() => parseMachine({ ...machine, nodes: machine.nodes.map(n => ({ ...n, op: 'anything-the-AI-wants' })) }, props));
});

const strike = {
  title: 'The story meeting', situation: 'Someone needs a night off.', people: [
    { objectId: 'clock', persona: 'punctual', greeting: 'I can read.', offers: [{ task: 'reading', needsCredit: false, needsRest: 'lamp' }] },
    { objectId: 'book', persona: 'proud', greeting: 'Put my name on it.', offers: [{ task: 'story', needsCredit: true, needsRest: null }] },
    { objectId: 'lamp', persona: 'tired', greeting: 'A rest, please.', offers: [{ task: 'stage', needsCredit: false, needsRest: null }] },
    { objectId: 'cup', persona: 'helpful', greeting: 'I can decorate.', offers: [{ task: 'stage', needsCredit: false, needsRest: null }] },
  ],
};
test('language proposals and direct actions share concrete prerequisites and irreversible allocations', () => {
  const plan = parseStrike(strike, props);
  assert.throws(() => commitPromises(plan, [], [{ kind: 'assign', objectId: 'clock', task: 'reading' }]), /休息/);
  assert.throws(() => commitPromises(plan, [], [{ kind: 'assign', objectId: 'book', task: 'story' }]), /署名/);
  const rest = commitPromises(plan, [], [{ kind: 'rest', objectId: 'lamp' }]);
  assert.throws(() => commitPromises(plan, rest.promises, [{ kind: 'assign', objectId: 'lamp', task: 'stage' }]), /休假/);
  assert.throws(() => commitPromises(plan, rest.promises, [{ kind: 'rest', objectId: 'cup' }]));
  assert.equal(rest.promises.length, 1);
  const credited = commitPromises(plan, rest.promises, [{ kind: 'credit', objectId: 'book' }]);
  assert.throws(() => commitPromises(plan, credited.promises, [{ kind: 'credit', objectId: 'clock' }]));
});
test('a valid arrangement honors the rest and credit promises and fulfils three responsibilities', () => {
  const plan = parseStrike(strike, props), actions = findStrikeSolution(plan);
  assert.ok(actions);
  const state = commitPromises(plan, [], actions);
  assert.equal(strikeReady(state), true);
  assert.equal(state.rest, 'lamp');
  assert.equal(state.credit, 'book');
  assert.equal(state.tasks.reading, 'clock');
  assert.equal(state.tasks.stage, 'cup');
  assert.ok(!Object.values(state.tasks).includes(state.rest));
  assert.deepEqual(commitPromises(plan, state.promises, []), state);
});
test('impossible actor demands and invented proposal actions are rejected before they can affect play', () => {
  assert.throws(() => parseStrike({ ...strike, people: strike.people.map(p => ({ ...p, offers: p.offers.map(o => ({ ...o, needsCredit: true })) })) }, props), /有解/);
  assert.throws(() => parseActions([{ kind: 'revoke', objectId: 'book' }], props));
  assert.throws(() => parseActions([{ kind: 'rest', objectId: 'invisible-cat' }], props));
  assert.throws(() => commitPromises(strike, [], [{ kind: 'rest', objectId: 'lamp' }, { kind: 'assign', objectId: 'book', task: 'story' }]));
  assert.equal(strikeReady(commitPromises(strike, [], [])), false);
});
test('a performed tale cannot reopen the credits or leave allocation', () => {
  assert.throws(() => parsePerformance({ parts: ['杯子唱歌。', '时钟打拍。', '盆栽说：所以署名归我。'] }), /后台/);
  assert.throws(() => parsePerformance({ parts: ['一幕', '二幕'] }));
  assert.deepEqual(parsePerformance({ parts: ['杯子想看海。', '书本折出了一只小船。', '盆栽说：带上我的叶子当帆吧。'] }), ['杯子想看海。', '书本折出了一只小船。', '盆栽说：带上我的叶子当帆吧。']);
});
test('promises that foreclose completion are detectable without revoking them', () => {
  const valid = parseStrike(strike, props);
  const deadEnd = commitPromises(valid, [], [{ kind: 'rest', objectId: 'book' }]);
  assert.equal(findStrikeSolution(valid, deadEnd.promises), null);
  assert.equal(deadEnd.rest, 'book');
  const possible = commitPromises(valid, [], [{ kind: 'rest', objectId: 'lamp' }]);
  assert.ok(findStrikeSolution(valid, possible.promises));
});
