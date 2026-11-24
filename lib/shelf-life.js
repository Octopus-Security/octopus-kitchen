'use strict';
/**
 * shelf-life.js: how long food probably keeps. Pure; no database, no clock.
 *
 * These are ESTIMATES for planning and reminders. Nothing here says food is safe.
 *
 * Where the numbers come from. The live USDA FoodKeeper data refused automated access
 * when this was written (fsis.usda.gov answered 403), so it was NOT checked. Two
 * documents that were actually read on 2026-11-24:
 *   FK   "The Food Keeper" brochure (Food Marketing Institute with Cornell University),
 *        an older printed relative of the FoodKeeper app, as hosted by Augusta University
 *   OSU  Ohio State University Extension fact sheet HYG-5403
 * A category with source HOUSE was in neither: it is our own cautious guess.
 *
 * Policy: the LOW end of a published range, and the lower of the two sources where they
 * disagree, unless the note says otherwise. `unopened` counts from the bought date,
 * `opened` from the opened (or made) date. null means no default.
 */
const et = require('./et');

const FK = 'FK', OSU = 'OSU', HOUSE = 'HOUSE';
const SOURCES = {
  FK: { label: 'The Food Keeper brochure (Food Marketing Institute / Cornell)', url: 'https://web1.augusta.edu/student-affairs/documents/foodkeeperbrochure.pdf' },
  OSU: { label: 'Ohio State University Extension, HYG-5403', url: 'https://ohioline.osu.edu/factsheet/HYG-5403' },
  HOUSE: { label: 'Our own cautious guess; no published figure was checked', url: null },
};

// key: [label, unopened days, opened days, source, what the source says]
const TABLE = {
  yogurt: ['Yogurt', 14, 7, FK, 'FK 7 to 14 days, OSU 7 to 10 days; neither splits opened from unopened. Sealed uses 14, opened uses 7.'],
  milk: ['Milk', 5, 5, OSU, 'OSU 5 days, FK 1 week; neither splits opened from unopened.'],
  plant_milk: ['Soy or rice milk, refrigerated', 7, 7, FK, '7 to 10 days. Other plant milks are assumed to be similar.'],
  cottage: ['Cottage cheese, ricotta', 5, 5, OSU, 'OSU 5 days, FK 1 week.'],
  cream_cheese: ['Cream cheese', 7, 5, OSU, '1 to 2 weeks; 5 to 6 days after opening.'],
  sour_cream: ['Sour cream', 7, 7, FK, '7 to 21 days.'],
  hard_cheese: ['Hard cheese', 120, 21, OSU, '4 to 6 months unopened; 3 to 4 weeks opened.'],
  soft_cheese: ['Soft cheese', 7, 7, FK, '1 week.'],
  butter: ['Butter', 7, 7, OSU, 'OSU 1 to 2 weeks, FK 1 to 3 months.'],
  eggs: ['Eggs, in shell', 21, 21, FK, '3 to 5 weeks.'],
  boiled_eggs: ['Hard-boiled eggs', 7, 7, FK, '1 week.'],
  liquid_eggs: ['Liquid eggs', 10, 3, FK, '10 days unopened; 3 days opened.'],
  juice: ['Juice, refrigerated', 21, 7, FK, '3 weeks unopened; 7 to 10 days opened.'],
  deli_meat: ['Lunch meat', 14, 3, FK, '2 weeks sealed; 3 to 5 days opened. Store-sliced counts as opened.'],
  hot_dogs: ['Hot dogs', 14, 4, OSU, '2 weeks unopened; 4 to 5 days opened.'],
  bacon: ['Bacon', 7, 7, FK, '1 week.'],
  raw_poultry: ['Raw chicken or turkey', 1, 1, FK, '1 to 2 days.'],
  raw_ground: ['Raw ground meat', 1, 1, FK, '1 to 2 days.'],
  raw_meat: ['Raw steaks, chops, roasts', 2, 2, OSU, '2 to 4 days.'],
  raw_fish: ['Raw fish or shellfish', 1, 1, FK, '1 to 2 days.'],
  leftovers: ['Cooked food, leftovers, meal prep', 3, 3, FK, '3 to 4 days.'],
  shake: ['Shake or smoothie, refrigerated', 1, 1, HOUSE, 'Not in either document.'],
  tofu: ['Tofu', 7, 3, FK, 'FK 1 week or package date, unopened. The opened figure is a guess.'],
  hummus: ['Hummus', 7, 4, HOUSE, 'Not in either document.'],
  fresh_salsa: ['Fresh salsa or pesto', null, 3, FK, 'Date on carton; 3 days after opening.'],
  berries: ['Fresh berries', 1, 1, FK, '1 to 2 days.'],
  cut_fruit: ['Cut fruit', null, 4, FK, 'Package date; 4 days after opening.'],
  fruit: ['Other fresh fruit', 3, 3, OSU, '3 to 5 days.'],
  greens: ['Salad greens', 1, 1, OSU, '1 to 2 days.'],
  frozen_fruit: ['Frozen fruit', 120, 120, FK, '4 to 6 months, kept frozen.'],
  bread: ['Bread, room temperature', 2, 2, FK, '2 to 4 days.'],
  canned_low_acid: ['Canned meat, beans, soup, vegetables', 730, 3, FK, '2 to 5 years; 3 to 4 days opened, refrigerated. OSU: canned vegetables 2 to 3 days.'],
  canned_acid: ['Canned fruit or tomatoes', 365, 5, FK, '12 to 18 months; 5 to 7 days opened, refrigerated.'],
  peanut_butter: ['Peanut butter', 180, 60, FK, '6 to 9 months; 2 to 3 months opened.'],
  nuts: ['Nuts', 365, 30, FK, '12 months; 1 month opened in the pantry.'],
  protein_powder: ['Protein powder', 180, 90, FK, 'Nearest listed product, soy beverage powder: 6 months; 3 to 4 months opened.'],
  oats: ['Oats, cook-before-eating cereal', 365, 180, FK, '12 months; 6 to 12 months opened.'],
  cereal: ['Cereal, ready to eat', 180, 90, FK, '6 to 12 months; 3 months opened.'],
  mayo: ['Mayonnaise', 60, 60, FK, '2 to 3 months; 2 months opened.'],
  ketchup: ['Ketchup', 365, 180, FK, '12 months; 6 months opened, refrigerated.'],
  dressing: ['Salad dressing', 300, 90, FK, '10 to 12 months; 3 months opened.'],
  jar_salsa: ['Jarred salsa', 365, 30, FK, '12 months; 1 month opened, refrigerated.'],
  dry_goods: ['White rice, dry pasta', 730, 365, FK, '2 years; 1 year opened.'],
  other: ['Something else', null, 3, HOUSE, 'Unlisted food: opened counts 3 days; unopened relies on the printed date.'],
};

