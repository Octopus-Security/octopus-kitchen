'use strict';

// Safe minimum internal cooking temperatures (USDA), plus a matcher that, given
// a recipe, surfaces the temps relevant to it — so a recipe with chicken shows
// the 165°F callout without anyone tagging it by hand. This is the "recipes
// pull the reference data they need" feature.
//
// Data first, matcher second. The data is also rendered directly on the
// standalone /temps reference page.

const f2c = (f) => Math.round(((f - 32) * 5) / 9);

// Each entry: a canonical food, its safe minimum internal temp, an optional
// rest, a note, and the keywords that map an ingredient/title/tag to it.
// ORDER MATTERS: more specific entries (ground meats) come before the general
// cut (beef/pork), because the matcher takes the first keyword hit per family.
const TEMPS = [
  {
    food: 'Poultry (chicken, turkey, duck)', family: 'poultry',
    tempF: 165, restMin: 0,
    note: 'Whole or ground, and any stuffing — 165°F throughout.',
    keywords: ['chicken', 'turkey', 'duck', 'poultry', 'chicken thigh', 'chicken breast', 'ground chicken', 'ground turkey', 'wings'],
  },
  {
    food: 'Ground meats (beef, pork, lamb)', family: 'redmeat',
    tempF: 160, restMin: 0,
    note: 'Ground beef, pork, lamb — 160°F (grinding spreads surface bacteria through the meat).',
    keywords: ['ground beef', 'ground pork', 'ground lamb', 'burger', 'burgers', 'patty', 'patties', 'meatball', 'meatloaf', 'bulgogi'],
  },
  {
    food: 'Beef, pork, lamb, veal — steaks, chops, roasts', family: 'redmeat',
    tempF: 145, restMin: 3,
    note: 'Whole cuts — 145°F then rest 3 minutes before cutting.',
    keywords: ['steak', 'beef', 'pork', 'lamb', 'veal', 'chop', 'roast', 'hibachi'],
  },
  {
    food: 'Fish & shellfish', family: 'seafood',
    tempF: 145, restMin: 0,
    note: 'Fish 145°F or until flesh is opaque and flakes; shrimp/lobster/crab until flesh is pearly and opaque.',
    keywords: ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'shrimp', 'prawn', 'crab', 'lobster', 'scallop'],
  },
  {
    food: 'Eggs & egg dishes', family: 'eggs',
    tempF: 160, restMin: 0,
    note: 'Cook until both yolk and white are firm; egg casseroles to 160°F.',
    keywords: ['egg', 'eggs', 'omelet', 'omelette', 'frittata', 'quiche'],
  },
  {
    food: 'Ham (fresh or raw)', family: 'ham',
    tempF: 145, restMin: 3,
    note: 'Fresh/raw ham 145°F + 3 min rest; a precooked ham being reheated → 165°F.',
    keywords: ['ham'],
  },
  {
    food: 'Leftovers & casseroles', family: 'leftovers',
    tempF: 165, restMin: 0,
    note: 'Reheat all leftovers and cook casseroles to 165°F.',
    keywords: ['leftover', 'casserole', 'reheat'],
  },
];

function withCelsius(entry) {
  return { ...entry, tempC: f2c(entry.tempF) };
}

/** The full reference table (for the /temps page). */
function allTemps() {
  return TEMPS.map(withCelsius);
}

/**
 * Temps relevant to one recipe. Scans title + tags + ingredient names, matches
 * against each family's keywords, and returns at most one entry per family
 * (the more specific "ground beef" wins over "beef" via TEMPS ordering and the
 * per-family dedup below). Returns [] when nothing matches — a salad has no
 * safe-temp callout, which is correct.
 *
 * `recipe.ingredients` may be a JSON string (as stored) or an array.
 */
function relevantTemps(recipe = {}) {
  const parts = [];
  if (recipe.title) parts.push(String(recipe.title));
  if (recipe.tags) parts.push(String(recipe.tags));
  let ings = recipe.ingredients;
  if (typeof ings === 'string') {
    try { ings = JSON.parse(ings); } catch { ings = []; }
  }
  if (Array.isArray(ings)) {
    for (const i of ings) parts.push(String(i && i.name ? i.name : i));
  }
  let haystack = parts.join(' • ').toLowerCase();

  // Strip flavourings so "chicken broth"/"beef bouillon"/"Better Than Bouillon
  // roasted chicken base" don't trigger a cook-to-165 callout — you're not
  // cooking the stock to temperature. Do this BEFORE matching.
  haystack = haystack.replace(
    /\b(chicken|beef|turkey|fish|pork|ham|vegetable|veggie)\s+(broth|stock|bouillon|base|powder|seasoning|granules|paste|flavou?r|consomm[eé]|cube|cubes)\b/g,
    ' ',
  );

  // Word-boundary match, so "ham" doesn't fire on "hamburger" and "egg" doesn't
  // fire on "eggplant".
  const hits = (kw) => new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(haystack);

  const out = [];
  const seen = new Set();
  for (const entry of TEMPS) {
    // One entry per family. TEMPS lists ground meats before whole cuts, so a
    // "ground beef" recipe takes the 160°F entry and the 145°F whole-cut entry
    // (which also keyword-matches "beef") is skipped.
    if (seen.has(entry.family)) continue;
    if (entry.keywords.some(hits)) {
      out.push(withCelsius(entry));
      seen.add(entry.family);
    }
  }
  return out;
}

module.exports = { allTemps, relevantTemps, f2c };
