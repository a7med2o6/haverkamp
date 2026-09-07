import assert from 'node:assert/strict';
import { mock } from 'node:test';
import {
  getWeightedRandomIndex,
  normalizeWinnerDrawState,
} from '../types';

function runRegressionTests() {
  // Test 1: Zero-weight items never selected when positive weights exist
  {
    const prizes = ['Zero Prize 1', 'Positive Prize', 'Zero Prize 2'];
    const weights = [0, 100, 0];
    // Exercise exact RNG boundaries; random sampling almost never catches zero.
    for (const value of [0, 1, 0x80000000, 0xffffffff]) {
      const rng = mock.method(crypto, 'getRandomValues', (array: Uint32Array) => {
        array.fill(value);
        return array;
      });
      try {
        assert.equal(getWeightedRandomIndex(prizes, weights), 1);
      } finally {
        rng.mock.restore();
      }
    }
  }

  // Test 2: Fallback to uniform random draw when all weights are zero
  {
    const prizes = ['Prize A', 'Prize B', 'Prize C'];
    const weights = [0, 0, 0];
    for (const value of [0, 1, 2]) {
      const rng = mock.method(crypto, 'getRandomValues', (array: Uint32Array) => {
        array.fill(value);
        return array;
      });
      try {
        assert.equal(getWeightedRandomIndex(prizes, weights), value);
      } finally {
        rng.mock.restore();
      }
    }
  }

  for (const invalid of [undefined, null, '', NaN, Infinity, 'large']) {
    assert.equal(normalizeWinnerDrawState({ wheelFontSize: invalid }).wheelFontSize, 18);
  }

  // Test 3: Pairwise normalization by original index before filtering empty names
  {
    const rawState = {
      prizes: ['Valid Prize A', '   ', 'Valid Prize B'],
      prizeWeights: [10, 999, 50],
      wheelFontSize: 50, // Should clamp to 32
    };
    const normalized = normalizeWinnerDrawState(rawState);
    assert.deepEqual(normalized.prizes, ['Valid Prize A', 'Valid Prize B']);
    assert.deepEqual(normalized.prizeWeights, [10, 50]);
    assert.equal(normalized.wheelFontSize, 32);
  }

  // Test 4: Clamping wheelFontSize lower bound
  {
    const rawState = { wheelFontSize: 2 };
    const normalized = normalizeWinnerDrawState(rawState);
    assert.equal(normalized.wheelFontSize, 10);
  }

  // Test 5: Preserve empty arrays in normalization
  {
    const rawState = { prizes: [], customers: [] };
    const normalized = normalizeWinnerDrawState(rawState);
    assert.deepEqual(normalized.prizes, []);
    assert.deepEqual(normalized.customers, []);
  }

  console.log('✅ All winner draw regression tests passed successfully!');
}

runRegressionTests();
