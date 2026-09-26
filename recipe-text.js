'use strict';

// One recipe as plain text — what "Copy all" puts on the clipboard and what
// "Download .txt" saves. Both come from here so the two can never disagree.

function parseIngredients(recipe) {
  let ings = recipe.ingredients;
  if (typeof ings === 'string') { try { ings = JSON.parse(ings); } catch { ings = []; } }
  return Array.isArray(ings) ? ings : [];
}

function recipeToText(r) {
  const meta = [
    r.servings && `${r.servings} servings`,
    r.keepsForDays && `keeps ${r.keepsForDays} days`,
    r.prepMinutes && `prep ${r.prepMinutes}m`,
    r.cookMinutes && `cook ${r.cookMinutes}m`,
  ].filter(Boolean).join(' · ');

  const out = [r.title];
  if (meta) out.push(meta);
  if (r.summary) out.push('', r.summary);

  out.push('', 'INGREDIENTS');
  for (const i of parseIngredients(r)) {
    const qty = [i.quantity, i.unit].filter(Boolean).join(' ');
    out.push(`- ${qty ? `${qty} ` : ''}${i.name || ''}`.trimEnd());
  }

  // Instructions are stored \n-joined; blank lines and section headings are
  // kept as written so a multi-part recipe stays readable.
  out.push('', 'METHOD', ...String(r.instructions || '').split('\n').map((s) => s.trimEnd()));

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/** A filesystem-safe ASCII name, e.g. "Turtle cheesecake…" → "turtle-cheesecake-….txt". */
function recipeFilename(r) {
  const slug = String(r.title || 'recipe')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${slug || 'recipe'}.txt`;
}

module.exports = { recipeToText, recipeFilename, parseIngredients };
