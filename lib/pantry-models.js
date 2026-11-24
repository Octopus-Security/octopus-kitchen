'use strict';
/**
 * Pantry tables. Created if missing, then only ever given new nullable columns; never
 * sync({ alter }) or sync({ force }). On SQLite, alter rebuilds a table by copying it out,
 * dropping it and copying it back, which is not something to do to live rows on every boot.
 * Every row belongs to one username. `owner` is in every query; another user's row is 404.
 */
const { DataTypes } = require('sequelize');
const D = DataTypes;

function definePantryModels(sequelize) {
  const day = () => ({ type: D.STRING(10), allowNull: true }); // YYYY-MM-DD, ET
  const num = () => ({ type: D.FLOAT, allowNull: true });      // null is "not known", never 0

  const PantryItem = sequelize.define('PantryItem', {
    owner: { type: D.STRING, allowNull: false },
    name: { type: D.STRING, allowNull: false },
    brand: D.STRING, category: D.STRING, quantity: D.STRING, notes: D.TEXT,
    boughtOn: day(), openedOn: day(), madeOn: day(), bestBy: day(), endedOn: day(),
    status: { type: D.STRING, allowNull: false, defaultValue: 'active' }, // active | finished | spoiled
    servingSize: D.STRING,
    servings: num(), kcal: num(), protein: num(), carbs: num(), fat: num(),
    customFields: D.TEXT, // JSON [{name, value}]
  }, { tableName: 'pantry_items', additiveOnly: true, indexes: [{ name: 'idx_pantry_items_owner', fields: ['owner', 'status'] }] });

  // How long food actually lasted. `itemId`/`prepId` let "Put back" undo a mistaken tap.
  const PantryObservation = sequelize.define('PantryObservation', {
    owner: { type: D.STRING, allowNull: false },
    productKey: { type: D.STRING, allowNull: false },
    label: D.STRING,
    state: { type: D.STRING, allowNull: false },   // opened | unopened | made
    outcome: { type: D.STRING, allowNull: false }, // spoiled | finished
    days: { type: D.INTEGER, allowNull: false },
    observedOn: day(), itemId: D.INTEGER, prepId: D.INTEGER,
  }, { tableName: 'pantry_observations', additiveOnly: true, indexes: [{ name: 'idx_pantry_obs_owner', fields: ['owner', 'productKey'] }] });

  // Dates, what went in, and how many containers are left. NOT a meal log: eating is
  // recorded in octopus-health only.
  const PantryPrep = sequelize.define('PantryPrep', {
    owner: { type: D.STRING, allowNull: false },
    name: { type: D.STRING, allowNull: false },
    category: D.STRING, notes: D.TEXT, madeOn: day(), endedOn: day(),
    status: { type: D.STRING, allowNull: false, defaultValue: 'active' },
    portions: { type: D.INTEGER, allowNull: false, defaultValue: 1 },
    portionsLeft: { type: D.INTEGER, allowNull: false, defaultValue: 1 },
    ingredients: D.TEXT, // JSON, frozen when made: [{itemId,name,amount,servings,goodUntil,kcal,...}]
    kcal: num(), protein: num(), carbs: num(), fat: num(), // per portion, frozen
    missing: D.TEXT, // JSON, names with incomplete numbers
  }, { tableName: 'pantry_preps', additiveOnly: true, indexes: [{ name: 'idx_pantry_preps_owner', fields: ['owner', 'status'] }] });

  return { PantryItem, PantryObservation, PantryPrep };
}

/** CREATE TABLE IF NOT EXISTS, then ADD COLUMN for nullable columns a live table lacks. */
async function createAdditively(model) {
  const qi = model.sequelize.getQueryInterface();
  const tables = (await qi.showAllTables()).map(t => t.tableName || t);
  if (tables.includes(model.tableName)) {
    const have = await qi.describeTable(model.tableName);
    for (const [name, attr] of Object.entries(model.rawAttributes)) {
      if (!have[name] && attr.allowNull !== false) await qi.addColumn(model.tableName, name, { type: attr.type, allowNull: true });
    }
  }
  await model.sync(); // no options: creates if missing, adds missing indexes
}

module.exports = { definePantryModels, createAdditively };