const CATEGORIES = Object.fromEntries(Object.entries(TABLE).map(([key, [label, unopened, opened, source, note]]) =>
  [key, { key, label, unopened, opened, source, note }]));
const categoryOf = key => (Object.hasOwn(CATEGORIES, key) ? CATEGORIES[key] : CATEGORIES.other);

const norm = s => String(s || '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}%]+/gu, ' ').trim();
/** What counts as "the same product" for one person's learned estimate. */
const productKey = ({ name, brand }) => `${norm(brand)}|${norm(name)}`;

const minDate = list => list.reduce((a, b) => (a && (!b || a <= b) ? a : b), null);

/**
 * The day count to use, after this person's own spoilage. A product seen spoiled on day
 * N is only counted good through day N-1. Only 'spoiled' records count, and the result
 * never exceeds the default, so finishing food late can never lengthen an estimate.
 * Where there is no default, one's own spoilage is the only figure there is.
 */
function limitFor(defaultDays, observations, state) {
  let days = defaultDays, learned = false;
  for (const o of observations || []) {
    if (!o || o.outcome !== 'spoiled' || o.state !== state) continue;
    const n = Number(o.days);
    if (o.days == null || !Number.isInteger(n) || n < 0) continue;
    const good = Math.max(0, n - 1);
    if (days == null || good < days) { days = good; learned = true; }
  }
  return { days, learned };
}

/**
 * Last day a thing is probably good, or null when there is nothing to go on.
 * @param item {category, boughtOn, openedOn, madeOn, bestBy}
 * @param observations this person's records for this product only
 */
function estimate(item, observations = []) {
  const cat = categoryOf(item.category);
  const marks = [];
  const add = (date, why, learned = false) => { if (date) marks.push({ date, why, learned }); };
  const count = (from, state, word, def) => {
    if (!et.isDate(from)) return;
    const { days, learned } = limitFor(def, observations, state);
    if (days == null) return;
    add(et.addDays(from, days), learned
      ? `${days} day${days === 1 ? '' : 's'} after ${word}, shortened because yours spoiled before`
      : `${days} day${days === 1 ? '' : 's'} after ${word}, the usual figure for ${cat.label.toLowerCase()}`, learned);
  };
  count(item.openedOn, 'opened', 'opening', cat.opened);
  count(item.madeOn, 'made', 'it was made', cat.opened);
  // Being opened never buys time, so the unopened limit still applies afterwards.
  // Homemade food was never a sealed package.
  if (!et.isDate(item.madeOn)) count(item.boughtOn, 'unopened', 'buying', cat.unopened);
  // A printed date caps everything, not only unopened food. Cautious on purpose.
  if (et.isDate(item.bestBy)) add(item.bestBy, 'the date printed on the package');

  const goodUntil = minDate(marks.map(m => m.date));
  const hit = marks.find(m => m.date === goodUntil);
  return { goodUntil, why: hit ? hit.why : null, learned: hit ? hit.learned : false, source: SOURCES[cat.source].label };
}

/** The record to write when this food ends today, or null when no date says how old it is. */
function observationFor(item, outcome, today) {
  const [state, from] = et.isDate(item.openedOn) ? ['opened', item.openedOn]
    : et.isDate(item.madeOn) ? ['made', item.madeOn]
      : et.isDate(item.boughtOn) ? ['unopened', item.boughtOn] : [null, null];
  if (!state) return null;
  const days = et.daysBetween(from, today);
  return days < 0 ? null : { productKey: productKey(item), state, days, outcome };
}

/** A prep is only as good as its soonest ingredient, or its own default if that is sooner. */
function prepGoodUntil(prep, ingredientDates, observations = []) {
  const own = estimate({ category: prep.category, madeOn: prep.madeOn }, observations);
  const soonest = minDate((ingredientDates || []).map(i => i.goodUntil));
  if (soonest && (!own.goodUntil || soonest < own.goodUntil)) {
    const who = ingredientDates.find(i => i.goodUntil === soonest);
    return { ...own, goodUntil: soonest, why: `limited by ${who.name}`, learned: false };
  }
  return own;
}

/** 'past' | 'soon' | 'ok' | 'unknown' */
function urgency(goodUntil, today, soonDays = 3) {
  if (!goodUntil) return 'unknown';
  if (goodUntil < today) return 'past';
  return et.daysBetween(today, goodUntil) <= soonDays ? 'soon' : 'ok';
}

module.exports = { CATEGORIES, SOURCES, categoryOf, productKey, limitFor, estimate, observationFor, prepGoodUntil, urgency };
