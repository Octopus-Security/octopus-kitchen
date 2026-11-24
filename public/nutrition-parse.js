'use strict';
/**
 * Turns the text OCR read off a nutrition label into form values. Pure: no DOM, no
 * network. Loaded by the browser and required by the tests. Anything doubtful becomes
 * a warning for the person to check, never a silent value.
 */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make();
  else root.NutritionParse = make();
})(typeof self !== 'undefined' ? self : this, function () {
  // Letters OCR commonly reads for digits, only where a number is expected.
  const digits = s => s.replace(/[Oo]/g, '0').replace(/[lI|]/g, '1').replace(',', '.');
  const NUM = '(<\\s*|less\\s+than\\s+)?([0-9OolI|]+(?:[.,][0-9OolI|]+)?)';

  /** The first amount after `label` on its line. */
  function amount(lines, label, unit, label2) {
    const re = new RegExp(label + '[^0-9A-Za-z<\\n]{0,4}\\s*' + NUM + '\\s*(' + unit + ')?(?![A-Za-z])', 'i');
    for (const line of lines) {
      const m = re.exec(line);
      if (!m || !/[0-9Oo]/.test(m[2])) continue;
      const value = Number(digits(m[2]));
      if (!Number.isFinite(value)) continue;
      const w = [];
      if (m[1]) w.push(`${label2}: the label says less than ${value}.`);
      // "8g" is often read as "89": a bare number ending in 9 is the tell.
      else if (!m[3] && unit !== 'x^' && /9$/.test(m[2]) && m[2].length > 1) {
        w.push(`${label2}: read as ${value} with no unit; the last 9 may be a "g".`);
      }
      return { value, warnings: w };
    }
    return null;
  }

  function parse(text) {
    const lines = String(text || '').replace(/[‘’]/g, "'").split(/\r?\n/)
      .map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const out = { fields: {}, custom: [], warnings: [] };
    const put = (key, hit) => { if (hit) { out.fields[key] = hit.value; out.warnings.push(...hit.warnings); } };

    for (let i = 0; i < lines.length; i++) {
      const m = /serving\s*size[^A-Za-z0-9(]*(.*)$/i.exec(lines[i]);
      if (!m) continue;
      // The measure sometimes lands on the next line, next to nothing else.
      let s = m[1].trim() || (/\d/.test(lines[i + 1] || '') && !/calories|amount|servings/i.test(lines[i + 1]) ? lines[i + 1] : '');
      s = s.replace(/\bservings?\s*per.*$/i, '').trim();
      if (s) out.fields.servingSize = s.slice(0, 60);
      if (/\(\d+9\)/.test(s)) out.warnings.push('Serving size: the last 9 may be a "g".');
      break;
    }
    for (const line of lines) {
      let m = /(?:about\s+)?([0-9OolI|]+(?:[.,][0-9]+)?)\s+servings?\s+per/i.exec(line)
        || /servings?\s+per\s+(?:container|package|bottle|pack)?[^0-9]{0,12}([0-9]+(?:[.,][0-9]+)?)/i.exec(line);
      if (m) { out.fields.servings = Number(digits(m[1])); break; }
    }
    for (let i = 0; i < lines.length; i++) {
      if (/calories\s+from/i.test(lines[i]) && !/^calories\s+[0-9OolI|]+\s+calories\s+from/i.test(lines[i])) continue;
      let m = /(?:^|[^a-z])calories[^0-9A-Za-z]{0,6}([0-9OolI|]{1,4})(?![A-Za-z0-9])/i.exec(lines[i]);
      if (!m && /^calories\W*$/i.test(lines[i])) m = /^([0-9OolI|]{1,4})$/.exec(lines[i + 1] || '');
      if (!m) m = /energy.*?([0-9]{1,4})\s*kcal/i.exec(lines[i]);
      if (m && /[0-9Oo]/.test(m[1])) { out.fields.kcal = Number(digits(m[1])); break; }
    }
    put('protein', amount(lines, '(?:^|[^a-z])protein', 'g', 'Protein'));
    put('carbs', amount(lines, 'total\\s+carb(?:ohydrate)?s?', 'g', 'Carbs')
      || amount(lines, '^carb(?:ohydrate)?s?', 'g', 'Carbs'));
    put('fat', amount(lines, 'total\\s+fat', 'g', 'Fat') || amount(lines, '^fat', 'g', 'Fat'));

    for (const [name, label, unit] of [
      ['Saturated fat', 'saturated\\s+fat', 'g'], ['Trans fat', 'trans\\s+fat', 'g'],
      ['Cholesterol', 'cholesterol', 'mg'], ['Sodium', 'sodium', 'mg'],
      ['Fiber', '(?:dietary\\s+)?fib(?:er|re)', 'g'], ['Total sugars', '(?:total\\s+|^)sugars', 'g'],
    ]) {
      const hit = amount(lines, label, unit, name);
      if (hit) { out.custom.push({ name, value: `${hit.value} ${unit}` }); out.warnings.push(...hit.warnings); }
    }
    for (const line of lines) {
      const m = /([0-9OolI|]+(?:[.,][0-9]+)?)\s*g\s+added\s+sugars/i.exec(line);
      if (m && /[0-9Oo]/.test(m[1])) { out.custom.push({ name: 'Added sugars', value: `${Number(digits(m[1]))} g` }); break; }
    }

    const f = out.fields;
    if ([f.kcal, f.protein, f.carbs, f.fat].every(v => v != null)) {
      const sum = 4 * f.protein + 4 * f.carbs + 9 * f.fat;
      if (Math.abs(sum - f.kcal) > Math.max(25, 0.3 * Math.max(sum, f.kcal))) {
        out.warnings.push(`Calories (${f.kcal}) do not match the macros (about ${Math.round(sum)}). Check each number.`);
      }
    }
    for (const [k, word] of [['kcal', 'calories'], ['protein', 'protein'], ['carbs', 'carbs'], ['fat', 'fat'], ['servingSize', 'serving size']]) {
      if (f[k] == null) out.warnings.push(`Could not read ${word}.`);
    }
    return out;
  }
  return { parse };
});
