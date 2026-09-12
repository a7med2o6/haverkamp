import assert from 'node:assert/strict';
import { mock } from 'node:test';
import {
  getWeightedRandomIndex,
  normalizeWinnerDrawState,
} from '../types';
import { fitWheelLabel } from '../label-geometry';

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

  // Mock text width measurer for geometry tests: 0.6px per char per font unit
  const mockMeasure = (str: string, font: number) => str.length * font * 0.6;

  // Test 6: Label geometry - short text fits in 1 line at preferred font size
  {
    const layout = fitWheelLabel(mockMeasure, 'أحمد علي', 150, 40, 18, 8);
    assert.equal(layout.lines.length, 1);
    assert.equal(layout.lines[0], 'أحمد علي');
    assert.equal(layout.fontSize, 18);
  }

  // Test 7: Label geometry - multi-word text wraps into 2 lines when 1 line exceeds maxRadialWidth
  {
    // 'عازل حراري كامل' (15 chars) -> 15 * 18 * 0.6 = 162px > 120px maxRadialWidth
    const layout = fitWheelLabel(mockMeasure, 'عازل حراري كامل', 120, 50, 18, 8);
    assert.equal(layout.lines.length, 2);
    assert.equal(layout.lines.join(' '), 'عازل حراري كامل');
    assert.equal(layout.fontSize, 18);
  }

  // Test 8: Label geometry - font size reduces when 2 lines at preferred font size exceed bounds
  {
    // 'تظليل زجاج أمامي عازل حراري' (27 chars) -> split 'تظليل زجاج' (11) and 'أمامي عازل حراري' (16)
    // At fSize=18, 16 * 18 * 0.6 = 172.8px > 100px maxRadialWidth. Requires reducing font.
    const layout = fitWheelLabel(mockMeasure, 'تظليل زجاج أمامي عازل حراري', 100, 40, 18, 8);
    assert.equal(layout.lines.length, 2);
    assert.ok(layout.fontSize < 18);
    assert.ok(layout.fontSize >= 8);
    assert.ok(mockMeasure(layout.lines[0], layout.fontSize) <= 100);
    assert.ok(mockMeasure(layout.lines[1], layout.fontSize) <= 100);
  }

  /*
    الارتفاع هو المقيس لا المقاس: اختبارٌ يتحقّق من صغر الخط وحده يمرّ
    على سطرين مرسومين خارج قطاعهما. فتُحسب كتلة النصّ كما تُرسَم.
  */
  const blockHeight = (l: { lines: string[]; fontSize: number; lineHeight: number }) =>
    l.lines.length > 1 ? l.fontSize + (l.lines.length - 1) * l.lineHeight : l.fontSize;

  // Test 9: قطاع ضيّق — السطران لا يسعان فيه فيسقطان إلى سطر داخل حدّه
  {
    const layout = fitWheelLabel(mockMeasure, 'عازل حراري', 200, 12, 18, 8);
    assert.equal(layout.lines.length, 1, 'القطاع الضيّق لا يحتمل سطرين');
    assert.ok(blockHeight(layout) <= 12, `تجاوز الارتفاع: ${blockHeight(layout)} > 12`);
  }

  // Test 9b: اسمٌ يسع سطراً واحداً ولا يسع سطرين — لا يُقصّ ولا يفيض
  {
    // «زيت محرك» عرضه عند خط 8 يساوي 38.4 فيسع 200، وسطراه 17.2 لا يسعان 14
    const layout = fitWheelLabel(mockMeasure, 'زيت محرك', 200, 14, 18, 8);
    assert.equal(layout.lines.length, 1);
    assert.equal(layout.lines[0], 'زيت محرك', 'كان يسع كاملاً فلا يُقصّ');
    assert.ok(blockHeight(layout) <= 14, `تجاوز الارتفاع: ${blockHeight(layout)} > 14`);
  }

  // Test 9c: كل تخطيطٍ يبقى داخل حدّي قطاعه مهما ضاق
  {
    const names = ['زيت محرك', 'عازل حراري كامل', 'تظليل زجاج أمامي', 'غسيل', 'حماية نانو سيراميك شاملة'];
    for (const transverse of [10, 14, 20, 34, 60]) {
      for (const name of names) {
        const l = fitWheelLabel(mockMeasure, name, 120, transverse, 18, 8);
        assert.ok(
          blockHeight(l) <= transverse,
          `«${name}» عند ${transverse}: ارتفاع ${blockHeight(l)}`
        );
        for (const line of l.lines) {
          assert.ok(
            mockMeasure(line, l.fontSize) <= 120,
            `«${name}» عند ${transverse}: عرض السطر «${line}»`
          );
        }
      }
    }
  }

  // Test 10: Label geometry - truncation with '...' when text exceeds bounds even at minFontSize
  {
    const veryLongName = 'خدمة حماية النانو سيراميك الشاملة للسيارات الفارهة والمعالجة الحرارية';
    const layout = fitWheelLabel(mockMeasure, veryLongName, 60, 40, 18, 8);
    assert.equal(layout.lines.length, 2);
    assert.ok(layout.lines[1].endsWith('...'));
    assert.equal(layout.fontSize, 8);
  }

  console.log('✅ All winner draw regression tests passed successfully!');
}

runRegressionTests();
