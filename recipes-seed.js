/**
 * seed-recipes.js — the house meal rotation, seeded via findOrCreate so
 * it's fully idempotent (new recipes are added, existing ones never touched,
 * nothing ever duplicated regardless of how many times it runs).
 *
 * Design priorities:
 *  - Microwaveable at work: saucy/moist dishes, instructions include reheat tip
 *  - Batch-cooked Sunday → keeps 4-5 days in fridge, containers ready to grab
 *  - High protein, minimal processed food, maximum overlap in ingredient pool
 *  - Toppings / garnish suggestions included for balanced meals
 */

'use strict';

// ── Helpers ───────────────────────────────────────────────────────────────────

const REHEAT = 'Reheat: microwave 2-3 min, add a small splash of water and cover with a damp paper towel, stir halfway through.';

function ing(name, quantity, unit = '') {
  return { name, quantity: String(quantity), unit };
}


// ── Baking: two recipes that are also one ─────────────────────────────────────
//
// The muffins and the frosting each stand alone, and the combined entry is the
// two of them together. Writing that third entry out by hand would be a copy of
// both, and the first ingredient anyone corrected would leave the copy behind
// still saying the old thing — silently, because nothing compares them.
//
// So it is composed instead. `combined()` concatenates the ingredients, joins
// the methods under headings, and takes the SHORTER of the two shelf lives —
// an upper bound rather than a promise. A frosted muffin does not keep as long
// as either half does on its own, but "no longer than its shortest-lived part"
// is derivable, and a guessed number is not.

const MUFFINS = {
  title: 'Chocolate blueberry muffins',
  servings: 12, keepsForDays: 5,
  tags: 'baking,dessert,sweet,muffin,chocolate,blueberry,make-ahead',
  ingredients: [
    ing('all-purpose flour', '1½', 'cups'),
    ing('unsweetened cocoa powder (Dutch-processed or standard)', '½', 'cup'),
    ing('granulated sugar', '¾', 'cup'),
    ing('packed brown sugar', '¼', 'cup'),
    ing('baking soda', 1, 'tsp'),
    ing('baking powder', '½', 'tsp'),
    ing('salt', '½', 'tsp'),
    ing('large eggs', 2, 'eggs'),
    ing('neutral oil (canola or vegetable)', '½', 'cup'),
    ing('buttermilk (or whole milk + 1 tsp white vinegar)', '¾', 'cup'),
    ing('vanilla extract', 1, 'tsp'),
    ing('fresh or frozen blueberries', '1¼', 'cups'),
  ],
  instructions: [
    '1. Prepare the oven and pan: preheat to 375°F (190°C) and line a 12-cup muffin tin with paper liners.',
    '2. Whisk the dry ingredients: in a large bowl, whisk together the flour, cocoa powder, both sugars, baking soda, baking powder and salt. Break up any brown sugar clumps.',
    '3. Combine the wet ingredients: in a separate bowl, whisk the eggs, oil, buttermilk and vanilla extract until completely smooth.',
    '4. Fold the batter: toss the blueberries in a little flour first so they do not sink. Pour the wet ingredients into the dry and stir gently; right before it is fully mixed, add the blueberries (a teaspoon of flour matters most with frozen ones, which otherwise sink and bleed). Fold until just combined.',
    '5. Bake and cool: fill the muffin cups almost to the top. Bake 18-22 minutes, until a toothpick in the centre comes out mostly clean. Cool completely on a wire rack before frosting.',
  ],
};

const FROSTING = {
  title: 'Peanut butter cream cheese frosting',
  // Makes enough for a dozen muffins, so it is measured the same way — "one
  // serving" is one muffin's worth, which is what makes the shopping list add
  // up when this is made alongside them.
  servings: 12, keepsForDays: 7,
  tags: 'baking,dessert,sweet,frosting,peanut-butter,no-bake',
  ingredients: [
    ing('full-fat cream cheese, room temperature', 8, 'oz'),
    ing('creamy peanut butter (not natural / oil-separated)', '½', 'cup'),
    ing('unsalted butter, softened', '¼', 'cup'),
    ing('powdered sugar', 2, 'cups'),
    ing('vanilla extract', 1, 'tsp'),
    ing('salt', 1, 'pinch'),
  ],
  instructions: [
    '1. Cream the bases: with a hand mixer on medium, beat the softened cream cheese, peanut butter and butter until perfectly smooth and fluffy, about 2 minutes.',
    '2. Incorporate the sugar: turn the mixer to low and add the powdered sugar gradually, about ½ cup at a time, to prevent a mess.',
    '3. Add vanilla and finish: add the vanilla extract and salt, turn the mixer back up to medium-high and whip another 1-2 minutes until light and spreadable.',
    '4. Frost: wait until whatever you are frosting is entirely at room temperature, then spread with a knife or pipe it on.',
  ],
};

/** The two together: ingredients concatenated, methods kept as labelled halves. */
function combined(base, topping) {
  return {
    title: `${base.title} with ${topping.title.toLowerCase()}`,
    servings: base.servings,
    // Whichever runs out first — here the muffin (5) rather than the frosting
    // (7), which is the opposite of what you would assume from the cream cheese.
    keepsForDays: Math.min(base.keepsForDays, topping.keepsForDays),
    tags: [...new Set([...base.tags.split(','), ...topping.tags.split(',')])]
      .filter(t => t !== 'no-bake')   // it is not, once the muffins are in it
      .join(','),
    ingredients: [...base.ingredients, ...topping.ingredients],
    instructions: [
      `FOR THE ${base.title.toUpperCase()}`,
      ...base.instructions,
      '',
      `FOR THE ${topping.title.toUpperCase()}`,
      ...topping.instructions.map(s => s.replace(/whatever you are frosting is/, 'the muffins are')),
      '',
      'Make the frosting while the muffins cool. Frosted muffins need the fridge — the cream cheese is perishable and they will not keep on the counter.',
    ],
  };
}

// ── Recipe definitions ────────────────────────────────────────────────────────

