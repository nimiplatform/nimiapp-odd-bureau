import assert from 'node:assert/strict';
import test from 'node:test';
import { allowedOps, commitPromises, editMachinePath, findStrikeSolution, initialMachine, lineCost, machineChallenge, parseActions, parseMachine, parsePerformance, parsePlaySave, parseStrike, runMachine, simulateMachine, strikeReady } from '../src/odd-bureau/play-rules.ts';

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
    { objectId: 'clock', persona: 'punctual', offers: [{ task: 'reading', needsCredit: false, needsRest: 'lamp' }] },
    { objectId: 'book', persona: 'proud', offers: [{ task: 'story', needsCredit: true, needsRest: null }] },
    { objectId: 'lamp', persona: 'tired', offers: [{ task: 'stage', needsCredit: false, needsRest: null }] },
    { objectId: 'cup', persona: 'helpful', offers: [{ task: 'stage', needsCredit: false, needsRest: null }] },
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

const locatedProps = props.map((prop, i) => ({ ...prop, id: `object-${i + 1}` }));
const locatedId = id => locatedProps[props.findIndex(p => p.id === id)].id;
const savedMachinePlan = { ...machine, nodes: machine.nodes.map(n => ({ ...n, objectId: locatedId(n.objectId) })) };
const savedStrikePlan = { ...strike, people: strike.people.map(p => ({ ...p, objectId: locatedId(p.objectId), offers: p.offers.map(o => ({ ...o, needsRest: o.needsRest && locatedId(o.needsRest) })) })) };
const savedRound = round => ({ id: 'saved-round', photoPath: 'play-scenes/saved-photo.jpg', photoName: '照片', photoSource: 'upload', props: locatedProps, round });
const machineSave = state => savedRound({ kind: 'machine', plan: savedMachinePlan, state });
const strikeSave = state => savedRound({ kind: 'strike', plan: savedStrikePlan, state });

test('machine saves restore partial edits, stored notes, and completed challenges after later experiments', () => {
  assert.deepEqual(parsePlaySave(machineSave(initialMachine())), machineSave(initialMachine()));
  const goal = machineChallenge(savedMachinePlan, locatedProps);
  const solved = runMachine(savedMachinePlan, locatedProps, { ...initialMachine(), path: goal.path });
  const experiment = runMachine(savedMachinePlan, locatedProps, { ...solved, path: [locatedId('clock'), locatedId('cup')] });
  const partial = { ...experiment, path: [locatedId('book')], stored: { [locatedId('cup')]: [] } };
  for (const state of [solved, experiment, partial]) {
    const save = machineSave(state);
    assert.deepEqual(parsePlaySave(JSON.parse(JSON.stringify(save))), save);
  }
  const forgedTrace = structuredClone(machineSave(experiment));
  forgedTrace.round.state.lastRun.notes = [];
  forgedTrace.round.state.lastRun.trace = [];
  assert.deepEqual(parsePlaySave(forgedTrace).round.state.lastRun, experiment.lastRun);
});

test('saved playground geometry and photo identity are validated without coercion', () => {
  for (const coordinate of [null, false, '', '0.1', undefined, NaN, Infinity, -0.1, 1.1]) {
    const save = machineSave(initialMachine());
    save.props = save.props.map((p, i) => i ? p : { ...p, box: { ...p.box, x1: coordinate } });
    assert.throws(() => parsePlaySave(save), `x1: ${String(coordinate)}`);
  }
  for (const id of ['__proto__', 'constructor', 'toString', 'other-object']) {
    const save = machineSave(initialMachine());
    save.props = save.props.map((p, i) => i ? p : { ...p, id });
    assert.throws(() => parsePlaySave(save), id);
  }
  for (const photoPath of ['current-case.json', '../photo.jpg', 'play-scenes/../photo.jpg', '/play-scenes/photo.jpg']) {
    assert.throws(() => parsePlaySave({ ...machineSave(initialMachine()), photoPath }), photoPath);
  }
  for (const photoSource of [null, ['upload'], {}, 'unknown']) {
    assert.throws(() => parsePlaySave({ ...machineSave(initialMachine()), photoSource }));
  }
});

test('saved machines cannot claim notes or success before a run or contradict their only run', () => {
  const direct = runMachine(savedMachinePlan, locatedProps, { ...initialMachine(), path: [locatedId('clock'), locatedId('cup')] });
  const solved = runMachine(savedMachinePlan, locatedProps, { ...initialMachine(), path: machineChallenge(savedMachinePlan, locatedProps).path });
  for (const state of [
    { ...initialMachine(), solved: true },
    { ...initialMachine(), stored: { [locatedId('cup')]: [{ pitch: 0, beats: 1 }] } },
    { ...direct, runs: 0 },
    { ...direct, lastRun: null },
    { ...direct, solved: true },
    { ...solved, solved: false },
    { ...direct, stored: { [locatedId('cup')]: Array(33).fill({ pitch: 0, beats: 1 }) } },
    { ...direct, stored: { [locatedId('clock')]: [{ pitch: 0, beats: 1 }] } },
  ]) assert.throws(() => parsePlaySave(machineSave(state)));
});

test('strike saves retain valid commitments and reject rewritten promise chronology or premature performance', () => {
  const promises = commitPromises(savedStrikePlan, [], findStrikeSolution(savedStrikePlan)).promises;
  const initial = { promises: [], journal: [], performance: null, curtain: 0 };
  const agreed = { ...initial, promises };
  const performed = { ...agreed, performance: ['杯子想看海。', '书本折出一只小船。', '叶子成了帆。'], curtain: 2 };
  for (const state of [initial, agreed, performed, { ...performed, curtain: 3 }, { ...initial, promises: [{ kind: 'rest', objectId: locatedId('book') }] }]) {
    assert.deepEqual(parsePlaySave(strikeSave(state)), strikeSave(state));
  }
  for (const state of [
    { ...agreed, promises: [...promises.filter(a => a.kind === 'assign'), ...promises.filter(a => a.kind !== 'assign')] },
    { ...initial, curtain: 1 },
    { ...performed, promises: [] },
    { ...performed, curtain: 4 },
  ]) assert.throws(() => parsePlaySave(strikeSave(state)));
});
