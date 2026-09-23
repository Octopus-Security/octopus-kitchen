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
