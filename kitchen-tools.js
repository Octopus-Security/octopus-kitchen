'use strict';

// Recipe → equipment matcher. Given a recipe, suggests the cookware/tools it
// calls for, each as an Amazon search term the page turns into an affiliate
// link. Same idea as safe-temps.js, but for monetization: a fried-rice recipe
// surfaces a wok, a batch recipe surfaces meal-prep containers, and anything
// with a safe cooking temperature surfaces a meat thermometer.
//
// Keep it relevant, not spammy — a handful of genuinely useful items per recipe
// converts better than a wall of links.

const TOOLS = [
  { label: 'Instant-read meat thermometer', term: 'instant read meat thermometer',
    note: 'The only way to hit the safe internal temp without guessing.',
    keywords: ['chicken', 'turkey', 'beef', 'steak', 'pork', 'ground beef', 'burger', 'patty', 'roast', 'thigh', 'meatloaf', 'meatball', 'hibachi'] },
  { label: 'Glass meal-prep containers', term: 'glass meal prep containers with lids',
    note: 'Portion a batch into grab-and-go servings that microwave and store well.',
    keywords: ['batch', 'make-ahead', 'meal prep', 'meal-prep', 'overnight'] },
  { label: 'Carbon-steel wok / large skillet', term: 'carbon steel wok',
    note: 'High heat and room to toss — what stir-fries and fried rice actually need.',
    keywords: ['fried rice', 'stir-fry', 'stir fry', 'lo mein', 'yakisoba', 'noodles', 'hibachi', 'skillet'] },
  { label: 'Rice cooker', term: 'rice cooker',
    note: 'Set-and-forget rice that comes out right every time — ideal for batch cooking.',
    keywords: ['rice'] },
  { label: 'Muffin tin', term: 'nonstick muffin tin',
    note: 'Even cups and clean release for muffins and egg bites.',
    keywords: ['muffin', 'egg bite', 'cupcake'] },
  { label: 'Mixing bowl set', term: 'stainless steel mixing bowl set',
    note: 'Separate wet and dry, and toss without spills.',
    keywords: ['muffin', 'frosting', 'batter', 'baking', 'monkey bread', 'oats'] },
  { label: 'Half-sheet baking pan', term: 'half sheet baking pan',
    note: 'The workhorse pan for baking and roasting a tray of protein and veg.',
    keywords: ['bake', 'roast', 'sheet', 'monkey bread'] },
  { label: 'Shaker bottle', term: 'protein shaker bottle',
    note: 'Lump-free shakes in seconds.',
    keywords: ['shake', 'smoothie', 'protein shake'] },
];

/**
 * Tools relevant to a recipe. Scans title + tags + ingredient names, matches
 * keywords (word-boundary), and returns at most one of each tool. Returns [] on
 * no match. `recipe.ingredients` may be a JSON string or an array.
 */
function relevantTools(recipe = {}) {
  const parts = [];
  if (recipe.title) parts.push(String(recipe.title));
  if (recipe.tags) parts.push(String(recipe.tags));
  let ings = recipe.ingredients;
  if (typeof ings === 'string') { try { ings = JSON.parse(ings); } catch { ings = []; } }
  if (Array.isArray(ings)) for (const i of ings) parts.push(String(i && i.name ? i.name : i));
  const haystack = parts.join(' • ').toLowerCase();

  const hits = (kw) => new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(haystack);
  const out = [];
  for (const t of TOOLS) {
    if (t.keywords.some(hits)) out.push({ label: t.label, term: t.term, note: t.note });
  }
  return out;
}

module.exports = { relevantTools };
