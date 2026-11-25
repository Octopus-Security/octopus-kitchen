'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const s = require('../lib/shelf-life');
const et = require('../lib/et');
const pantry = require('../lib/pantry');

const spoiled = (days, state = 'opened') => ({ outcome: 'spoiled', state, days });

test('dates are calendar days in New York', () => {
  assert.strictEqual(et.todayET(new Date('2026-11-25T03:30:00Z')), '2026-11-24');
  assert.strictEqual(et.addDays('2026-10-30', 4), '2026-11-03'); // across the DST change
  assert.strictEqual(et.daysBetween('2026-03-06', '2026-03-10'), 4);
  assert.strictEqual(et.isDate('2026-02-30'), false);
  assert.strictEqual(et.ago('2026-11-20', '2026-11-24'), '4 days ago');
  assert.strictEqual(et.label('2026-11-28', '2026-11-24'), 'Sat, Nov 28');
});

test('opened food uses the opened default; unopened uses bought', () => {
  assert.strictEqual(s.estimate({ category: 'yogurt', openedOn: '2026-11-20' }).goodUntil, '2026-11-27');
  assert.strictEqual(s.estimate({ category: 'yogurt', boughtOn: '2026-11-20' }).goodUntil, '2026-12-04');
  assert.strictEqual(s.estimate({ category: 'leftovers', madeOn: '2026-11-20' }).goodUntil, '2026-11-23');
  assert.strictEqual(s.estimate({ category: 'yogurt' }).goodUntil, null);
});

test('opening never buys time, and a printed date is never exceeded', () => {
  assert.strictEqual(s.estimate({ category: 'yogurt', boughtOn: '2026-11-01', openedOn: '2026-11-14' }).goodUntil, '2026-11-15');
  assert.strictEqual(s.estimate({ category: 'yogurt', boughtOn: '2026-11-20', bestBy: '2026-11-25' }).goodUntil, '2026-11-25');
  for (const category of Object.keys(s.CATEGORIES)) {
    const e = s.estimate({ category, boughtOn: '2026-11-20', bestBy: '2026-11-20' });
    assert.strictEqual(e.goodUntil, '2026-11-20', category);
  }
});

test('spoilage shortens; nothing lengthens', () => {
  const y = { category: 'yogurt', openedOn: '2026-11-20' };
  const e = s.estimate(y, [spoiled(4)]);
  assert.strictEqual(e.goodUntil, '2026-11-23'); // bad on day 4, so good through day 3
  assert.strictEqual(e.learned, true);
  assert.strictEqual(s.estimate(y, [spoiled(30)]).goodUntil, '2026-11-27');
  assert.strictEqual(s.estimate(y, [{ outcome: 'finished', state: 'opened', days: 30 }]).goodUntil, '2026-11-27');
  assert.strictEqual(s.estimate(y, [spoiled(5), spoiled(3), spoiled(6)]).goodUntil, '2026-11-22');
  assert.strictEqual(s.estimate(y, [spoiled(3, 'unopened')]).goodUntil, '2026-11-27');
  assert.strictEqual(s.estimate(y, [spoiled(0)]).goodUntil, '2026-11-20');
  assert.strictEqual(s.estimate(y, [spoiled(null), spoiled(-2), spoiled('x')]).goodUntil, '2026-11-27');
});

test('an observation needs a date to count from', () => {
  assert.deepStrictEqual(s.observationFor({ name: 'Plain Yogurt', brand: 'A', openedOn: '2026-11-20', boughtOn: '2026-11-01' }, 'spoiled', '2026-11-24'),
    { productKey: 'a|plain yogurt', state: 'opened', days: 4, outcome: 'spoiled' });
  assert.strictEqual(s.observationFor({ name: 'X' }, 'spoiled', '2026-11-24'), null);
  assert.strictEqual(s.observationFor({ name: 'X', openedOn: '2026-12-01' }, 'spoiled', '2026-11-24'), null);
});

test('a prep keeps as long as its soonest ingredient or its own default', () => {
  const prep = { category: 'leftovers', madeOn: '2026-11-20' };
  assert.strictEqual(s.prepGoodUntil(prep, [{ name: 'a', goodUntil: '2026-12-20' }, { name: 'b', goodUntil: null }]).goodUntil, '2026-11-23');
  const e = s.prepGoodUntil(prep, [{ name: 'milk', goodUntil: '2026-11-21' }]);
  assert.strictEqual(e.goodUntil, '2026-11-21');
  assert.match(e.why, /milk/);
});

test('every default names a known source; a house guess says so', () => {
  for (const c of Object.values(s.CATEGORIES)) {
    assert.ok(s.SOURCES[c.source], c.key);
    assert.ok(c.note, c.key);
    assert.ok(c.opened > 0, c.key);
  }
  assert.strictEqual(s.SOURCES.HOUSE.url, null);
  assert.strictEqual(s.categoryOf('constructor').key, 'other');
});

test('prep macros: per portion, unknown is not zero', () => {
  const m = pantry.prepMacros([
    { name: 'powder', servings: 4, kcal: 120, protein: 24, carbs: 3, fat: 1 },
    { name: 'milk', servings: 2, kcal: 100, protein: 8, carbs: 12, fat: null },
    { name: 'ice', servings: null },
  ], 2);
  assert.deepStrictEqual([m.kcal, m.protein, m.carbs, m.fat], [340, 56, 18, 2]);
  assert.deepStrictEqual(m.missing, ['milk', 'ice']);
  assert.strictEqual(pantry.prepMacros([{ name: 'x', servings: 1 }], 1).kcal, null);
});

test('form parsing: blank is unknown, bad input is an error, fields can be removed', () => {
  const ok = pantry.itemFromForm({ name: 'Y', kcal: '', protein: '0', customName: ['Sodium', '', 'Fiber'], customValue: ['65 mg', 'x', '3 g'] }, '2026-11-24');
  assert.strictEqual(ok.error, null);
  assert.strictEqual(ok.row.kcal, null);
  assert.strictEqual(ok.row.protein, 0);
  assert.deepStrictEqual(JSON.parse(ok.row.customFields), [{ name: 'Sodium', value: '65 mg' }, { name: 'Fiber', value: '3 g' }]);
  assert.ok(pantry.itemFromForm({ name: ' ' }, '2026-11-24').error);
  assert.ok(pantry.itemFromForm({ name: 'a', kcal: '-1' }, '2026-11-24').error);
  assert.ok(pantry.itemFromForm({ name: 'a', openedOn: '2026-11-25' }, '2026-11-24').error);
  assert.ok(pantry.itemFromForm({ name: 'a', bestBy: '2026-13-01' }, '2026-11-24').error);
  assert.strictEqual(pantry.itemFromForm({ name: 'a', bestBy: '2027-01-01', category: '__proto__' }, '2026-11-24').row.category, 'other');
});
