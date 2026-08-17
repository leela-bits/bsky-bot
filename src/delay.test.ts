import assert from 'node:assert/strict';
import { test } from 'node:test';
import { delay } from './delay.ts';

test('should finish in the correct about of time', async () => {
  const delayTime = 50;
  const start = Date.now();
  await delay(delayTime);
  const elapsed = Date.now() - start;
  assert.ok(Math.abs(elapsed - delayTime) < 5);
});

test('can be aborted', { expectFailure: 'aborted' }, async () => {
  const delayTime = 50;
  await delay(delayTime, AbortSignal.timeout(10));
});

test('can be aborted early', { expectFailure: 'aborted' }, async () => {
  const delayTime = 50;
  await delay(delayTime, AbortSignal.abort());
});
