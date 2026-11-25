'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parse } = require('../public/nutrition-parse');
const { OCR_DIR } = require('../lib/pantry-routes');

const US = `Nutrition Facts
8 servings per container
Serving size 2/3 cup (55g)
Amount per serving
Calories 230
% Daily Value*
Total Fat 8g 10%
Saturated Fat 1g 5%
Trans Fat 0g
Cholesterol 0mg 0%
Sodium 160mg 7%
Total Carbohydrate 37g 13%
Dietary Fiber 4g 14%
Total Sugars 12g
Includes 10g Added Sugars 20%
Protein 3g
Vitamin D 2mcg 10%`;

test('a clean US label', () => {
  const r = parse(US);
  assert.deepStrictEqual(r.fields, { servingSize: '2/3 cup (55g)', servings: 8, kcal: 230, protein: 3, carbs: 37, fat: 8 });
  assert.deepStrictEqual(r.warnings, []);
  const c = Object.fromEntries(r.custom.map(x => [x.name, x.value]));
  assert.strictEqual(c.Sodium, '160 mg');
  assert.strictEqual(c['Saturated fat'], '1 g');
  assert.strictEqual(c['Added sugars'], '10 g');
  assert.strictEqual(c.Fiber, '4 g');
});

test('letters read for digits, and an old-style label', () => {
  const r = parse('Serving Size 1 cup (245g)\nServings Per Container about 4\nCalories 15O Calories from Fat 20\nTotal Fat Og 0%\nTotal Carb. l7g\nProtein 12g');
  assert.deepStrictEqual(r.fields, { servingSize: '1 cup (245g)', servings: 4, kcal: 150, fat: 0, carbs: 17, protein: 12 });
});

test('a "g" read as 9 is flagged, not trusted', () => {
  const r = parse(US.replace('Total Fat 8g', 'Total Fat 89'));
  assert.strictEqual(r.fields.fat, 89);
  assert.ok(r.warnings.some(w => /last 9 may be/.test(w)));
  assert.ok(r.warnings.some(w => /do not match/.test(w)));
});

test('a gram size read as 9 is flagged', () => {
  assert.ok(parse(US.replace('(55g)', '(559)')).warnings.some(w => /Serving size/.test(w)));
});

test('split lines, less-than, and rubbish', () => {
  const r = parse('Serving size\n1 scoop (32g)\nCalories\n120\nTotal Fat <1g\nTotal Carbohydrate 3g\nProtein 24g');
  assert.strictEqual(r.fields.servingSize, '1 scoop (32g)');
  assert.strictEqual(r.fields.kcal, 120);
  assert.strictEqual(r.fields.fat, 1);
  assert.ok(r.warnings.some(w => /less than/.test(w)));
  for (const junk of ['', null, undefined, '@@@@ \n ~~ ', 'protein Total Fat calories']) {
    const j = parse(junk);
    assert.deepStrictEqual(j.fields, {});
    assert.strictEqual(j.warnings.length, 5);
  }
});

test('saturated fat alone is not total fat', () => {
  assert.strictEqual(parse('Saturated Fat 5g').fields.fat, undefined);
});

test('a long hostile line does not hang the parser', () => {
  const t = Date.now();
  parse(('calories ' + '|'.repeat(5000) + ' protein ').repeat(5) + '\n' + '1'.repeat(20000) + '\n' + 'l'.repeat(20000));
  assert.ok(Date.now() - t < 3000);
});

test('the self-hosted OCR files are the ones that were checked', () => {
  const dir = path.join(__dirname, '../public', OCR_DIR);
  const sums = fs.readFileSync(path.join(dir, 'SHA256SUMS'), 'utf8').trim().split('\n').map(l => l.split(/\s+/));
  assert.strictEqual(sums.length, 5);
  for (const [hash, file] of sums) {
    assert.strictEqual(crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, file))).digest('hex'), hash, file);
  }
});

test('the photo input cannot be submitted, and OCR loads only from this site on tap', () => {
  const form = fs.readFileSync(path.join(__dirname, '../views/pantry-form.ejs'), 'utf8');
  const input = /<input type="file"[^>]*>/.exec(form)[0];
  assert.doesNotMatch(input, /name=/);
  assert.doesNotMatch(form, /<script[^>]*tesseract/);
  const scan = fs.readFileSync(path.join(__dirname, '../public/nutrition-scan.js'), 'utf8');
  for (const opt of ['workerPath', 'corePath', 'langPath']) assert.match(scan, new RegExp(opt + ': '));
  assert.doesNotMatch(scan, /https?:\/\/|\bfetch\(|XMLHttpRequest|FormData|sendBeacon/);
});