const RECIPES = [

  // ══════════════════════════════════════════════════════════════════════════
  // FRIED RICE
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Chicken fried rice',
    servings: 5, keepsForDays: 5,
    tags: 'fried-rice,chicken,asian,batch,microwave-friendly',
    ingredients: [
      ing('chicken thighs', 1.5, 'lb'), ing('day-old cooked white rice', 4, 'cups'),
      ing('frozen stir-fry vegetable mix', 1, 'bag'), ing('eggs', 3, 'eggs'),
      ing('yellow onion', 1, 'whole'), ing('garlic', 4, 'cloves'),
      ing('soy sauce', '¼', 'cup'), ing('sesame oil', 2, 'tbsp'),
      ing('neutral oil (vegetable or avocado)', 2, 'tbsp'),
      ing('green onion', 3, 'stalks — topping'),
    ],
    instructions: [
      '1. Cube chicken thighs into bite-size pieces. Season with salt + pepper.',
      '2. Heat oil in large wok or skillet on high. Cook chicken + diced onion + garlic until chicken is cooked through (~8 min). Set aside.',
      '3. Scramble eggs in same pan, break into small pieces. Set aside.',
      '4. Add sesame oil + cold rice to pan. Press flat and let sit 2 min to get slight crust. Stir-fry 3-4 min.',
      '5. Add frozen veg, stir-fry 3 min. Return chicken + eggs. Pour soy sauce over everything.',
      '6. Toss until evenly coated and hot. Portion into 5 containers.',
      'Toppings: green onion, sriracha, fried egg on top for extra protein.',
      REHEAT,
    ].join('\n'),
  },

  {
    title: 'Beef fried rice',
    servings: 5, keepsForDays: 5,
    tags: 'fried-rice,beef,ground-beef,asian,batch,microwave-friendly,cheap',
    ingredients: [
      ing('ground beef', 1, 'lb'), ing('day-old cooked white rice', 4, 'cups'),
      ing('frozen stir-fry vegetable mix', 1, 'bag'), ing('eggs', 3, 'eggs'),
      ing('yellow onion', 1, 'whole'), ing('garlic', 4, 'cloves'),
      ing('soy sauce', '¼', 'cup'), ing('sesame oil', 2, 'tbsp'),
      ing('neutral oil', 1, 'tbsp'), ing('green onion', 3, 'stalks — topping'),
    ],
    instructions: [
      '1. Brown ground beef with diced onion + garlic in a hot wok. Drain excess fat. Set aside.',
      '2. Scramble eggs in same pan. Set aside.',
      '3. Add sesame oil + cold rice. Stir-fry 4 min. Add frozen veg, cook 3 min.',
      '4. Return beef + eggs. Add soy. Toss everything until glossy and hot.',
      '5. Portion into 5 containers.',
      'Toppings: green onion, sesame seeds, chili crisp or sriracha.',
      REHEAT,
    ].join('\n'),
  },

  {
    title: 'Egg fried rice (no meat — quick)',
    servings: 4, keepsForDays: 4,
    tags: 'fried-rice,eggs,vegetarian,asian,quick,cheap,microwave-friendly',
    ingredients: [
      ing('day-old cooked white rice', 4, 'cups'), ing('eggs', 5, 'eggs'),
      ing('frozen stir-fry vegetable mix', 1, 'bag'), ing('yellow onion', 1, 'whole'),
      ing('garlic', 3, 'cloves'), ing('soy sauce', 3, 'tbsp'), ing('sesame oil', 2, 'tbsp'),
    ],
    instructions: [
      '1. Scramble eggs in hot oiled pan, break small. Set aside.',
      '2. Sauté onion + garlic in sesame oil. Add cold rice, stir-fry 4 min.',
      '3. Add frozen veg, cook 3 min. Return eggs. Add soy. Toss.',
      'Toppings: green onion, chili oil, a fried egg for extra protein.',
      REHEAT,
    ].join('\n'),
  },

  {
    title: 'Kimchi fried rice',
    servings: 4, keepsForDays: 4,
    tags: 'fried-rice,asian,kimchi,spicy,chicken,quick,microwave-friendly',
    ingredients: [
      ing('day-old cooked white rice', 4, 'cups'), ing('kimchi (store-bought)', 1, 'cup'),
      ing('chicken thighs or ground beef', 0.75, 'lb'), ing('eggs', 3, 'eggs'),
      ing('soy sauce', 2, 'tbsp'), ing('sesame oil', 1, 'tbsp'),
      ing('garlic', 3, 'cloves'), ing('green onion', 4, 'stalks'),
    ],
    instructions: [
      '1. Cook protein (chicken cubed or ground beef) with garlic. Set aside.',
      '2. Add kimchi to pan, stir-fry 2 min (it gets a little caramelized — great).',
      '3. Add cold rice, soy, sesame oil. Toss 3-4 min.',
      '4. Scramble in eggs quickly or cook separately and place on top.',
      '5. Return protein. Stir. Top with green onion.',
      'Toppings: fried egg, sesame seeds, nori strips.',
      'Buy kimchi: any Asian grocery or Walmart refrigerated section.',
      REHEAT,
    ].join('\n'),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ASIAN NOODLES + STIR-FRY
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Chicken stir-fry lo mein',
    servings: 4, keepsForDays: 4,
    tags: 'noodles,chicken,asian,stir-fry,batch,microwave-friendly,lo-mein',
    ingredients: [
      ing('chicken thighs', 1, 'lb'), ing('lo mein noodles (or spaghetti in a pinch)', 12, 'oz'),
      ing('frozen stir-fry vegetable mix', 1, 'bag'), ing('garlic', 4, 'cloves'),
      ing('soy sauce', '¼', 'cup'), ing('oyster sauce', 2, 'tbsp'),
      ing('sesame oil', 1, 'tbsp'), ing('neutral oil', 2, 'tbsp'),
      ing('ginger (fresh or paste)', 1, 'tbsp'), ing('green onion', 4, 'stalks'),
    ],
    instructions: [
      '1. Cook noodles per package. Drain, toss with sesame oil to prevent sticking.',
      '2. Slice chicken thin. Stir-fry with garlic + ginger on high heat 6 min.',
      '3. Add frozen veg, cook 3-4 min.',
      '4. Add noodles. Pour soy + oyster sauce over everything. Toss hard for 2 min.',
      '5. Top with green onion. Portion into 4 containers.',
      'Toppings: sesame seeds, sriracha, extra green onion.',
      REHEAT,
    ].join('\n'),
  },

  {
    title: 'Beef stir-fry noodles',
    servings: 4, keepsForDays: 4,
    tags: 'noodles,beef,ground-beef,asian,stir-fry,batch,microwave-friendly',
    ingredients: [
      ing('ground beef (or sliced flank steak)', 1, 'lb'),
      ing('lo mein or yakisoba noodles', 12, 'oz'),
      ing('frozen stir-fry vegetable mix', 1, 'bag'), ing('garlic', 4, 'cloves'),
      ing('soy sauce', '¼', 'cup'), ing('oyster sauce', 2, 'tbsp'),
      ing('sesame oil', 2, 'tbsp'), ing('neutral oil', 1, 'tbsp'),
    ],
    instructions: [
      '1. Cook noodles. Drain, set aside.',
      '2. Brown beef with garlic in wok on high heat. Drain fat.',
      '3. Add frozen veg, cook 3 min.',
      '4. Add noodles + soy + oyster sauce + sesame oil. Toss 2 min.',
      'Toppings: green onion, sesame seeds, chili garlic sauce.',
      REHEAT,
    ].join('\n'),
  },

  {
    title: 'Yakisoba (Japanese stir-fry noodles)',
    servings: 4, keepsForDays: 4,
    tags: 'noodles,asian,japanese,yakisoba,chicken,batch,microwave-friendly',
    ingredients: [
      ing('yakisoba noodles (or any ramen/lo mein noodles)', 12, 'oz'),
      ing('chicken thighs or ground beef', 1, 'lb'),
      ing('frozen stir-fry vegetable mix', 1, 'bag'), ing('yellow onion', 1, 'whole'),
      ing('Worcestershire sauce', 2, 'tbsp'), ing('soy sauce', 2, 'tbsp'),
      ing('ketchup', 1, 'tbsp'), ing('oyster sauce', 1, 'tbsp'),
      ing('sesame oil', 1, 'tbsp'), ing('garlic', 3, 'cloves'),
    ],
    instructions: [
      'Yakisoba sauce: mix Worcestershire + soy + ketchup + oyster sauce in a small bowl.',
      '1. Cook noodles. Drain.',
      '2. Stir-fry protein with garlic + sliced onion. Add frozen veg.',
      '3. Add noodles + sauce. Toss on high heat 2-3 min until caramelized slightly.',
      '4. Drizzle sesame oil. Top with pickled ginger if you have it.',
      'Toppings: green onion, sesame seeds, a drizzle of Kewpie mayo (try it).',
      REHEAT,
    ].join('\n'),
  },

  {
    title: 'Garlic sesame noodles (cold or hot)',
    servings: 4, keepsForDays: 5,
    tags: 'noodles,asian,cold,no-cook-after-boil,vegetarian,batch,quick',
    ingredients: [
      ing('spaghetti or lo mein noodles', 12, 'oz'), ing('garlic', 5, 'cloves — minced'),
      ing('soy sauce', 3, 'tbsp'), ing('sesame oil', 3, 'tbsp'),
      ing('rice vinegar', 1, 'tbsp'), ing('peanut butter', 2, 'tbsp'),
      ing('honey or sugar', 1, 'tbsp'), ing('sriracha', 1, 'tbsp'),
      ing('neutral oil', 2, 'tbsp'), ing('green onion', 4, 'stalks'),
      ing('cucumber (optional, for freshness)', 0.5, 'cucumber sliced'),
    ],
    instructions: [
      '1. Cook noodles. Rinse under cold water.',
      'Sauce: whisk soy + sesame oil + peanut butter + vinegar + honey + sriracha.',
      '2. Heat neutral oil in pan until very hot. Pour over minced garlic in a bowl (the sizzle blooms the garlic). Stir into sauce.',
      '3. Toss noodles in sauce. Top with green onion + cucumber.',
      '4. Eat cold from the fridge or quickly reheat.',
      'Protein add-on: leftover chicken sliced over top, or a soft-boiled egg.',
      'Toppings: sesame seeds, cucumber, shredded chicken, sliced soft-boiled egg.',
      REHEAT,
    ].join('\n'),
  },

  {
    title: 'Dan Dan inspired noodles (spicy peanut ground beef)',
    servings: 4, keepsForDays: 4,
    tags: 'noodles,asian,spicy,ground-beef,peanut,batch,microwave-friendly',
    ingredients: [
      ing('ground beef or ground pork', 1, 'lb'), ing('spaghetti or lo mein noodles', 12, 'oz'),
      ing('garlic', 4, 'cloves'), ing('soy sauce', 3, 'tbsp'),
      ing('peanut butter', 3, 'tbsp'), ing('sesame oil', 2, 'tbsp'),
      ing('rice vinegar', 1, 'tbsp'), ing('sriracha or chili paste', 1, 'tbsp'),
      ing('chicken broth or water', '¼', 'cup'), ing('green onion', 4, 'stalks'),
    ],
    instructions: [
      'Sauce: whisk peanut butter + soy + sesame oil + vinegar + sriracha + broth until smooth.',
      '1. Cook noodles. Drain.',
      '2. Brown ground beef with garlic. Drain fat.',
      '3. Add sauce to beef, stir to coat. Toss in noodles.',
      '4. Thin with a splash of pasta water if too thick.',
      'Toppings: green onion, cucumber slices, soft-boiled egg, sesame seeds, extra chili oil.',
      REHEAT,
    ].join('\n'),
  },

  {
    title: 'Pad Thai style noodles (chicken)',
    servings: 4, keepsForDays: 4,
    tags: 'noodles,asian,thai,chicken,batch,microwave-friendly,pad-thai',
    ingredients: [
      ing('rice noodles (flat, 6-8mm) or lo mein noodles', 12, 'oz'),
      ing('chicken thighs', 1, 'lb'), ing('eggs', 3, 'eggs'),
      ing('frozen stir-fry veg mix', 1, 'bag'), ing('garlic', 3, 'cloves'),
      ing('fish sauce (or soy sauce)', 3, 'tbsp'), ing('soy sauce', 2, 'tbsp'),
      ing('lime juice', 2, 'tbsp'), ing('sugar or honey', 1, 'tbsp'),
      ing('neutral oil', 2, 'tbsp'), ing('green onion', 4, 'stalks'),
    ],
    instructions: [
      'Sauce: mix fish sauce + soy + lime + sugar.',
      '1. Soak rice noodles in hot water 10 min (or cook lo mein normally). Drain.',
      '2. Stir-fry chicken with garlic on high heat. Push to side, scramble eggs in pan.',
      '3. Add frozen veg + noodles. Pour sauce over. Toss hard until absorbed.',
      'Toppings: bean sprouts (if available), green onion, crushed peanuts, lime wedge, sriracha.',
      'Peanuts add healthy fat + protein — worth keeping in pantry.',
      REHEAT,
    ].join('\n'),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CHICKEN DISHES
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Teriyaki chicken rice bowl',
    servings: 5, keepsForDays: 5,
    tags: 'rice-bowl,chicken,asian,teriyaki,batch,microwave-friendly,high-protein',
    ingredients: [
      ing('chicken thighs', 2, 'lb'), ing('cooked white rice', 4, 'cups'),
      ing('frozen stir-fry veg mix', 1, 'bag'),
      ing('soy sauce', '¼', 'cup'), ing('honey or brown sugar', 3, 'tbsp'),
      ing('garlic', 4, 'cloves'), ing('ginger', 1, 'tsp'), ing('sesame oil', 1, 'tbsp'),
      ing('cornstarch', 1, 'tsp — thickener'), ing('neutral oil', 1, 'tbsp'),
    ],
    instructions: [
      'Teriyaki sauce: whisk soy + honey + minced garlic + ginger + sesame oil + cornstarch + 2 tbsp water.',
      '1. Cook rice.',
      '2. Cube chicken. Sear in hot oil 7-8 min until cooked and slightly browned.',
      '3. Pour teriyaki sauce over chicken. Toss and simmer 2 min until glossy.',
      '4. Cook frozen veg in same pan or separately.',
      '5. Layer: rice → veg → teriyaki chicken. Portion into 5 containers.',
      'Toppings: sesame seeds, green onion, sriracha, sliced avocado (add fresh, not stored).',
      REHEAT,
    ].join('\n'),
  },

  {
    title: 'Honey garlic chicken rice bowl',
    servings: 5, keepsForDays: 5,
    tags: 'rice-bowl,chicken,batch,microwave-friendly,high-protein,sweet-savory',
    ingredients: [
      ing('chicken thighs', 2, 'lb'), ing('cooked white rice', 4, 'cups'),
      ing('frozen stir-fry veg mix', 1, 'bag'), ing('garlic', 6, 'cloves'),
      ing('honey', 3, 'tbsp'), ing('soy sauce', 3, 'tbsp'),
      ing('butter', 2, 'tbsp'), ing('red pepper flakes', 1, 'pinch'),
    ],
    instructions: [
      'Sauce: mix honey + soy + minced garlic + red pepper flakes.',
      '1. Cook rice.',
      '2. Cube chicken. Sear in oil until golden and cooked through.',
      '3. Add butter + sauce. Toss 2 min until chicken is glossy and well-coated.',
      '4. Cook frozen veg separately.',
      '5. Portion: rice → veg → chicken. Spoon extra sauce from pan over top.',
      'Toppings: green onion, sesame seeds, sriracha for heat.',
      REHEAT,
    ].join('\n'),
  },

  {
    title: 'Chicken and broccoli stir-fry',
    servings: 4, keepsForDays: 4,
    tags: 'stir-fry,chicken,broccoli,rice-bowl,asian,batch,high-protein,microwave-friendly',
    ingredients: [
      ing('chicken thighs', 1.5, 'lb'), ing('broccoli (fresh or frozen florets)', 1, 'lb'),
      ing('garlic', 4, 'cloves'), ing('ginger', 1, 'tsp'),
      ing('soy sauce', 3, 'tbsp'), ing('oyster sauce', 2, 'tbsp'),
      ing('sesame oil', 1, 'tbsp'), ing('cornstarch', 1, 'tsp'),
      ing('cooked white rice', 4, 'cups — for serving'),
    ],
    instructions: [
      'Sauce: soy + oyster sauce + sesame oil + cornstarch + 2 tbsp water.',
      '1. Slice chicken thin. Stir-fry with garlic + ginger on high heat 6 min.',
      '2. Add broccoli. Cook 4-5 min (add 2 tbsp water and cover briefly to steam).',
      '3. Pour sauce over. Toss until everything is coated and sauce thickens.',
      '4. Serve over rice.',
      'Toppings: sesame seeds, chili crisp.',
      'High protein tip: add a soft-boiled egg on top.',
      REHEAT,
    ].join('\n'),
  },

  {
    title: 'Garlic butter chicken pasta (no red sauce)',
    servings: 4, keepsForDays: 4,
    tags: 'pasta,chicken,garlic-butter,batch,no-red-sauce,microwave-friendly',
    ingredients: [
      ing('chicken thighs', 1, 'lb'), ing('penne or spaghetti', 12, 'oz'),
      ing('frozen stir-fry veg mix', 1, 'bag'), ing('butter', 4, 'tbsp'),
      ing('garlic', 6, 'cloves'), ing('olive oil', 2, 'tbsp'),
      ing('parmesan cheese', '½', 'cup'), ing('Italian seasoning', 1, 'tsp'),
      ing('red pepper flakes', 1, 'pinch'), ing('pasta water', '½', 'cup — reserved'),
    ],
    instructions: [
      '1. Cook pasta. SAVE ½ cup pasta water before draining.',
      '2. Cube chicken + season. Sear in olive oil 8 min. Set aside.',
      '3. Melt butter, add minced garlic + pepper flakes, cook 1 min.',
      '4. Add frozen veg, cook 3 min. Add pasta + pasta water. Toss.',
      '5. Return chicken. Add parmesan. Toss until silky.',
      'Toppings: extra parmesan, fresh parsley, red pepper flakes.',
      REHEAT,
    ].join('\n'),
  },

  {
    title: 'Chicken rice bowl (basic soy-sesame)',
    servings: 4, keepsForDays: 5,
    tags: 'rice-bowl,chicken,asian,batch,high-protein,microwave-friendly,simple',
    ingredients: [
      ing('chicken thighs', 1.5, 'lb'), ing('cooked white rice', 4, 'cups'),
      ing('frozen stir-fry veg mix', 1, 'bag'), ing('garlic', 3, 'cloves'),
      ing('soy sauce', 3, 'tbsp'), ing('sesame oil', 1, 'tbsp'), ing('neutral oil', 1, 'tbsp'),
    ],
    instructions: [
      '1. Cook rice.',
      '2. Cube chicken. Sauté with garlic in oil 8 min.',
      '3. Cook frozen veg in same pan 3 min.',
      '4. Toss everything with soy + sesame oil. Portion over rice.',
      'Toppings: green onion, sesame seeds, sriracha, fried egg.',
      REHEAT,
    ].join('\n'),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GROUND BEEF DISHES
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Korean-style ground beef rice bowl (budget bulgogi)',
    servings: 4, keepsForDays: 5,
    tags: 'rice-bowl,beef,ground-beef,asian,korean,batch,microwave-friendly,high-protein,cheap',
    ingredients: [
      ing('ground beef', 1, 'lb'), ing('cooked white rice', 4, 'cups'),
      ing('garlic', 4, 'cloves'), ing('ginger', 1, 'tsp'),
      ing('soy sauce', 3, 'tbsp'), ing('sesame oil', 2, 'tbsp'),
      ing('brown sugar or honey', 1, 'tbsp'), ing('red pepper flakes', 1, 'tsp'),
      ing('frozen stir-fry veg mix', 1, 'bag'), ing('green onion', 4, 'stalks'),
    ],
    instructions: [
      'Sauce: soy + sesame oil + brown sugar + garlic + ginger + red pepper flakes.',
      '1. Brown ground beef in a hot pan. Drain most fat.',
      '2. Pour sauce over beef. Stir 1-2 min on medium.',
      '3. Cook frozen veg separately in sesame oil.',
      '4. Portion: rice → veg → beef. Spoon pan sauce over top.',
      '5. Top with green onion.',
      'Toppings: fried egg (adds protein + richness), sesame seeds, cucumber slices, sriracha.',
      'This is the best bang-for-buck meal in the rotation. $1-2/serving.',
      REHEAT,
    ].join('\n'),
  },

  {
    title: 'Ground beef and rice skillet',
    servings: 4, keepsForDays: 5,
    tags: 'rice,beef,ground-beef,batch,microwave-friendly,cheap,one-pan',
    ingredients: [
      ing('ground beef', 1, 'lb'), ing('uncooked white rice', 2, 'cups'),
      ing('beef or chicken broth', 4, 'cups'), ing('yellow onion', 1, 'whole'),
      ing('garlic', 3, 'cloves'), ing('soy sauce', 2, 'tbsp'),
      ing('Worcestershire sauce', 1, 'tbsp'), ing('frozen peas or veg mix', 1, 'cup'),
      ing('cheddar cheese (optional)', '½', 'cup — to top'),
    ],
    instructions: [
      '1. Brown ground beef with diced onion + garlic. Drain fat.',
      '2. Add uncooked rice + broth + soy + Worcestershire. Stir.',
      '3. Bring to boil, cover, simmer 18 min until rice absorbs liquid.',
      '4. Stir in frozen peas, let sit covered 5 min.',
      '5. Top with cheese if using.',
      'One pan, minimal cleanup, full meal in 30 min.',
      'Toppings: hot sauce, green onion, shredded cheese.',
      REHEAT,
    ].join('\n'),
  },

  {
    title: 'Ground beef burritos (batch)',
    servings: 6, keepsForDays: 5,
    tags: 'burrito,beef,ground-beef,handheld,freezable,batch,cheap,microwave-friendly',
    ingredients: [
      ing('ground beef', 1, 'lb'), ing('cooked white rice', 3, 'cups'),
      ing('yellow onion', 1, 'whole'), ing('bell pepper', 1, 'whole'),
      ing('large flour tortillas', 6, 'tortillas'), ing('shredded Mexican cheese', 1, 'cup'),
      ing('garlic', 3, 'cloves'), ing('cumin', 1, 'tsp'), ing('hot sauce', 'to taste', ''),
    ],
    instructions: [
      '1. Cook rice.',
      '2. Brown ground beef with onion + garlic + cumin. Drain.',
      '3. Sauté bell pepper 4 min.',
      '4. Warm tortillas. Fill: rice → beef → peppers → cheese → hot sauce.',
      '5. Roll, wrap in foil. Fridge up to 5 days; freezes well up to 1 month.',
      'Toppings: sour cream, salsa, guacamole, hot sauce.',
      'Reheat from fridge: microwave 2 min, flip, 1 min. From frozen: 4-5 min.',
    ].join('\n'),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // STEAK DISHES
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Steak burritos (batch)',
    servings: 6, keepsForDays: 5,
    tags: 'burrito,beef,steak,handheld,freezable,batch,microwave-friendly',
    ingredients: [
      ing('flank or skirt steak', 1.5, 'lb'), ing('cooked white rice', 3, 'cups'),
      ing('bell pepper', 2, 'whole'), ing('yellow onion', 1, 'whole'),
      ing('large flour tortillas', 6, 'tortillas'), ing('shredded Mexican cheese', 1, 'cup'),
      ing('garlic', 3, 'cloves'), ing('cumin', 1, 'tsp'),
      ing('lime juice', 1, 'tbsp'), ing('hot sauce', 'to taste', ''),
    ],
    instructions: [
      '1. Cook rice.',
      '2. Season steak with salt + pepper + cumin + garlic. Sear on high 3-4 min per side. Rest 5 min, slice thin against grain.',
      '3. Sauté sliced peppers + onion in same pan until soft.',
      '4. Fill tortillas: rice → steak → peppers/onion → cheese → hot sauce → squeeze of lime.',
      '5. Roll tight, wrap in foil.',
      'Toppings: sour cream, salsa, guacamole.',
      'Reheat: microwave 2 min from fridge.',
    ].join('\n'),
  },

  {
    title: 'Steak hibachi rice bowl',
    servings: 4, keepsForDays: 4,
    tags: 'rice-bowl,steak,beef,asian,hibachi,batch,microwave-friendly',
    ingredients: [
      ing('sirloin or flank steak', 1, 'lb'), ing('cooked white rice', 4, 'cups'),
      ing('frozen stir-fry veg mix', 1, 'bag'), ing('butter', 3, 'tbsp'),
      ing('soy sauce', 3, 'tbsp'), ing('garlic', 4, 'cloves'),
      ing('sesame oil', 1, 'tbsp'), ing('lemon juice', 1, 'tbsp'),
      ing('eggs', 2, 'eggs'), ing('neutral oil', 1, 'tbsp'),
    ],
    instructions: [
      '1. Season steak. Sear 3-4 min per side in very hot pan. Rest, slice thin.',
      '2. Scramble eggs in butter in same pan, keep soft.',
      '3. Add garlic to pan, cook 30s. Add frozen veg. Cook 3 min.',
      '4. Add rice, soy, sesame oil, lemon juice. Toss and fry 3 min.',
      '5. Plate: rice/veg → sliced steak + eggs on top.',
      'Hibachi sauce mix: mayo + soy + garlic — mix ahead and portion in fridge.',
      'Toppings: sesame seeds, green onion, hibachi sauce, sriracha.',
      REHEAT,
    ].join('\n'),
  },

  {
    title: 'Steak rice bowl (simple)',
    servings: 4, keepsForDays: 4,
    tags: 'rice-bowl,steak,beef,asian,batch,microwave-friendly',
    ingredients: [
      ing('flank or skirt steak', 1, 'lb'), ing('cooked white rice', 4, 'cups'),
      ing('frozen stir-fry veg mix', 1, 'bag'), ing('soy sauce', 3, 'tbsp'),
      ing('sesame oil', 1, 'tbsp'), ing('garlic', 3, 'cloves'),
    ],
    instructions: [
      '1. Cook rice.',
      '2. Sear steak 3-4 min per side on high. Rest 5 min, slice against grain.',
      '3. Stir-fry frozen veg with garlic + sesame oil + soy.',
      '4. Layer: rice → veg → sliced steak. Drizzle pan juices over top.',
      'Toppings: green onion, sesame seeds, sriracha.',
      REHEAT,
    ].join('\n'),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SANDWICHES & BURGERS
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Cheeseburgers (batch-cook patties)',
    servings: 4, keepsForDays: 4,
    tags: 'burger,beef,ground-beef,sandwich,batch',
    ingredients: [
      ing('ground beef (80/20)', 1, 'lb'), ing('hamburger buns or bread', 4, 'buns'),
      ing('sliced cheese (American or cheddar)', 4, 'slices'), ing('lettuce', 4, 'leaves'),
      ing('tomato', 1, 'whole'), ing('yellow onion', 0.5, 'whole'),
      ing('garlic powder', 1, 'tsp'), ing('Worcestershire sauce', 1, 'tsp'),
    ],
    instructions: [
      '1. Mix ground beef with garlic powder + Worcestershire. Form 4 patties.',
      '2. Cook on high heat 3-4 min per side. Add cheese on the flip.',
      '3. Store cooked patties in fridge (4 days) — build sandwich fresh.',
      '4. Reheat patty 60-90s in microwave, build on bun with lettuce/tomato/onion.',
      'Toppings: ketchup, mustard, mayo, pickles, sriracha mayo (mix sriracha + mayo).',
    ].join('\n'),
  },

  {
    title: 'Steak & cheese sandwich',
    servings: 4, keepsForDays: 3,
    tags: 'sandwich,steak,beef,hot,batch',
    ingredients: [
      ing('flank or skirt steak (or leftover)', 1, 'lb'), ing('sandwich rolls or bread', 4, 'rolls'),
      ing('sliced provolone or American cheese', 4, 'slices'), ing('yellow onion', 1, 'whole'),
      ing('bell pepper', 1, 'whole'), ing('butter', 1, 'tbsp'),
    ],
    instructions: [
      '1. Slice peppers + onion. Sauté in butter 6-8 min until soft and lightly caramelized.',
      '2. Slice steak thin (or use leftover). Add to pan just to warm through.',
      '3. Pile on roll. Add cheese. Melt under broiler 30s, or microwave 30s.',
      'Toppings: mayo, mustard, hot sauce, pickled peppers (banana peppers are great).',
      REHEAT,
    ].join('\n'),
  },

  {
    title: 'Chicken sandwich',
    servings: 4, keepsForDays: 3,
    tags: 'sandwich,chicken,batch',
    ingredients: [
      ing('chicken breasts or thighs', 1, 'lb'), ing('sandwich buns or bread', 4, 'rolls'),
      ing('lettuce', 4, 'leaves'), ing('tomato', 1, 'whole'),
      ing('sliced cheese', 4, 'slices'), ing('garlic powder', 1, 'tsp'),
      ing('paprika', 1, 'tsp'), ing('mayo', 'to taste', ''),
    ],
    instructions: [
      '1. Season chicken with salt + pepper + garlic powder + paprika.',
      '2. Pan-sear 6-8 min per side until 165°F. Rest 5 min, slice.',
      '3. Store sliced chicken in fridge. Build sandwich fresh to keep bread from getting soggy.',
      'Toppings: mayo, sriracha mayo, lettuce, tomato, pickles, cheese.',
    ].join('\n'),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DAILY STAPLE
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Morning protein shake (daily)',
    servings: 1, keepsForDays: 0,
    tags: 'shake,breakfast,protein,daily,no-cook,high-protein',
    ingredients: [
      ing('Greek yogurt', '½', 'cup'), ing('protein powder', 2, 'scoops'),
      ing('peanut butter', 2, 'tbsp'), ing('frozen berries', '½', 'cup'),
      ing('whole milk', 'splash to thin', ''),
    ],
    instructions: [
      '1. Add everything to blender. Blend until smooth. Drink fresh.',
      'Protein count approx: ~50-60g depending on powder.',
      'Variation: add a banana for extra carbs on workout days.',
      'Variation: swap peanut butter for almond butter.',
    ].join('\n'),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // HIGH-PROTEIN SNACKS
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Hard boiled eggs (reference only)',
    servings: 6, keepsForDays: 7,
    tags: 'snack,high-protein,eggs,batch,no-meal-prep-suggest',
    ingredients: [
      ing('eggs', 12, 'eggs'), ing('salt + pepper', 'to taste', ''),
    ],
    instructions: [
      '1. Place eggs in pot. Cover with cold water by 1 inch.',
      '2. Bring to full boil. Turn off heat. Cover + sit 10-11 min.',
      '3. Transfer to ice bath (or cold running water) 5 min.',
      '4. Peel and store in fridge. Keep shells on until eating for longer shelf life.',
      'Season with hot sauce, everything bagel seasoning, or just salt.',
      'NOTE: kept for reference only.',
    ].join('\n'),
  },

  {
    title: 'Greek yogurt protein bowl',
    servings: 1, keepsForDays: 0,
    tags: 'snack,breakfast,high-protein,no-cook,yogurt',
    ingredients: [
      ing('Greek yogurt (plain, full-fat or 2%)', 1, 'cup'),
      ing('frozen or fresh berries', '½', 'cup'),
      ing('honey', 1, 'tbsp'), ing('granola (optional)', '¼', 'cup'),
      ing('peanut butter or almond butter (optional)', 1, 'tbsp'),
    ],
    instructions: [
      '1. Spoon yogurt into bowl. Top with berries (thaw frozen ones briefly in microwave).',
      '2. Drizzle honey. Add granola for crunch + peanut butter for fat.',
      'Protein: ~20-25g from yogurt alone.',
      'Variation: add protein powder (stir in 1 scoop) to push to 40g+.',
    ].join('\n'),
  },

  {
    title: 'Peanut butter protein bites (no-bake)',
    servings: 12, keepsForDays: 14,
    tags: 'snack,high-protein,no-bake,peanut-butter,batch,sweet',
    ingredients: [
      ing('old-fashioned oats', 1, 'cup'), ing('peanut butter', '½', 'cup'),
      ing('honey', '⅓', 'cup'), ing('protein powder', 1, 'scoop'),
      ing('mini chocolate chips (optional)', '¼', 'cup'),
      ing('flaxseed meal (optional, good fiber/fat)', 2, 'tbsp'),
    ],
    instructions: [
      '1. Mix everything in a bowl until fully combined.',
      '2. Refrigerate mixture 30 min (easier to roll when cold).',
      '3. Roll into ~12 balls, about 1 inch each.',
      '4. Store in fridge. Grab 2-3 as a pre/post-workout snack.',
      'Protein: ~8-10g per 2 balls.',
      'Can freeze for up to 2 months.',
    ].join('\n'),
  },

  {
    title: 'Tuna rice bowl (quick no-cook protein)',
    servings: 1, keepsForDays: 0,
    tags: 'rice-bowl,tuna,high-protein,quick,no-cook,cheap',
    ingredients: [
      ing('canned tuna in water (5oz can)', 1, 'can'), ing('cooked rice', 1, 'cup'),
      ing('soy sauce', 1, 'tbsp'), ing('sesame oil', 1, 'tsp'),
      ing('sriracha', 1, 'tsp'), ing('green onion', 2, 'stalks'),
      ing('sesame seeds', 1, 'tsp'), ing('mayo (optional)', 1, 'tbsp'),
    ],
    instructions: [
      '1. Drain tuna. Mix with soy + sesame oil + sriracha + mayo if using.',
      '2. Spoon over a bowl of rice.',
      '3. Top with green onion + sesame seeds.',
      'Quick work-day lunch: heat rice in microwave, top with tuna mix cold.',
      'Protein: ~35-40g. Total prep: 3 min.',
      'Keep cans of tuna at work as backup protein.',
    ].join('\n'),
  },

  {
    title: 'Overnight oats (high protein)',
    servings: 1, keepsForDays: 5,
    tags: 'breakfast,snack,high-protein,no-cook,oats,make-ahead',
    ingredients: [
      ing('old-fashioned oats', '½', 'cup'), ing('Greek yogurt', '½', 'cup'),
      ing('protein powder (vanilla or unflavored)', 1, 'scoop'),
      ing('whole milk or almond milk', '½', 'cup'), ing('frozen berries', '¼', 'cup'),
      ing('peanut butter', 1, 'tbsp'), ing('honey', 1, 'tsp'),
      ing('chia seeds (optional)', 1, 'tsp'),
    ],
    instructions: [
      '1. Mix oats + yogurt + protein powder + milk + peanut butter + honey in a jar or container.',
      '2. Stir well. Top with frozen berries (they thaw overnight).',
      '3. Cover, refrigerate overnight (minimum 4 hours).',
      '4. Eat cold or microwave 60s.',
      'Make 5 jars on Sunday for the whole work week.',
      'Protein: ~35-40g. Great pre-workout breakfast.',
    ].join('\n'),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // BAKING
  //
  // The first sweet things in here, and the shape is different from everything
  // above: a baked good and the thing you spread on it are two recipes that are
  // also one recipe. All three entries are wanted — you might bake the muffins
  // and stop, or make the frosting for something else entirely — so the muffins
  // and the frosting are defined once, below, and the combined entry is BUILT
  // from them rather than typed a third time. Editing an ingredient in one place
  // changes it everywhere it appears, which a copy could not promise.
  // ══════════════════════════════════════════════════════════════════════════

  MUFFINS,
  FROSTING,
  combined(MUFFINS, FROSTING),

  {
    title: 'Monkey bread',
    servings: 10, keepsForDays: 3,
    tags: 'baking,dessert,sweet,pull-apart,cinnamon,shareable',
    ingredients: [
      ing('refrigerated biscuit dough', 2, 'cans (16.3 oz each)'),
      ing('granulated sugar', 1, 'cup'),
      ing('ground cinnamon', 2, 'tsp'),
      ing('unsalted butter', '¾', 'cup (1½ sticks)'),
      ing('packed brown sugar', '¾', 'cup'),
      ing('vanilla extract', 1, 'tsp'),
      ing('chopped pecans (optional)', '½', 'cup'),
    ],
    instructions: [
      'A standard version, seeded so there is something to start from — edit it in the app rather than treating it as a fixed recipe.',
      '1. Preheat the oven to 350°F (175°C). Grease a 10-inch bundt pan thoroughly, including the centre tube.',
      '2. Mix the granulated sugar and cinnamon in a large zip bag or bowl.',
      '3. Cut each biscuit into quarters. Toss the pieces through the cinnamon sugar until coated, and layer them loosely in the pan — scatter the pecans between layers if using. Do not pack them down; the gaps are what makes it pull apart.',
      '4. Melt the butter with the brown sugar over medium heat, stirring until the sugar dissolves. Take it off the heat and stir in the vanilla.',
      '5. Pour the caramel evenly over the dough. It will look like too much liquid; it is not.',
      '6. Bake 30-35 minutes, until the top is deep golden and the centre is not doughy. Tent with foil at ~25 minutes if it is browning fast.',
      '7. Cool in the pan for 10 minutes exactly, then invert onto a plate. Less and it collapses, more and the caramel sets and glues it in.',
      'Serve warm, pulled apart by hand. Reheat a portion 15-20 seconds in the microwave.',
      'Keeps 3 days covered at room temperature. It does not freeze well once baked.',
    ].join('\n'),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CHEESECAKE
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Turtle cheesecake with brown sugar pecan shortbread crust',
    servings: 12, keepsForDays: 5,
    prepMinutes: 90, cookMinutes: 110,
    tags: 'baking,dessert,sweet,cheesecake,caramel,chocolate,pecan,make-ahead',
    ingredients: [
      // Crust
      ing('unsalted butter, softened (crust)', '¾', 'cup (1½ sticks)'),
      ing('packed brown sugar (crust)', 1, 'cup'),
      ing('vanilla extract (crust)', '1½', 'tsp'),
      ing('all-purpose flour (crust)', '2¼', 'cups'),
      ing('salt (crust)', '¼', 'tsp'),
      ing('pecan chips (crust)', '¼', 'cup'),
      // Caramel
      ing('granulated sugar (caramel)', 2, 'cups'),
      ing('unsalted butter, room temperature (caramel)', '½', 'cup (1 stick)'),
      ing('heavy whipping cream, room temperature (caramel)', 1, 'cup'),
      ing('all-purpose flour (caramel layer)', 5, 'tbsp'),
      ing('pecan chips (caramel layer)', '¼', 'cup'),
      // Ganache
      ing('semi-sweet chocolate chips (ganache)', 6, 'oz (~1 cup)'),
      ing('heavy whipping cream (ganache)', 6, 'tbsp'),
      // Filling
      ing('cream cheese, room temperature', 24, 'oz (three 8-oz packages)'),
      ing('packed brown sugar (filling)', 1, 'cup'),
      ing('all-purpose flour (filling)', 3, 'tbsp'),
      ing('sour cream, room temperature', 1, 'cup'),
      ing('vanilla extract (filling)', '1½', 'tsp'),
      ing('large eggs, room temperature', 3, 'eggs'),
      // Topping
      ing('semi-sweet chocolate chips (drizzle)', 2, 'oz (~⅓ cup)'),
      ing('heavy whipping cream (drizzle)', 3, 'tbsp'),
      ing('pecan chips (topping)', '¼', 'cup'),
    ],
    instructions: [
      'Yield 12-14 slices. Total time ~9 hours including oven cooling and chilling. Buy: 1 pint heavy cream (1 9/16 cups used), 2¾ cups flour, 2 cups packed brown sugar, 8 oz chocolate chips, ¾ cup pecan chips. Equipment: 9-inch springform pan, parchment, heavy-duty foil, large roasting pan (water bath), electric mixer.',
      '',
      'STEP 1: BROWN SUGAR PECAN SHORTBREAD CRUST',
      '1. Preheat the oven to 350°F (177°C). Lightly grease the sides of a 9-inch springform pan and line the bottom with a parchment round.',
      '2. Beat the ¾ cup softened butter and 1 cup brown sugar on medium-high until completely smooth and creamy. Beat in 1½ tsp vanilla.',
      '3. Add 2¼ cups flour and ¼ tsp salt and beat on low just until incorporated. Fold in ¼ cup pecan chips. If crumbly, squeeze and knead it together by hand into a cohesive dough.',
      '4. Press evenly into the bottom and about 1 inch up the sides of the pan. Prick the bottom all over with a fork so it does not puff.',
      '5. Bake 15-18 minutes, until set and lightly golden at the edges. Cool completely. Lower the oven to 300°F (148°C).',
      '',
      'STEP 2: HOMEMADE CARAMEL SAUCE',
      '6. Have the butter and cream at room temperature (or slightly warmed) so the caramel does not seize.',
      '7. Spread 2 cups granulated sugar in an even layer in a large saucepan over medium-high heat. Whisk continuously — it clumps first, then melts into an amber liquid (~10 minutes).',
      '8. Once melted, stop whisking and cook just until a slightly darker amber that smells nutty. Remove from the heat immediately.',
      '9. Whisk in ½ cup butter (it will bubble vigorously), then slowly pour in 1 cup cream, whisking until smooth.',
      '10. Set aside 1 cup of the plain caramel at room temperature for the topping. Whisk 5 tbsp flour and ¼ cup pecan chips into the rest in the pan until smooth. Set aside.',
      '',
      'STEP 3: CHOCOLATE GANACHE LAYER',
      '11. Put 6 oz chocolate chips in a small heat-safe bowl. Heat 6 tbsp cream just to a boil and pour it over. Let sit undisturbed 2-3 minutes, then whisk gently until smooth and glossy.',
      '',
      'STEP 4: CREAM CHEESE FILLING',
      '12. Keep the mixer on LOW throughout — excess air causes surface cracks.',
      '13. Beat 24 oz cream cheese, 1 cup brown sugar and 3 tbsp flour until completely smooth. Scrape down the sides and bottom.',
      '14. Add 1 cup sour cream and 1½ tsp vanilla and beat until well combined.',
      '15. Add the 3 eggs one at a time, mixing just until combined after each. Do not overmix. Scrape down as needed.',
      '',
      'STEP 5: ASSEMBLY & WATER BATH',
      '16. Wrap the outside bottom and sides of the springform pan tightly in 2-3 layers of heavy-duty foil so no water leaks in.',
      '17. Spread the thickened caramel-pecan sauce over the cooled crust. Spread the ganache over the caramel. Gently pour or spoon the batter over the chocolate and smooth the top.',
      '18. Set the pan in a large roasting pan on the middle rack of the 300°F (148°C) oven. Pour hot water into the roasting pan to halfway up the sides of the springform.',
      '19. Bake 1 hour 35 minutes — the edges set, the centre 2-3 inches still slightly jiggly.',
      '20. Turn the oven off and leave the door closed 30 minutes. Crack the door about an inch and leave it another 30 minutes.',
      '21. Remove from the oven and water bath and peel off the foil. Spread about ½ cup of the reserved plain caramel over the warm cheesecake (microwave the caramel 10 seconds if too firm).',
      '22. Refrigerate uncovered or loosely covered at least 5-6 hours (or overnight) until completely cool and firm.',
      '',
      'STEP 6: FINAL TOPPING & SERVING',
      '23. Run a thin paring knife around the inside edge, unlock and remove the ring, and transfer to a platter.',
      '24. Put 2 oz chocolate chips in a small bowl. Heat 3 tbsp cream to a boil, pour over, let sit 3 minutes, then whisk smooth.',
      '25. Drizzle the remaining plain caramel and the chocolate sauce over the chilled cheesecake and sprinkle with the last ¼ cup pecan chips.',
      'For clean slices, wipe the knife with a warm, damp cloth between cuts. Keep leftovers refrigerated up to 5 days.',
    ],
  },


  // ══════════════════════════════════════════════════════════════════════════
  // BATCH MEAL PREP: FOUR FULL CONTAINERS, HIGHER CALORIE
  // ══════════════════════════════════════════════════════════════════════════

  {
    title: 'Drunken noodles (pad kee mao) with chicken thighs',
    servings: 4, keepsForDays: 4,
    tags: 'thai,noodles,rice-noodles,drunken-noodles,chicken,spicy,batch,microwave-friendly,meal-prep,high-calorie,high-protein',
    ingredients: [
      ing('boneless skinless chicken thighs', 2, 'lb'),
      ing('dried wide rice noodles (about ½ inch / 10-15 mm)', 12, 'oz'),
      ing('frozen bell pepper strips', 12, 'oz'),
      ing('yellow onion, sliced', '1½', 'large'),
      ing('neutral oil', 4, 'tbsp'),
      ing('garlic, minced', 6, 'cloves'),
      ing('Thai chiles (or 2 serranos), sliced', 4, ''),
      ing('dark soy sauce', 2, 'tbsp'),
      ing('light soy sauce', 2, 'tbsp'),
      ing('oyster sauce', 3, 'tbsp'),
      ing('fish sauce', 1, 'tbsp'),
      ing('sugar', 2, 'tbsp'),
      ing('holy basil (Thai or Italian basil if unavailable), loosely packed', 2, 'cups'),
    ],
    instructions: [
      'Note: despite the name, there is no alcohol in this dish. "Drunken" refers to the bold, spicy flavour, not an ingredient.',
      '1. Soak the noodles: put the dried rice noodles in a large heatproof bowl and cover with just-boiled water. Soak 8-12 minutes (package times vary), until bendable but still firm in the centre. Drain well and toss with 1 tbsp of the oil so they do not stick. They finish cooking in the pan, so slightly underdone is right.',
      '2. Mix the sauce: whisk the dark soy, light soy, oyster sauce, fish sauce, sugar and ¼ cup water in a small bowl.',
      '3. Cook the chicken: slice the thighs into ½-inch strips. Heat 1 tbsp oil in a large skillet or wok over high heat until shimmering. Cook the chicken in two batches, 5-6 minutes each, until browned and cooked to an internal 165°F (74°C). Transfer to a plate.',
      '4. Cook the vegetables: add 2 tbsp oil and drop the heat to medium-high. Add the sliced onion and the frozen pepper strips straight from the freezer; stir-fry 4-5 minutes until the onion softens and the excess water cooks off. Add the garlic and chiles and stir for 30 seconds.',
      '5. Combine: return the chicken to the pan, then add the noodles and the sauce. Toss gently with tongs for 2-3 minutes over medium-high heat until the sauce is absorbed and the noodles are tender but still slightly underdone. If they stick, add a splash of water.',
      '6. Finish: turn off the heat and fold in the basil until just wilted.',
      'Portion: divide evenly among 4 containers and let them cool before lidding and refrigerating (within 2 hours of cooking).',
      'Reheating tip: noodles keep absorbing sauce in the fridge. Stir 1-2 tbsp of water (or a spoonful of reserved sauce) into each container before reheating.',
      'Storage: keeps 4 days in the fridge. Rice noodles freeze poorly (they turn brittle and crumbly when thawed), so plan to eat this one within the 4 days.',
      'Estimated per serving: 790 kcal, 53 g protein, 89 g carbs, 24 g fat (estimate from typical label values; check against what you bought).',
      REHEAT,
      'To stretch this to 6 servings, multiply every ingredient by 1.5 (use a larger pan or pot, or cook in two batches); each serving stays the same.',
    ].join('\n'),
  },

  {
    title: 'Pad Thai with tamarind (extra chicken and peanuts)',
    servings: 4, keepsForDays: 4,
    tags: 'thai,noodles,rice-noodles,pad-thai,chicken,peanuts,egg,tamarind,batch,microwave-friendly,meal-prep,high-calorie,high-protein',
    ingredients: [
      ing('boneless skinless chicken thighs', 2, 'lb'),
      ing('dried rice noodles (pad Thai width, about ¼ inch)', 10, 'oz'),
      ing('large eggs', 4, ''),
      ing('dry-roasted peanuts, roughly chopped (about ½ cup)', '2½', 'oz'),
      ing('fresh bean sprouts', 12, 'oz'),
      ing('green onions, cut in 1-inch pieces', 6, 'stalks'),
      ing('neutral oil', 3, 'tbsp'),
      ing('garlic, minced', 4, 'cloves'),
      ing('seedless tamarind paste (concentrate)', 4, 'tbsp'),
      ing('fish sauce', 3, 'tbsp'),
      ing('brown sugar (or palm sugar)', 3, 'tbsp'),
      ing('red pepper flakes', 1, 'pinch'),
      ing('lime wedges, for serving', 4, ''),
    ],
    instructions: [
      '1. Soak the noodles: cover the dried rice noodles with hot tap water (not boiling) and soak 20-30 minutes, or with just-boiled water for 6-8 minutes, until flexible but still clearly firm in the middle. Drain well. They finish cooking in the pan.',
      '2. Make the sauce: stir the tamarind paste, fish sauce, brown sugar, 3 tbsp water and the pepper flakes until the sugar dissolves. Use real tamarind paste (a dark, sour, seedless concentrate sold in jars or blocks), not ketchup or a bottled pad Thai sauce.',
      '3. Cook the chicken: slice the thighs into thin ½-inch strips. Heat 1 tbsp oil in a large skillet or wok over high heat. Cook the chicken in two batches, 5-6 minutes each, until browned and cooked to an internal 165°F (74°C). Set aside.',
      '4. Scramble the eggs: add 1 tbsp oil and lower the heat to medium, add the garlic for 20 seconds, then pour in the beaten eggs. Stir gently for 1 minute until just set.',
      '5. Combine: add the last 1 tbsp oil, then the noodles, chicken and sauce. Toss over medium-high heat 2-3 minutes until the noodles have absorbed the sauce and are tender but slightly underdone. Splash in water if dry.',
      '6. Finish: add the bean sprouts and green onions and toss 1 minute, so the sprouts stay crisp-tender. Portion, then top each container with the chopped peanuts (they stay crunchier added at the end; stir them in for softer nuts). Squeeze lime over each serving after reheating.',
      'Allergen note: contains peanuts, eggs and fish.',
      'Portion: divide evenly among 4 containers and let them cool before lidding and refrigerating (within 2 hours of cooking).',
      'Reheating tip: noodles keep absorbing sauce in the fridge. Stir 1-2 tbsp of water (or a spoonful of reserved sauce) into each container before reheating.',
      'Storage: keeps 4 days in the fridge. Rice noodles freeze poorly (they turn brittle and crumbly when thawed), so plan to eat this one within the 4 days.',
      'Estimated per serving: 910 kcal, 64 g protein, 88 g carbs, 34 g fat (estimate from typical label values; check against what you bought).',
      REHEAT,
      'To stretch this to 6 servings, multiply every ingredient by 1.5 (use a larger pan or pot, or cook in two batches); each serving stays the same.',
    ].join('\n'),
  },

  {
    title: 'Pantry spaghetti lo mein (chicken and frozen veg)',
    servings: 4, keepsForDays: 4,
    tags: 'chinese,noodles,lo-mein,pasta,spaghetti,chicken,pantry,batch,microwave-friendly,meal-prep,high-calorie,high-protein',
    ingredients: [
      ing('boneless skinless chicken thighs', 2, 'lb'),
      ing('dried spaghetti', 12, 'oz'),
      ing('baking soda (for the boiling water)', '1½', 'tbsp'),
      ing('frozen stir-fry vegetable mix', 16, 'oz'),
      ing('neutral oil', 3, 'tbsp'),
      ing('toasted sesame oil', 1, 'tbsp'),
      ing('garlic, minced', 5, 'cloves'),
      ing('soy sauce', 3, 'tbsp'),
      ing('dark soy sauce', 1, 'tbsp'),
      ing('oyster sauce', 3, 'tbsp'),
      ing('sugar', 1, 'tbsp'),
      ing('cornstarch', 1, 'tbsp'),
    ],
    instructions: [
      '1. Make the noodles springy: bring 3 quarts of water to a boil in a large pot and slowly stir in 1½ tbsp baking soda (it foams up). The alkaline water gives spaghetti the springy, slightly yellow bite of lo mein noodles. Add the spaghetti and start tasting at 4 minutes, because alkaline water softens pasta faster than the package time suggests. Pull it while a little firmer than you would eat it; it keeps softening in the sauce.',
      '2. Rinse well: drain, then rinse under cold running water, tossing, for a full minute until completely cool. This washes off the baking soda (left on, it tastes soapy and metallic) and the surface starch, and stops the cooking. Drain very well and toss with the sesame oil.',
      '3. Mix the sauce: whisk the soy sauce, dark soy, oyster sauce, sugar, cornstarch and ½ cup cold water.',
      '4. Cook the chicken: slice the thighs into thin strips. Heat 2 tbsp oil in a large skillet or wok over high heat. Cook in two batches, 5-6 minutes each, until browned and cooked to an internal 165°F (74°C). Set aside.',
      '5. Cook the vegetables: add 1 tbsp oil and the garlic to the pan over medium-high heat for 20 seconds, then the frozen vegetables straight from the bag. Stir-fry 5-6 minutes until hot and the water has cooked off.',
      '6. Combine: return the chicken, add the noodles, then pour in the sauce (whisk again first). Toss 2-3 minutes over medium-high heat until glossy and the sauce has thickened and coated everything.',
      'Portion: divide evenly among 4 containers and let them cool before lidding and refrigerating (within 2 hours of cooking).',
      'Reheating tip: noodles keep absorbing sauce in the fridge. Stir 1-2 tbsp of water (or a spoonful of reserved sauce) into each container before reheating.',
      'Storage: keeps 4 days in the fridge. Freezes acceptably for up to 2 months (the noodles soften a little on thawing); thaw overnight in the fridge before reheating.',
      'Estimated per serving: 795 kcal, 60 g protein, 81 g carbs, 25 g fat (estimate from typical label values; check against what you bought).',
      REHEAT,
      'To stretch this to 6 servings, multiply every ingredient by 1.5 (use a larger pan or pot, or cook in two batches); each serving stays the same.',
    ].join('\n'),
  },

  {
    title: 'Beef and broccoli lo mein',
    servings: 4, keepsForDays: 4,
    tags: 'chinese,noodles,lo-mein,pasta,spaghetti,beef,broccoli,batch,microwave-friendly,meal-prep,high-calorie,high-protein',
    ingredients: [
      ing('flank steak or sirloin', 1.5, 'lb'),
      ing('dried lo mein noodles or dried spaghetti', 12, 'oz'),
      ing('baking soda (only if using spaghetti)', '1½', 'tbsp'),
      ing('frozen broccoli florets', 16, 'oz'),
      ing('neutral oil', 4, 'tbsp'),
      ing('toasted sesame oil', 1, 'tbsp'),
      ing('garlic, minced', 5, 'cloves'),
      ing('fresh ginger, grated', 1, 'tbsp'),
      ing('soy sauce', 3, 'tbsp'),
      ing('dark soy sauce', 1, 'tbsp'),
      ing('oyster sauce', 3, 'tbsp'),
      ing('sugar', 1, 'tbsp'),
      ing('cornstarch', 1, 'tbsp'),
    ],
    instructions: [
      '1. Slice the beef: freeze the steak for 20 minutes to make slicing easier, then cut it across the grain into ⅛-inch-thick strips. Toss with 1 tbsp of the soy sauce and the cornstarch.',
      '2. Cook the noodles: for lo mein noodles, follow the package but pull them 1-2 minutes early. For spaghetti, bring 3 quarts of water to a boil, slowly stir in 1½ tbsp baking soda, cook until a little firm (start tasting at 4 minutes), then rinse under cold running water for a full minute to wash off the baking soda. Drain well and toss with the sesame oil. Either way, keep them slightly underdone.',
      '3. Mix the sauce: whisk the remaining 2 tbsp soy sauce, the dark soy, oyster sauce, sugar and ½ cup water.',
      '4. Sear the beef: heat 2 tbsp oil in a large skillet or wok over high heat until just smoking. Cook the beef in two batches, 1-2 minutes per side, until browned and at least 145°F (63°C) inside. Set aside.',
      '5. Cook the broccoli: add 2 tbsp oil, the garlic and ginger for 20 seconds over medium-high heat, then the frozen broccoli straight from the bag. Stir-fry 5-6 minutes until hot and tender-crisp.',
      '6. Combine: return the beef, add the noodles and the sauce. Toss about 2 minutes until glossy and coated.',
      'Portion: divide evenly among 4 containers and let them cool before lidding and refrigerating (within 2 hours of cooking).',
      'Reheating tip: noodles keep absorbing sauce in the fridge. Stir 1-2 tbsp of water (or a spoonful of reserved sauce) into each container before reheating.',
      'Storage: keeps 4 days in the fridge. Freezes acceptably for up to 2 months (the broccoli softens); thaw overnight in the fridge before reheating.',
      'Estimated per serving: 805 kcal, 52 g protein, 80 g carbs, 31 g fat (estimate from typical label values; check against what you bought).',
      REHEAT,
      'To stretch this to 6 servings, multiply every ingredient by 1.5 (use a larger pan or pot, or cook in two batches); each serving stays the same.',
    ].join('\n'),
  },

  {
    title: 'Thai basil chicken fried rice',
    servings: 4, keepsForDays: 3,
    tags: 'thai,fried-rice,rice,chicken,basil,spicy,batch,microwave-friendly,meal-prep,high-calorie,high-protein',
    ingredients: [
      ing('boneless skinless chicken thighs, diced', 2, 'lb'),
      ing('cold cooked jasmine rice (from about 2 cups dry)', 6, 'cups'),
      ing('large eggs', 3, ''),
      ing('frozen cut green beans', 16, 'oz'),
      ing('yellow onion, sliced', 1, 'medium'),
      ing('neutral oil', 3, 'tbsp'),
      ing('garlic, minced', 6, 'cloves'),
      ing('Thai chiles, sliced', 4, ''),
      ing('oyster sauce', 3, 'tbsp'),
      ing('light soy sauce', 2, 'tbsp'),
      ing('dark soy sauce', 1, 'tbsp'),
      ing('fish sauce', 1, 'tbsp'),
      ing('sugar', 2, 'tsp'),
      ing('Thai or holy basil leaves, loosely packed', 2, 'cups'),
    ],
    instructions: [
      'Fried rice note: use rice cooked the day before (or at least 4 hours ahead). Cool it quickly by spreading it about 1 inch deep on a sheet pan, letting the steam escape for 15-20 minutes, then refrigerating within 2 hours of cooking. Cold, dry rice fries up in separate grains instead of gummy clumps.',
      '1. Mix the sauce: whisk the oyster sauce, soy sauce, dark soy, fish sauce and sugar with 2 tbsp water. Break up any clumps in the cold rice with your hands.',
      '2. Cook the chicken: heat 1 tbsp oil in a large skillet or wok over high heat. Cook the diced chicken in two batches, 5-6 minutes each, until browned and cooked to an internal 165°F (74°C). Set aside.',
      '3. Cook the vegetables: add 1 tbsp oil, the onion and the frozen green beans straight from the bag. Stir-fry over medium-high heat 6-7 minutes until the beans are hot and tender-crisp. Add the garlic and chiles for 30 seconds.',
      '4. Scramble the eggs: push the vegetables aside, add the last 1 tbsp oil and the beaten eggs; stir until just set, about 1 minute.',
      '5. Fry the rice: add the rice and the sauce, return the chicken, and stir-fry over high heat for 4-5 minutes, pressing the rice against the pan so it toasts a little.',
      '6. Finish: turn off the heat and fold in the basil until wilted.',
      'Portion: divide evenly among 4 containers and let them cool before lidding and refrigerating (within 2 hours of cooking).',
      'Storage: keeps 3 days in the fridge, one less than the other dishes because the rice is already a day old. Freezes well for up to 2 months; thaw overnight in the fridge and reheat until steaming hot (165°F). Reheat only once.',
      'Estimated per serving: 805 kcal, 60 g protein, 84 g carbs, 24 g fat (estimate from typical label values; check against what you bought).',
      REHEAT,
      'To stretch this to 6 servings, multiply every ingredient by 1.5 (use a larger pan or pot, or cook in two batches); each serving stays the same.',
    ].join('\n'),
  },

  {
    title: 'Pineapple chicken fried rice',
    servings: 4, keepsForDays: 3,
    tags: 'thai,fried-rice,rice,chicken,pineapple,cashews,curry,batch,microwave-friendly,meal-prep,high-calorie,high-protein',
    ingredients: [
      ing('boneless skinless chicken thighs, diced', 2, 'lb'),
      ing('cold cooked jasmine rice (from about 2 cups dry)', 6, 'cups'),
      ing('large eggs', 3, ''),
      ing('fresh or canned pineapple chunks (in juice, drained)', 2, 'cups'),
      ing('roasted cashews (about ⅓ cup)', 2, 'oz'),
      ing('frozen peas and carrots', 12, 'oz'),
      ing('curry powder', 2, 'tbsp'),
      ing('soy sauce', 3, 'tbsp'),
      ing('neutral oil', 3, 'tbsp'),
      ing('garlic, minced', 4, 'cloves'),
      ing('green onions, sliced', 4, 'stalks'),
    ],
    instructions: [
      'Fried rice note: use rice cooked the day before (or at least 4 hours ahead). Cool it quickly by spreading it about 1 inch deep on a sheet pan, letting the steam escape for 15-20 minutes, then refrigerating within 2 hours of cooking. Cold, dry rice fries up in separate grains instead of gummy clumps.',
      '1. Prep: pat the drained pineapple dry with paper towels (wet fruit steams the rice). Break up any clumps in the cold rice. Toss the diced chicken with 1 tbsp of the curry powder.',
      '2. Cook the chicken: heat 1 tbsp oil in a large skillet or wok over high heat. Cook the chicken in two batches, 5-6 minutes each, until browned and cooked to an internal 165°F (74°C). Set aside.',
      '3. Sear the pineapple: add 1 tbsp oil and the pineapple; cook 2-3 minutes without stirring until the edges caramelise. Add the frozen peas and carrots and cook 3 minutes. Add the garlic for 30 seconds.',
      '4. Scramble the eggs: push everything aside, add the last 1 tbsp oil and the beaten eggs, stirring until just set, about 1 minute.',
      '5. Fry the rice: add the rice, the remaining 1 tbsp curry powder and the soy sauce. Return the chicken. Stir-fry over high heat 4-5 minutes until hot and lightly toasted.',
      '6. Finish: stir in the green onions and cashews off the heat.',
      'Portion: divide evenly among 4 containers and let them cool before lidding and refrigerating (within 2 hours of cooking).',
      'Storage: keeps 3 days in the fridge, one less than the other dishes because the rice is already a day old. Freezes acceptably for up to 2 months (pineapple and cashews soften); thaw overnight in the fridge and reheat until steaming hot (165°F).',
      'Estimated per serving: 920 kcal, 63 g protein, 96 g carbs, 31 g fat (estimate from typical label values; check against what you bought).',
      REHEAT,
      'To stretch this to 6 servings, multiply every ingredient by 1.5 (use a larger pan or pot, or cook in two batches); each serving stays the same.',
    ].join('\n'),
  },

  {
    title: 'Singapore curry noodles (chicken and egg)',
    servings: 4, keepsForDays: 4,
    tags: 'singaporean,noodles,rice-noodles,rice-vermicelli,curry,chicken,egg,batch,microwave-friendly,meal-prep,high-calorie,high-protein',
    ingredients: [
      ing('boneless skinless chicken thighs', 2, 'lb'),
      ing('dried rice vermicelli', 10, 'oz'),
      ing('large eggs', 4, ''),
      ing('frozen bell pepper strips', 12, 'oz'),
      ing('yellow onion, sliced', 1, 'medium'),
      ing('curry powder (Madras style)', 3, 'tbsp'),
      ing('soy sauce', 3, 'tbsp'),
      ing('neutral oil', 4, 'tbsp'),
      ing('garlic, minced', 4, 'cloves'),
      ing('low-sodium chicken broth', '½', 'cup'),
      ing('sugar', 1, 'tsp'),
      ing('ground white or black pepper', '½', 'tsp'),
    ],
    instructions: [
      '1. Soak the noodles: cover the vermicelli with just-boiled water and let stand 4-6 minutes, until pliable but still firm. Drain, rinse briefly with cool water and drain very well. Keep them slightly underdone.',
      '2. Cook the chicken: slice the thighs into thin strips and toss with 1 tbsp of the curry powder. Heat 1 tbsp oil in a large skillet or wok over high heat. Cook in two batches, 5-6 minutes each, until browned and cooked to an internal 165°F (74°C). Set aside.',
      '3. Scramble the eggs: add 1 tbsp oil over medium heat, pour in the beaten eggs and stir 1 minute until just set. Break into pieces and set aside with the chicken.',
      '4. Cook the vegetables: add 2 tbsp oil over medium-high heat, then the onion and frozen pepper strips straight from the freezer. Stir-fry 5 minutes until the water cooks off. Add the garlic and the remaining 2 tbsp curry powder and stir 30 seconds to toast the spices.',
      '5. Combine: add the chicken broth, soy sauce, sugar and pepper and bring to a simmer. Add the noodles and toss with tongs 2-3 minutes until the liquid is absorbed.',
      '6. Finish: fold in the eggs and chicken. If it looks dry, add a splash of water.',
      'Portion: divide evenly among 4 containers and let them cool before lidding and refrigerating (within 2 hours of cooking).',
      'Reheating tip: noodles keep absorbing sauce in the fridge. Stir 1-2 tbsp of water (or a spoonful of reserved sauce) into each container before reheating.',
      'Storage: keeps 4 days in the fridge. Rice noodles freeze poorly (they turn brittle and crumbly when thawed), so plan to eat this one within the 4 days.',
      'Estimated per serving: 790 kcal, 59 g protein, 71 g carbs, 29 g fat (estimate from typical label values; check against what you bought).',
      REHEAT,
      'To stretch this to 6 servings, multiply every ingredient by 1.5 (use a larger pan or pot, or cook in two batches); each serving stays the same.',
    ].join('\n'),
  },

  {
    title: 'Peanut chicken noodles (spaghetti)',
    servings: 4, keepsForDays: 4,
    tags: 'asian,noodles,pasta,spaghetti,peanut,chicken,batch,microwave-friendly,meal-prep,high-calorie,high-protein',
    ingredients: [
      ing('boneless skinless chicken thighs', 2, 'lb'),
      ing('dried spaghetti', 12, 'oz'),
      ing('frozen stir-fry vegetable mix', 16, 'oz'),
      ing('creamy peanut butter', 6, 'tbsp'),
      ing('soy sauce', 3, 'tbsp'),
      ing('honey', 1, 'tbsp'),
      ing('rice vinegar', 2, 'tbsp'),
      ing('toasted sesame oil', 1, 'tbsp'),
      ing('neutral oil', 2, 'tbsp'),
      ing('garlic, minced', 4, 'cloves'),
      ing('fresh ginger, grated', 1, 'tbsp'),
      ing('chili garlic sauce or sriracha', 1, 'tbsp'),
      ing('green onions, sliced', 4, 'stalks'),
    ],
    instructions: [
      '1. Cook the pasta: boil the spaghetti in well-salted water 1 minute less than the package says, so it is slightly underdone. Reserve ¾ cup of the pasta water, then drain.',
      '2. Cook the chicken: slice the thighs into thin strips. Heat 1 tbsp neutral oil in a large skillet over high heat. Cook in two batches, 5-6 minutes each, until browned and cooked to an internal 165°F (74°C). Set aside.',
      '3. Cook the vegetables: add 1 tbsp oil and the garlic and ginger for 20 seconds over medium-high heat, then the frozen vegetables straight from the bag. Stir-fry 5-6 minutes until hot.',
      '4. Make the warm peanut sauce: in a small saucepan over low heat, whisk the peanut butter, soy sauce, honey, rice vinegar, sesame oil, chili sauce and ½ cup of the hot pasta water for 2-3 minutes until smooth and pourable. Thin with more pasta water if it tightens; it should coat a spoon loosely.',
      '5. Combine: return the chicken to the skillet, add the pasta and the peanut sauce and toss over medium heat 1-2 minutes until coated. Fold in the green onions.',
      'Allergen note: contains peanuts.',
      'Portion: divide evenly among 4 containers and let them cool before lidding and refrigerating (within 2 hours of cooking).',
      'Reheating tip: peanut sauce tightens as it cools. Keep a little extra pasta water (or plain water) to stir in: about 2 tbsp per container before reheating.',
      'Storage: keeps 4 days in the fridge. Freezes acceptably for up to 2 months (the sauce can thicken or separate slightly; stir in water when reheating).',
      'Estimated per serving: 890 kcal, 65 g protein, 84 g carbs, 33 g fat (estimate from typical label values; check against what you bought).',
      REHEAT,
      'To stretch this to 6 servings, multiply every ingredient by 1.5 (use a larger pan or pot, or cook in two batches); each serving stays the same.',
    ].join('\n'),
  },

  {
    title: 'Creamy Cajun chicken pasta',
    servings: 4, keepsForDays: 4,
    tags: 'cajun,american,pasta,penne,chicken,cream,no-red-sauce,batch,microwave-friendly,meal-prep,high-calorie,high-protein',
    ingredients: [
      ing('boneless skinless chicken thighs', 2, 'lb'),
      ing('dried penne or rotini (short pasta)', 12, 'oz'),
      ing('frozen bell pepper strips', 12, 'oz'),
      ing('frozen chopped spinach, thawed and squeezed dry', 10, 'oz'),
      ing('yellow onion, diced', 1, 'medium'),
      ing('Cajun seasoning (salt-free or low-salt, if you can)', 3, 'tbsp'),
      ing('heavy cream', '⅔', 'cup'),
      ing('low-sodium chicken broth', '½', 'cup'),
      ing('grated parmesan', '1½', 'oz'),
      ing('neutral oil', 2, 'tbsp'),
      ing('butter', 1, 'tbsp'),
      ing('garlic, minced', 4, 'cloves'),
    ],
    instructions: [
      '1. Cook the pasta: boil in well-salted water 2 minutes less than the package says (it will be quite firm). Reserve ½ cup of the pasta water, then drain.',
      '2. Cook the chicken: cut the thighs into bite-size pieces and toss with 2 tbsp of the Cajun seasoning. Heat the oil in a large deep skillet over medium-high heat. Cook in two batches, 6-7 minutes each, until browned and cooked to an internal 165°F (74°C). Set aside.',
      '3. Cook the vegetables: melt the butter in the pan, add the onion and the frozen pepper strips straight from the freezer. Cook 6-7 minutes until the water has cooked off and the onion softens. Add the garlic and remaining 1 tbsp Cajun seasoning for 30 seconds.',
      '4. Make the sauce: pour in the broth, scraping up the browned bits, then the cream. Simmer gently over medium-low heat 3-4 minutes until it coats a spoon. Stir in the spinach and the parmesan until melted.',
      '5. Combine: add the chicken (and any juices) and the pasta. Toss over low heat 1-2 minutes, loosening with the reserved pasta water. The sauce should look slightly loose; it thickens in the fridge.',
      'Note: Cajun blends vary a lot in salt, so taste before adding any extra salt.',
      'Portion: divide evenly among 4 containers and let them cool before lidding and refrigerating (within 2 hours of cooking).',
      'Reheating tip: cream sauces tighten as they cool. Stir in 1-2 tbsp of water or milk per container before reheating, and stir halfway.',
      'Storage: keeps 4 days in the fridge. Freezes acceptably for up to 2 months, but the cream sauce may separate slightly; stir well when reheating.',
      'Estimated per serving: 925 kcal, 65 g protein, 79 g carbs, 39 g fat (estimate from typical label values; check against what you bought).',
      REHEAT,
      'To stretch this to 6 servings, multiply every ingredient by 1.5 (use a larger pan or pot, or cook in two batches); each serving stays the same.',
    ].join('\n'),
  },

  {
    title: 'Beef stroganoff with pasta',
    servings: 4, keepsForDays: 4,
    tags: 'russian-inspired,american,pasta,beef,ground-beef,mushroom,sour-cream,no-red-sauce,batch,microwave-friendly,meal-prep,high-calorie,high-protein',
    ingredients: [
      ing('90% lean ground beef (or 1½ lb sirloin cut in thin strips)', 1.5, 'lb'),
      ing('dried fettuccine or short pasta', 12, 'oz'),
      ing('sliced mushrooms', 16, 'oz'),
      ing('yellow onion, diced', 1, 'medium'),
      ing('frozen peas and carrots', 8, 'oz'),
      ing('butter', 2, 'tbsp'),
      ing('all-purpose flour', 3, 'tbsp'),
      ing('low-sodium beef broth', 2, 'cups'),
      ing('Worcestershire sauce', 1, 'tbsp'),
      ing('garlic, minced', 4, 'cloves'),
      ing('full-fat sour cream', '¾', 'cup'),
      ing('smoked paprika', 1, 'tsp'),
      ing('salt and black pepper', '', 'to taste'),
    ],
    instructions: [
      '1. Cook the pasta: boil in well-salted water 2 minutes less than the package says. Drain, reserving ½ cup of the pasta water.',
      '2. Brown the beef: in a large deep skillet or Dutch oven over medium-high heat, break up the ground beef and cook 6-8 minutes until no pink remains and it reaches an internal 160°F (71°C). Spoon off all but about 1 tbsp of fat. (The nutrition estimate counts all the fat, so it runs slightly high.) Transfer the beef to a bowl. If using sirloin strips instead, sear in two batches to at least 145°F (63°C).',
      '3. Cook the mushrooms: add the butter, mushrooms and onion to the same pan. Cook over medium-high heat 8-10 minutes until the mushroom liquid evaporates and they brown. Add the garlic and paprika for 30 seconds.',
      '4. Build the sauce: sprinkle in the flour and stir 1 minute. Slowly pour in the broth, scraping the pan, then add the Worcestershire. Simmer 5 minutes until thickened. Stir in the frozen peas and carrots and cook 2 minutes.',
      '5. Add the sour cream: take the pan off the heat and let it cool a minute. Stir a few spoonfuls of the hot sauce into the sour cream, then stir that back into the pan. Do not boil after this or it can curdle.',
      '6. Combine: return the beef, add the pasta, and toss gently, loosening with pasta water. Season with salt and pepper.',
      'Portion: divide evenly among 4 containers and let them cool before lidding and refrigerating (within 2 hours of cooking).',
      'Reheating tip: the sauce thickens in the fridge. Stir in 1-2 tbsp of water or milk per container, reheat at 70% power or in 90-second bursts, and stir between them.',
      'Storage: keeps 4 days in the fridge. Sour cream sauces freeze poorly (they turn grainy), so eat this one within the 4 days.',
      'Estimated per serving: 855 kcal, 54 g protein, 85 g carbs, 34 g fat (estimate from typical label values; check against what you bought).',
      REHEAT,
      'To stretch this to 6 servings, multiply every ingredient by 1.5 (use a larger pan or pot, or cook in two batches); each serving stays the same.',
    ].join('\n'),
  },

  {
    title: 'Thai coconut curry chicken with rice',
    servings: 4, keepsForDays: 4,
    tags: 'thai,curry,coconut,rice,chicken,red-curry,batch,microwave-friendly,meal-prep,high-calorie,high-protein',
    ingredients: [
      ing('boneless skinless chicken thighs', 2, 'lb'),
      ing('jasmine rice, uncooked', '1½', 'cups'),
      ing('full-fat coconut milk (do not shake the can)', 1, 'can (13.5 oz)'),
      ing('Thai red curry paste', 4, 'tbsp'),
      ing('frozen stir-fry vegetable mix (broccoli, pepper, carrot)', 16, 'oz'),
      ing('neutral oil', 1, 'tbsp'),
      ing('fish sauce', 2, 'tbsp'),
      ing('brown sugar', 1, 'tbsp'),
      ing('garlic, minced', 4, 'cloves'),
      ing('lime, juiced', 1, ''),
      ing('Thai or Italian basil leaves', 1, 'cup'),
    ],
    instructions: [
      '1. Cook the rice: rinse the rice until the water runs mostly clear. Combine with 2¼ cups water and a pinch of salt, bring to a boil, cover, reduce to the lowest heat and cook 15 minutes. Rest, covered, 10 minutes, then fluff. This gives about 4½ cups cooked.',
      '2. Bloom the curry paste: scoop the thick cream from the top of the coconut can into a large deep skillet or pot with the oil over medium heat. Add the curry paste and garlic and fry, stirring, 1-2 minutes until fragrant and the oil separates.',
      '3. Simmer the chicken: cut the thighs into 1-inch pieces and add to the pot, stirring to coat for 2 minutes. Add the rest of the coconut milk, ½ cup water, fish sauce and brown sugar. Bring to a gentle simmer, cover, and cook 10-12 minutes, stirring now and then, until the chicken reaches an internal 165°F (74°C).',
      '4. Add the vegetables: stir in the frozen vegetables straight from the bag and simmer uncovered 5-6 minutes until hot and tender-crisp.',
      '5. Finish: off the heat, stir in the lime juice and basil. Taste and add a little more fish sauce or sugar to balance.',
      'Portion: divide the rice evenly among 4 containers (a generous cup each) and ladle the curry beside or over it. Let everything cool before lidding and refrigerating (within 2 hours of cooking).',
      'Reheating tip: coconut milk firms up and the rice dries in the fridge. Keep a splash of water to stir in, and add a spoonful of curry sauce over the rice.',
      'Storage: keeps 4 days in the fridge. Freezes well for up to 3 months (the curry and the rice both hold up); thaw overnight in the fridge before reheating.',
      'Estimated per serving: 825 kcal, 55 g protein, 73 g carbs, 35 g fat (estimate from typical label values; check against what you bought).',
      REHEAT,
      'To stretch this to 6 servings, multiply every ingredient by 1.5 (use a larger pan or pot, or cook in two batches); each serving stays the same.',
    ].join('\n'),
  },
];

