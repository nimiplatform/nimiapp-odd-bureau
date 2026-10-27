import assert from 'node:assert/strict';
import test from 'node:test';
import { createOddBureauNavigation, validateOddBureauDestination } from '../src/odd-bureau/navigation.ts';

test('Odd Bureau admits only product destinations and exact round references', () => {
  for (const id of ['home', 'setup', 'mystery']) assert.deepEqual(validateOddBureauDestination({ id }), { id });
  assert.deepEqual(validateOddBureauDestination({ id: 'round', roundId: 'saved-round' }), { id: 'round', roundId: 'saved-round' });
  for (const value of [null, { id: 'image.generate' }, { id: 'round' }, { id: 'round', roundId: '' },
    { id: 'round', roundId: 'saved-round', photo: {} }, { id: 'home', roundId: 'saved-round' }]) {
    assert.throws(() => validateOddBureauDestination(value));
  }
});

test('settings and mystery share the native back/forward controller without persisting position', async () => {
  const navigation = createOddBureauNavigation();
  await navigation.push({ id: 'round', roundId: 'saved-round' });
  await navigation.push({ id: 'setup' });
  await navigation.back();
  assert.deepEqual(navigation.getSnapshot().current.destination, { id: 'round', roundId: 'saved-round' });
  await navigation.forward();
  assert.deepEqual(navigation.getSnapshot().current.destination, { id: 'setup' });
  await navigation.push({ id: 'mystery' });
  await navigation.back();
  assert.equal(navigation.getSnapshot().current.destination.id, 'setup');
  assert.deepEqual(createOddBureauNavigation().getSnapshot().current.destination, { id: 'home' });
});

test('a stale business round cannot be reopened through native history', async () => {
  let roundId = 'first-round';
  const navigation = createOddBureauNavigation(({ to }) => to.id === 'round' && to.roundId !== roundId ? 'cancel' : 'allow');
  await navigation.push({ id: 'round', roundId });
  await navigation.push({ id: 'home' });
  roundId = 'new-photo-round';
  assert.equal((await navigation.back()).status, 'cancelled');
  assert.deepEqual(navigation.getSnapshot().current.destination, { id: 'home' });
});
