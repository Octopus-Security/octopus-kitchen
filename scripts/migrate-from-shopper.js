'use strict';

// Migrate recipes from octopus-shopper's LIVE database into kitchen.
//
// The committed seed (recipes-seed.js) is only the default starter set. Any
// recipe you added over time — via the app or by talking to Neith — lives only
// in shopper's database, which is a Docker volume on the server. This pulls
// those across using shopper's service API.
//
// IDEMPOTENT: findOrCreate by title, so re-running only adds recipes kitchen
// doesn't already have, and never duplicates or overwrites an existing one.
//
// ── How to run ───────────────────────────────────────────────────────────────
// It runs INSIDE the kitchen container (it reaches shopper on the internal
// network and already has the env). In Portainer: kitchen container → Console →
// Connect (`/bin/sh`), then:
//
//   node scripts/migrate-from-shopper.js
//
// Prerequisites in the kitchen stack env (then redeploy so the image has this
// script and the token):
//   SHOPPER_SERVICE_TOKEN  = the same value as shopper's SHOPPER_SERVICE_TOKEN
//   ADMIN_USERNAME         = your username (whose recipes to pull)
//   SHOPPER_URL            = defaults to http://octopus_shopper_internal:3004
//
// Migrated recipes come in PUBLIC by default (matching the seed). To bring them
// in hidden instead, run with MIGRATE_VISIBILITY=private. Either way you can
// flip any recipe on kitchen.octopustechnology.net/my afterwards.

const { Recipe, sequelize } = require('../database');

const SHOPPER_URL = (process.env.SHOPPER_URL || 'http://octopus_shopper_internal:3004').replace(/\/+$/, '');
const TOKEN = process.env.SHOPPER_SERVICE_TOKEN || '';
const OWNER = (process.env.SERVICE_DEFAULT_OWNER || process.env.ADMIN_USERNAME || '').trim();
const VISIBILITY = process.env.MIGRATE_VISIBILITY === 'private' ? 'private' : 'public';

async function api(pathname) {
  const res = await fetch(`${SHOPPER_URL}${pathname}`, {
    headers: { 'X-Service-Token': TOKEN, 'X-Service-User': OWNER },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GET ${pathname} → ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function main() {
  if (!TOKEN) {
    throw new Error('SHOPPER_SERVICE_TOKEN is not set in this container. Add it to the kitchen stack env (= shopper\'s value) and redeploy, then run again.');
  }
  if (!OWNER) {
    console.warn('[migrate] No ADMIN_USERNAME / SERVICE_DEFAULT_OWNER set — shopper will only return service-default rows.');
  }

  await sequelize.authenticate();

  const list = await api('/api/recipes');
  const summaries = list.recipes || [];
  console.log(`[migrate] shopper returned ${summaries.length} recipes for owner "${OWNER}" (visibility on import: ${VISIBILITY})`);

  let added = 0, skipped = 0, failed = 0;
  for (const s of summaries) {
    try {
      const detail = (await api(`/api/recipes/${s.id}`)).recipe;
      if (!detail || !detail.title) { failed++; continue; }
      const [, created] = await Recipe.findOrCreate({
        where: { title: detail.title },
        defaults: {
          title: detail.title,
          servings: detail.servings || 1,
          ingredients: typeof detail.ingredients === 'string'
            ? detail.ingredients
            : JSON.stringify(detail.ingredients || []),
          instructions: Array.isArray(detail.instructions)
            ? detail.instructions.join('\n')
            : (detail.instructions || ''),
          keepsForDays: detail.keepsForDays || 0,
          tags: detail.tags || '',
          source: 'migrated',
          owner: OWNER || null,
          visibility: VISIBILITY,
        },
      });
      if (created) { added++; console.log(`  + ${detail.title}`); }
      else { skipped++; }
    } catch (err) {
      failed++;
      console.error(`  ! ${s.title || s.id}: ${err.message}`);
    }
  }

  console.log(`[migrate] done — added ${added}, skipped ${skipped} (already present), failed ${failed}`);
  await sequelize.close();
}

main().catch((err) => { console.error('[migrate] fatal:', err.message); process.exit(1); });
