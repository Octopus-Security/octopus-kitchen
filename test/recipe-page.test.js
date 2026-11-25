'use strict';
// The structured-data block on a recipe page stays one valid JSON document
// whatever the recipe text contains, and the starter recipes are well formed.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { RECIPES } = require('../recipes-seed');

const view = fs.readFileSync(path.join(__dirname, '..', 'views', 'recipe.ejs'), 'utf8');
const start = view.indexOf('<script type="application/ld+json">');
const block = view.slice(start, view.indexOf('</script>', start) + '</script>'.length);

test('recipe structured data round-trips', () => {
  const text = 'a < b </script> & "c"';
  const html = ejs.render(block, {
    recipe: { title: text, summary: text, servings: 2, tags: text },
    ingredients: [{ name: text, quantity: '1', unit: '' }],
    steps: [text],
  });
  assert.equal(html.split('</script>').length, 2);
  const json = JSON.parse(html.slice(html.indexOf('>') + 1, html.lastIndexOf('</script>')));
  assert.equal(json.name, text);
  assert.equal(json.recipeInstructions[0].text, text);
});

test('starter recipes have a unique title, ingredients and steps', () => {
  for (const r of RECIPES) assert.ok(r.title && r.ingredients.length && r.instructions.length, r.title);
  assert.equal(new Set(RECIPES.map(r => r.title)).size, RECIPES.length);
});
