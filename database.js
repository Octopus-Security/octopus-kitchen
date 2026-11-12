'use strict';
const safeguards = require('./lib/safeguards');

// Kitchen's own database. The Recipe shape is carried over from octopus-shopper
// (where the recipe book was first built) so recipe content moves across
// unchanged; the price/PC-parts models stay in shopper, which keeps the store
// API keys and remains the price engine kitchen calls.
//
// Every column added to a live table is nullable / defaulted so `sync({ alter:
// true })` is additive and a rerun is a no-op — the estate rule is never to
// reset or drop (octopus-ops/MULTI-USER.md, estate CLAUDE.md). Never
// sync({ force: true }).

const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'kitchen.db');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false,
});

// Per-connection SQLite tuning. This dialect opens a separate handle per
// transaction (connection-manager keys them by uuid) and never runs Sequelize's
// afterConnect hook, so the pragmas are applied the first time each handle is
// handed out. busy_timeout first, so the journal-mode switch can wait on a lock.
// WAL needs the db in a directory (a named volume), not a single-file mount.
const _tuned = new WeakSet();
const _getConnection = sequelize.connectionManager.getConnection.bind(sequelize.connectionManager);
sequelize.connectionManager.getConnection = async function tunedConnection(options) {
  const connection = await _getConnection(options);
  if (!_tuned.has(connection)) {
    _tuned.add(connection);
    await new Promise((resolve, reject) => connection.exec(
      'PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;',
      err => (err ? reject(err) : resolve())));
  }
  return connection;
};


const Recipe = sequelize.define('Recipe', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  servings: { type: DataTypes.INTEGER, defaultValue: 1 },
  ingredients: { type: DataTypes.TEXT, allowNull: false }, // JSON string: [{name,quantity,unit}]
  instructions: { type: DataTypes.TEXT },                   // steps, \n-joined
  keepsForDays: { type: DataTypes.INTEGER, defaultValue: 0 }, // cooked shelf life, fridge
  tags: { type: DataTypes.STRING },                          // comma-separated
  source: { type: DataTypes.STRING },                        // 'url' | 'text' | 'seed'
  sourceUrl: { type: DataTypes.TEXT },
  sourceContent: { type: DataTypes.TEXT },

  // ── Ownership + visibility (games pattern) ─────────────────────────────────
  // Keyed on USERNAME, matching shopper/health/budget and the X-Service-User a
  // cortex/Neith service call carries — a recipe saved by talking to Neith must
  // be the same row the web app shows. Nullable so it can land on a live table;
  // pre-ownership rows are the admin's to claim, never backfilled to a guess.
  owner: { type: DataTypes.STRING, allowNull: true },
  // public: anyone, no login (the food.octo storefront).
  // private: owner only. members/whitelist reserved (string, not enum, so they
  // can join later without a SQLite table rebuild). A viewer who may not see a
  // recipe gets 404, never 403 — a 403 confirms the id exists.
  visibility: { type: DataTypes.STRING, allowNull: false, defaultValue: 'private' },

  // Provenance for a copied recipe — not a foreign key, so a copy survives the
  // original being unpublished or deleted.
  copiedFrom: { type: DataTypes.INTEGER, allowNull: true },
  copiedFromAuthor: { type: DataTypes.STRING, allowNull: true },

  // ── Public-storefront extras (additive, all optional) ──────────────────────
  // Feed Recipe JSON-LD (rich results) and the photo-led public pages.
  heroImage: { type: DataTypes.STRING, allowNull: true },   // /img/… path or URL
  prepMinutes: { type: DataTypes.INTEGER, allowNull: true },
  cookMinutes: { type: DataTypes.INTEGER, allowNull: true },
  summary: { type: DataTypes.TEXT, allowNull: true },       // meta description / card blurb
}, { tableName: 'recipes' });

async function initDatabase() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  // Lookup indexes. Idempotent and additive; run after every sync so a table
  // rebuilt by a schema change gets them back. Existing tables only gain an index.
  for (const sql of [
    'CREATE INDEX IF NOT EXISTS "idx_recipes_owner" ON "recipes" ("owner")',
    'CREATE INDEX IF NOT EXISTS "idx_recipes_visibility" ON "recipes" ("visibility")',
  ]) {
    await sequelize.query(sql).catch(err => console.warn('[db] index:', err.message));
  }
  console.log('[kitchen] Database initialized at', dbPath);

  const { seedDefaultRecipes } = require('./recipes-seed');
  await seedDefaultRecipes(Recipe).catch(err =>
    console.error('[kitchen] seed-recipes failed:', safeguards.safeError(err)));
}

module.exports = { Recipe, sequelize, initDatabase };
