import test from 'node:test';
import assert from 'node:assert/strict';
import {MODEL_FILES, createModelDownloadProgress} from '../public/vision-progress.js';

test('interleaved file downloads report one byte-weighted, nondecreasing percentage', () => {
  const update = createModelDownloadProgress();
  const files = Object.keys(MODEL_FILES);
  const total = Object.values(MODEL_FILES).reduce((a, b) => a + b, 0);
  let previous = 0;
  for (const fraction of [0.1, 0.4, 0.8, 1]) {
    for (const file of files) {
      const state = update({status:'progress', file, loaded:MODEL_FILES[file]*fraction});
      assert.equal(state.total, total);
      assert.ok(state.percent >= previous);
      assert.ok(state.percent < 100, 'Do not finish until every file is ready');
      previous = state.percent;
    }
  }
  for (const file of files) {
    const state = update({status:'done', file});
    assert.ok(state.percent >= previous);
    previous = state.percent;
  }
  assert.equal(previous, 100);
});

test('completed or cached files retain progress when another file starts or repeats', () => {
  const update = createModelDownloadProgress();
  const [first, second, third] = Object.keys(MODEL_FILES);
  const cached = update({status:'done', file:first});
  const initial = update({status:'progress', file:second, loaded:1});
  assert.ok(initial.percent >= cached.percent);
  const halfway = update({status:'progress', file:second, loaded:MODEL_FILES[second]/2});
  assert.deepEqual(update({status:'progress', file:second, loaded:1}), halfway);
  assert.equal(update({status:'progress', file:'config.json', loaded:100}), null);
  update({status:'done', file:second});
  const complete = update({status:'done', file:third});
  assert.equal(complete.complete, true);
  assert.equal(complete.percent, 100);
  assert.equal(complete.loaded, complete.total);
});
