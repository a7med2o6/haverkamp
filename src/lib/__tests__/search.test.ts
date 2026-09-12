import assert from 'node:assert/strict';
import { digitsOnly, normalizePlate } from '../search';

function runRegressionTests() {
  // الشكلان العربيان للأرقام يتحوّلان إلى أرقام لاتينية
  {
    assert.equal(normalizePlate('٠١٢٣٤٥٦٧٨٩'), '0123456789');
    assert.equal(normalizePlate('۰۱۲۳۴۵۶۷۸۹'), '0123456789');
  }

  // فواصل اللوحة تُحذف والحروف اللاتينية تُوحّد إلى الكبيرة
  {
    assert.equal(normalizePlate('  kuـw_ 12-٣٤۵  '), 'KUW12345');
  }

  // النص الفارغ أو المكوّن من فواصل فقط يعود فارغاً
  {
    assert.equal(normalizePlate('   -ـ_  '), '');
    assert.equal(normalizePlate(''), '');
  }

  // استخراج الأرقام يحتفظ بالأرقام المحوّلة ويحذف ما عداها
  {
    assert.equal(digitsOnly(' KU-١٢_۳۴ abc '), '1234');
    assert.equal(digitsOnly('لا توجد أرقام'), '');
  }

  console.log('✅ All search normalization regression tests passed successfully!');
}

runRegressionTests();
