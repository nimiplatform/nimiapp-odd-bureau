import assert from 'node:assert/strict';
import test from 'node:test';
import { hitProp, propsFromLocate, parseMystery, canAccuse, dialoguePrompt } from '../src/odd-bureau/game.ts';

const props = [
  { id: 'object-1', label: 'cup', box: { x1: .1, y1: .2, x2: .3, y2: .5 } },
  { id: 'object-2', label: 'clock', box: { x1: .5, y1: .1, x2: .7, y2: .4 } },
  { id: 'object-3', label: 'book', box: { x1: .75, y1: .6, x2: .95, y2: .8 } },
];
// Synthetic data tests parsing and game rules only; it never enters the product.
const mystery = {
  title: 'The missing minute', incident: 'Who hid the minute?', opening: 'Three objects are arguing.',
  culpritId: 'object-2', resolution: 'The clock hid the minute.', decisiveEvidenceIds: ['object-1', 'object-3'],
  characters: props.map(p => ({ objectId: p.id, name: p.label, persona: 'curious', greeting: 'Hello.', testimony: `Evidence from ${p.label}.`, clueTitle: 'A clue', suggestedQuestion: 'What happened?' })),
};

test('photo coordinates select the real object and favor the smaller object in an overlap', () => {
  assert.equal(hitProp(props, .2, .3)?.id, 'object-1');
  assert.equal(hitProp(props, .45, .7), undefined);
  const nested = { id: 'nested', label: 'key', box: { x1: .15, y1: .25, x2: .2, y2: .3 } };
  assert.equal(hitProp([...props, nested], .18, .28)?.id, 'nested');
});
test('locate inventory preserves actual boxes and excludes duplicate hits without fabricating locations', () => {
  const locations = props.map(p => ({ type: 'box', ...p.box, label: p.label }));
  const result = propsFromLocate({ imageArtifactId: 'test-image', width: 1000, height: 700, locations: [locations[0], locations[0], locations[1], locations[2]] });
  assert.deepEqual(result, props);
  assert.throws(() => propsFromLocate({ imageArtifactId: 'test-image', width: 1000, height: 700, locations: [] }));
  assert.throws(() => propsFromLocate({ imageArtifactId: 'test-image', width: 1000, height: 700, locations: [{ ...locations[0], x1: -1 }, ...locations.slice(1)] }));
});
test('a case cannot introduce an unseen culprit, duplicate a character or invent an evidence reference', () => {
  assert.deepEqual(parseMystery(JSON.stringify(mystery), props), mystery);
  for (const invalid of [
    { ...mystery, culpritId: 'unseen-object' },
    { ...mystery, characters: [...mystery.characters.slice(0, 2), mystery.characters[0]] },
    { ...mystery, decisiveEvidenceIds: ['object-1', 'unseen-object'] },
    { ...mystery, decisiveEvidenceIds: ['object-1', 'object-1'] },
    { ...mystery, characters: mystery.characters.slice(0, 2) },
  ]) assert.throws(() => parseMystery(JSON.stringify(invalid), props));
});
test('story generation cannot rename a located cup into another kind of object', () => {
  const renamed = { ...mystery, characters: mystery.characters.map(c => ({ ...c, name: 'a spaceship' })) };
  assert.deepEqual(parseMystery(JSON.stringify(renamed), props).characters.map(c => c.name), ['cup', 'clock', 'book']);
});
test('accusation requires evidence; free interrogation does not receive the hidden solution', () => {
  const session = { mystery, props, evidence: ['object-1'], messages: {}, discovered: ['object-1'] };
  assert.equal(canAccuse(session), false);
  assert.equal(canAccuse({ ...session, evidence: ['object-1', 'object-3'] }), true);
  const prompt = dialoguePrompt(session, mystery.characters[0], 'Who did it?');
  assert.ok(prompt.includes(mystery.characters[0].testimony));
  assert.ok(!prompt.includes(mystery.resolution));
  assert.ok(!prompt.includes('culpritId'));
});
