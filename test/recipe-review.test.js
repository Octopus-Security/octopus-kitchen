'use strict';
// Ingredient lines, and the rule that a non-reviewer cannot publish alone.
// The house recipes stay public. Run: node --test test/recipe-review.test.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, before, after } = require('node:test');
const assert = require('node:assert');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kitchen-review-'));
process.env.DB_PATH = path.join(dir, 'kitchen.db');
process.env.ADMIN_USERNAME = 'chef-review';

const review = require('../lib/recipe-review');
const { publicWhere, isReviewer } = require('../ownership');
const { Recipe, sequelize, initDatabase } = require('../database');

test('ingredient lines: quantity, unit, or a bare name', () => {
  assert.deepStrictEqual(review.parseIngredientLine('2 cups rice'), { name: 'rice', quantity: '2', unit: 'cups' });
  assert.deepStrictEqual(review.parseIngredientLine('2 rice'), { name: 'rice', quantity: '2', unit: '' });
  assert.deepStrictEqual(review.parseIngredientLine('rice'), { name: 'rice', quantity: '', unit: '' });
  assert.deepStrictEqual(review.parseIngredientLine('1 1/2 cups flour'), { name: 'flour', quantity: '1 1/2', unit: 'cups' });
  assert.deepStrictEqual(review.parseIngredientLine('½ cup milk'), { name: 'milk', quantity: '1/2', unit: 'cup' });
  assert.strictEqual(review.parseIngredientLine('   '), null);
});

test('a request stays private unless the person reviews the catalogue', () => {
  assert.deepStrictEqual(review.publishDecision({ isReviewer: false, requestPublic: true }), { visibility: 'private', reviewStatus: 'pending' });
  assert.deepStrictEqual(review.publishDecision({ isReviewer: true, requestPublic: true }), { visibility: 'public', reviewStatus: 'approved' });
  assert.deepStrictEqual(review.publishDecision({ isReviewer: false, requestPublic: false }), { visibility: 'private', reviewStatus: null });
  assert.deepStrictEqual(review.toggleDecision({ isReviewer: false, visibility: 'public' }), { visibility: 'private', reviewStatus: null });
  assert.strictEqual(review.reviewDecision('nope'), null);
  assert.strictEqual(isReviewer({ user: { username: 'sam', role: 'user' } }), false);
  assert.strictEqual(isReviewer({ user: { username: 'sam', role: 'admin' } }), true);
  assert.strictEqual(isReviewer({ user: { username: 'chef-review', role: 'user' } }), true);
});

before(async () => { await initDatabase(); });
after(async () => {
  await sequelize.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('asking to publish does not put the recipe on the storefront', async () => {
  const house = await Recipe.findOne({ where: { title: 'Chocolate blueberry muffins' } });
  assert.strictEqual(house.visibility, 'public');
  assert.ok(!house.reviewStatus);

  const made = await review.createFromBody(Recipe, {
    title: 'Weeknight rice',
    ingredients: '2 cups rice\n1 tbsp soy sauce\ngreen onion',
    instructions: 'Simmer the rice. Fold in the sauce.',
    request: 'on',
  }, { owner: 'sam', isReviewer: false });
  assert.strictEqual(made.row.visibility, 'private');
  assert.strictEqual(made.row.reviewStatus, 'pending');
  const onSite = await Recipe.findAll({ where: { ...publicWhere(), title: 'Weeknight rice' } });
  assert.strictEqual(onSite.length, 0);

  const denied = await review.reviewRow(made.row, { isReviewer: false, decision: 'approve' });
  assert.strictEqual(denied.status, 404);
  assert.strictEqual(made.row.visibility, 'private');

  const approved = await review.reviewRow(made.row, { isReviewer: true, decision: 'approve' });
  assert.strictEqual(approved.ok, true);
  assert.strictEqual(made.row.visibility, 'public');
  assert.strictEqual((await Recipe.findAll({ where: { ...publicWhere(), title: 'Weeknight rice' } })).length, 1);

  await review.toggleRow(made.row, { isReviewer: false });
  assert.strictEqual(made.row.visibility, 'private');

  const again = await review.toggleRow(made.row, { isReviewer: false });
  assert.strictEqual(again.access.reviewStatus, 'pending');
  const rejected = await review.reviewRow(made.row, { isReviewer: true, decision: 'reject', note: 'Needs a time' });
  assert.strictEqual(rejected.ok, true);
  assert.strictEqual(made.row.visibility, 'private');
  assert.strictEqual(made.row.reviewNote, 'Needs a time');
  assert.strictEqual((await Recipe.findAll({ where: { ...publicWhere(), title: 'Weeknight rice' } })).length, 0);
});

test('a reviewer can publish their own recipe immediately', async () => {
  const made = await review.createFromBody(Recipe, {
    title: 'Reviewer beans', ingredients: '2 cans beans', instructions: 'Heat.', request: 'on',
  }, { owner: 'chef-review', isReviewer: true });
  assert.strictEqual(made.row.visibility, 'public');
  assert.strictEqual(made.row.reviewStatus, 'approved');
});