// ── Seed function ─────────────────────────────────────────────────────────────

async function seedDefaultRecipes(Recipe) {
  // The recipe book is the public storefront's starting content, so seeded rows
  // are owned by the admin and PUBLIC by default — unlike a user-saved recipe,
  // which is private until its owner decides otherwise. Both are overridable in
  // the app afterwards (an owner can hide any recipe from public).
  const owner = (process.env.SERVICE_DEFAULT_OWNER || process.env.ADMIN_USERNAME || '').trim() || null;
  let added = 0;
  for (const r of RECIPES) {
    const [, created] = await Recipe.findOrCreate({
      where: { title: r.title },
      defaults: {
        title: r.title,
        servings: r.servings,
        ingredients: JSON.stringify(r.ingredients),
        // Most entries join their own steps; the baking ones keep theirs as an
        // array so combined() can splice them together. Normalise here rather
        // than making every recipe remember which shape it is.
        instructions: Array.isArray(r.instructions) ? r.instructions.join('\n') : r.instructions,
        keepsForDays: r.keepsForDays,
        prepMinutes: r.prepMinutes ?? null,
        cookMinutes: r.cookMinutes ?? null,
        tags: r.tags,
        source: 'seed',
        owner,
        visibility: 'public',
      },
    });
    if (created) added++;
  }
  if (added > 0) console.log(`[kitchen] seeded ${added} new recipes`);
  else console.log(`[kitchen] recipes already seeded — no changes`);
}

module.exports = { seedDefaultRecipes, RECIPES };
