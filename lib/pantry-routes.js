'use strict';
/**
 * Pantry pages and GET /api/service/pantry/expiring. Mounted once from index.js.
 * Personal data: app host only, login required, `owner` in every query, and a row that
 * is not the caller's is the same 404 as one that does not exist.
 */
const express = require('express');
const et = require('./et');
const shelf = require('./shelf-life');
const pantry = require('./pantry');

const OCR_DIR = '/vendor/tesseract-7.0.0';

function createPantryRouter({ models, ownerOf, requireLogin, requireServiceToken, isPublicHost, today = et.todayET }) {
  const { PantryItem, PantryObservation, PantryPrep } = models;
  const router = express.Router();
  // Express 4 does not catch a rejected async handler; the app's own guard does not reach routers.
  const go = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next);

  // ── Service API ──
  router.get('/api/service/pantry/expiring', requireServiceToken, go(async (req, res) => {
    // Personal food data: a call that names nobody gets nobody's, not a default account's.
    if (!String(req.get('X-Service-User') || '').trim()) return res.status(400).json({ ok: false, error: 'X-Service-User required' });
    const owner = ownerOf(req);
    const asked = req.query.days === undefined ? 3 : Number(req.query.days);
    if (!Number.isInteger(asked) || asked < 0 || asked > 60) return res.status(400).json({ ok: false, error: 'days must be a whole number, 0 to 60' });
    const now = today();
    const { items, preps } = await load(owner, now);
    const cutoff = et.addDays(now, asked);
    const due = [...items, ...preps]
      .filter(x => x.status === 'active' && ((x.goodUntil && x.goodUntil <= cutoff) || (x.spoiled && x.spoiled.length)))
      .sort(pantry.bySoonest);
    res.set('Cache-Control', 'no-store');
    res.json({
      ok: true, today: now, days: asked,
      note: 'Estimates, not a safety guarantee.',
      items: due.map(x => ({
        kind: x.kind, id: x.id, name: x.name, brand: x.brand || null, since: x.since,
        goodUntil: x.goodUntil, daysLeft: x.goodUntil ? et.daysBetween(now, x.goodUntil) : null, why: x.why,
        ...(x.kind === 'prep' ? { portionsLeft: x.portionsLeft, spoiledIngredients: x.spoiled } : { quantity: x.quantity || null }),
        path: x.kind === 'prep' ? '/pantry#preps' : `/pantry/${x.id}/edit`,
      })),
    });
  }));

  // ── Pages ──
  const pages = express.Router();
  // On the public storefront the pantry does not exist.
  pages.use((req, res, next) => (isPublicHost(req) ? next('router') : next()));
  pages.use(requireLogin);
  pages.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.use('/pantry', pages);

  async function load(owner, now) {
    const [rows, preps, observations] = await Promise.all([
      PantryItem.findAll({ where: { owner } }),
      PantryPrep.findAll({ where: { owner } }),
      PantryObservation.findAll({ where: { owner } }),
    ]);
    const byId = new Map(rows.map(r => [r.id, r]));
    return {
      byId, observations,
      items: rows.map(r => pantry.itemView(r, observations, now)),
      preps: preps.map(p => pantry.prepView(p, byId, observations, now)),
    };
  }
  const mine = (Model, req) => Model.findOne({ where: { id: Number(req.params.id), owner: ownerOf(req) } });

  pages.get('/', go(async (req, res) => {
    const now = today();
    const { items, preps } = await load(ownerOf(req), now);
    const active = items.filter(i => i.status === 'active').sort(pantry.bySoonest);
    const activePreps = preps.filter(p => p.status === 'active').sort(pantry.bySoonest);
    const ended = [...items, ...preps].filter(i => i.status !== 'active')
      .sort((a, b) => String(b.endedOn).localeCompare(String(a.endedOn))).slice(0, 20);
    const soon = [...active, ...activePreps].filter(x => x.urgency === 'past' || x.urgency === 'soon').sort(pantry.bySoonest);
    res.render('pantry', { title: 'Pantry', items: active, preps: activePreps, soon, ended });
  }));

  // ── Items ──
  function renderForm(res, { status = 200, item, custom, error = null }) {
    res.status(status).render('pantry-form', {
      title: item.id ? 'Edit food' : 'Add food', item, custom, error,
      categories: Object.values(shelf.CATEGORIES), today: today(), ocrDir: OCR_DIR,
      estimate: item.id ? shelf.estimate(item, item.observations || []) : null, dateLabel: et.label,
    });
  }
  pages.get('/new', go(async (req, res, next) => {
    let item = { boughtOn: today() }, custom = [];
    if (req.query.from !== undefined) { // "Add again": same product, new dates
      const src = await PantryItem.findOne({ where: { id: Number(req.query.from) || 0, owner: ownerOf(req) } });
      if (!src) return next();
      const { name, brand, category, quantity, servingSize, servings, kcal, protein, carbs, fat } = src;
      item = { ...item, name, brand, category, quantity, servingSize, servings, kcal, protein, carbs, fat };
      custom = pantry.parseJson(src.customFields);
    }
    renderForm(res, { item, custom });
  }));
  pages.post('/', go(async (req, res) => {
    const body = req.body || {};
    const { row, error } = pantry.itemFromForm(body, today());
    if (error) return renderForm(res, { status: 400, item: row, custom: pantry.customFrom(body), error });
    await PantryItem.create({ ...row, owner: ownerOf(req) });
    res.redirect('/pantry');
  }));
  pages.get('/:id(\\d+)/edit', go(async (req, res, next) => {
    const r = await mine(PantryItem, req);
    if (!r) return next();
    const observations = await PantryObservation.findAll({ where: { owner: ownerOf(req), productKey: shelf.productKey(r) } });
    renderForm(res, { item: { ...r.toJSON(), observations }, custom: pantry.parseJson(r.customFields) });
  }));
  pages.post('/:id(\\d+)', go(async (req, res, next) => {
    const r = await mine(PantryItem, req);
    if (!r) return next();
    const { row, error } = pantry.itemFromForm(req.body || {}, today());
    if (error) return renderForm(res, { status: 400, item: { ...row, id: r.id, status: r.status }, custom: pantry.customFrom(req.body), error });
    await r.update(row);
    res.redirect('/pantry');
  }));
  pages.post('/:id(\\d+)/opened', go(async (req, res, next) => {
    const r = await mine(PantryItem, req);
    if (!r) return next();
    if (r.status === 'active' && !r.openedOn) await r.update({ openedOn: today() });
    res.redirect('/pantry');
  }));
  pages.post('/:id(\\d+)/delete', go(async (req, res, next) => {
    const r = await mine(PantryItem, req);
    if (!r) return next();
    await r.destroy();
    res.redirect('/pantry');
  }));

  // ── Preps ──
  async function renderPrepForm(res, req, { status = 200, form, error = null }) {
    const items = await PantryItem.findAll({ where: { owner: ownerOf(req), status: 'active' }, order: [['name', 'ASC']] });
    res.status(status).render('pantry-prep-form', { title: 'New prep', items, form, error, today: today(), rows: 8 });
  }
  pages.get('/preps/new', go((req, res) => renderPrepForm(res, req, { form: { madeOn: today(), portions: 1 } })));
  pages.post('/preps', go(async (req, res) => {
    const owner = ownerOf(req);
    const { byId, observations } = await load(owner, today());
    for (const [id, r] of byId) if (r.status !== 'active') byId.delete(id);
    const { row, error } = pantry.prepFromForm(req.body || {}, byId, observations, today());
    if (error) return renderPrepForm(res, req, { status: 400, form: req.body || {}, error });
    await PantryPrep.create({ ...row, owner });
    res.redirect('/pantry#preps');
  }));
  pages.post('/preps/:id(\\d+)/portions', go(async (req, res, next) => {
    const p = await mine(PantryPrep, req);
    if (!p) return next();
    const n = Number(req.body && req.body.portionsLeft);
    if (p.status === 'active' && String(req.body.portionsLeft || '').trim() && Number.isInteger(n) && n >= 0 && n <= p.portions) {
      if (n === 0) await end(PantryPrep, p, 'finished');
      else await p.update({ portionsLeft: n });
    }
    res.redirect('/pantry#preps');
  }));
  pages.post('/preps/:id(\\d+)/delete', go(async (req, res, next) => {
    const p = await mine(PantryPrep, req);
    if (!p) return next();
    await p.destroy();
    res.redirect('/pantry#preps');
  }));

  // ── Finished / Spoiled today / Put back, for both ──
  async function end(Model, row, outcome) {
    const now = today();
    // Conditional, so a double tap records one observation.
    const [changed] = await Model.update({ status: outcome, endedOn: now }, { where: { id: row.id, owner: row.owner, status: 'active' } });
    if (!changed) return;
    const isPrep = Model === PantryPrep;
    const obs = shelf.observationFor(row, outcome, now);
    if (!obs) return;
    await PantryObservation.create({
      ...obs, ...(isPrep ? { productKey: pantry.prepKey(row), prepId: row.id } : { itemId: row.id }),
      owner: row.owner, label: [row.brand, row.name].filter(Boolean).join(' '), observedOn: now,
    });
  }
  for (const [base, Model, key] of [['', PantryItem, 'itemId'], ['/preps', PantryPrep, 'prepId']]) {
    for (const outcome of ['finished', 'spoiled']) {
      pages.post(`${base}/:id(\\d+)/${outcome}`, go(async (req, res, next) => {
        const r = await mine(Model, req);
        if (!r) return next();
        await end(Model, r, outcome);
        res.redirect('/pantry');
      }));
    }
    pages.post(`${base}/:id(\\d+)/restore`, go(async (req, res, next) => {
      const r = await mine(Model, req);
      if (!r) return next();
      await PantryObservation.destroy({ where: { owner: r.owner, [key]: r.id } });
      await r.update({ status: 'active', endedOn: null });
      res.redirect('/pantry');
    }));
  }

  // ── What has been learned, and the defaults table ──
  pages.get('/shelf-life', go(async (req, res) => {
    const learned = await PantryObservation.findAll({ where: { owner: ownerOf(req) }, order: [['id', 'DESC']], limit: 200 });
    res.render('pantry-shelf-life', { title: 'Shelf-life estimates', learned, categories: Object.values(shelf.CATEGORIES), sources: shelf.SOURCES });
  }));
  pages.post('/observations/:id(\\d+)/delete', go(async (req, res, next) => {
    const o = await mine(PantryObservation, req);
    if (!o) return next();
    await o.destroy();
    res.redirect('/pantry/shelf-life');
  }));

  return router;
}

module.exports = { createPantryRouter, OCR_DIR };
