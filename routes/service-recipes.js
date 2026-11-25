'use strict';

// Recipe endpoints for the assistant, authenticated by X-Service-Token and
// attributed by X-Service-User. Same paths and answers as the older app's recipe
// API, so the caller changes its base URL and token and nothing else. Mounted
// before anything that needs a session; every route is owner-scoped, and another
// user's row answers 404.

const express = require('express');
const { normalizeIngredients } = require('../lib/recipe-ingredients');
const { publishDecision, parseIngredientLines } = require('../lib/recipe-review');
const { ownerOf, publicWhere, ownedWhere, canView, canEdit, isReviewer } = require('../ownership');

/** One spelling per tag: lowercase, one hyphen for spaces and underscores. */
function cleanTags(tags) {
  const list = (Array.isArray(tags) ? tags : [tags]).flatMap((t) => String(t == null ? '' : t).split(','));
  const out = list.map((t) => t.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, ''));
  return [...new Set(out.filter(Boolean))].join(',').slice(0, 250);
}

const cleanTitle = (t) => String(t == null ? '' : t).trim().replace(/\s+/g, ' ').slice(0, 160);
const cleanMethod = (m) => (Array.isArray(m) ? m.map(String).join('\n') : String(m == null ? '' : m));
const positive = (n, fallback) => { const v = parseInt(n, 10); return v > 0 ? v : fallback; };

function createServiceRecipes({ Recipe, requireServiceToken }) {
  const router = express.Router();

  // Express 4 does not catch a rejected async handler.
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  // requireServiceToken sets req.serviceCall, which is what makes X-Service-User
  // count. A cookie on the same request lends the call nothing.
  const service = [requireServiceToken, (req, res, next) => { req.user = null; next(); }];

  // Publishing and copying must say whose account they are for.
  const named = (req, res, next) => (String(req.get('X-Service-User') || '').trim()
    ? next()
    : res.status(400).json({ ok: false, error: 'X-Service-User required' }));

  const notFound = (res) => res.status(404).json({ ok: false, error: 'recipe not found' });

  // visibility/reviewStatus travel with every row so the caller can say what is
  // actually on the public site.
  const card = (r) => ({
    id: r.id, title: r.title, servings: r.servings, keepsForDays: r.keepsForDays, tags: r.tags,
    summary: r.summary, visibility: r.visibility, reviewStatus: r.reviewStatus || null,
  });
  const full = (r) => ({
    ...card(r),
    ingredients: normalizeIngredients(r.ingredients),
    instructions: r.instructions, sourceUrl: r.sourceUrl,
  });
  const matches = (r, q) => !q
    || (r.title || '').toLowerCase().includes(q)
    || (r.tags || '').toLowerCase().includes(q);
  const param = (v) => String(v == null ? '' : v).trim().toLowerCase();

  async function find(req) {
    return /^\d+$/.test(req.params.id) ? Recipe.findByPk(req.params.id) : null;
  }

  // Your recipes. ?tag= filters on tags, ?q= on title and tags.
  router.get('/api/recipes', service, wrap(async (req, res) => {
    const rows = await Recipe.findAll({ where: ownedWhere(req), order: [['title', 'ASC']] });
    const tag = param(req.query.tag);
    const q = param(req.query.q);
    res.json({
      ok: true,
      recipes: rows.filter((r) => (!tag || (r.tags || '').toLowerCase().includes(tag)) && matches(r, q)).map(card),
    });
  }));

  router.get('/api/recipes/:id', service, wrap(async (req, res) => {
    const r = await find(req);
    if (!canView(req, r)) return notFound(res);
    return res.json({ ok: true, recipe: full(r) });
  }));

  router.post('/api/recipes', service, wrap(async (req, res) => {
    const b = req.body || {};
    const title = cleanTitle(b.title);
    const ingredients = normalizeIngredients(b.ingredients);
    if (!title || !ingredients.length) {
      return res.status(400).json({ ok: false, error: 'title and ingredients required' });
    }
    const askedPublic = b.visibility === 'public' || b.requestPublication === true;
    const access = publishDecision({ isReviewer: isReviewer(req), requestPublic: askedPublic });
    const r = await Recipe.create({
      title,
      servings: positive(b.servings, 1),
      ingredients: JSON.stringify(ingredients),
      instructions: cleanMethod(b.instructions),
      keepsForDays: positive(b.keepsForDays, 0),
      tags: cleanTags(b.tags),
      source: 'service',
      sourceUrl: b.sourceUrl ? String(b.sourceUrl).slice(0, 2000) : null,
      owner: ownerOf(req) || null,
      visibility: access.visibility,
      reviewStatus: access.reviewStatus,
    });
    return res.status(201).json({ ok: true, ...card(r) });
  }));

  const edit = wrap(async (req, res) => {
    const r = await find(req);
    if (!canEdit(req, r)) return notFound(res);
    const b = req.body || {};
    if (b.title !== undefined) {
      const title = cleanTitle(b.title);
      if (!title) return res.status(400).json({ ok: false, error: 'a recipe needs a title' });
      r.title = title;
    }
    if (b.servings !== undefined) r.servings = positive(b.servings, 1);
    if (b.instructions !== undefined) r.instructions = cleanMethod(b.instructions);
    if (b.keepsForDays !== undefined) r.keepsForDays = positive(b.keepsForDays, 0);
    if (b.tags !== undefined) r.tags = cleanTags(b.tags);
    if (b.ingredients !== undefined || b.ingredientsText !== undefined) {
      const list = b.ingredientsText !== undefined
        ? parseIngredientLines(b.ingredientsText)
        : normalizeIngredients(b.ingredients);
      // An empty list is far more likely a mistake than an intention.
      if (!list.length) return res.status(400).json({ ok: false, error: 'a recipe needs at least one ingredient' });
      r.ingredients = JSON.stringify(list);
    }
    // Editing what a reviewer approved needs the reviewer again.
    if (r.visibility === 'public' && !isReviewer(req)) {
      const access = publishDecision({ isReviewer: false, requestPublic: true });
      r.visibility = access.visibility;
      r.reviewStatus = access.reviewStatus;
    }
    await r.save();
    return res.json({ ok: true, ...card(r) });
  });
  router.patch('/api/recipes/:id', service, named, edit);
  router.post('/api/recipes/:id/edit', service, named, edit);

  // Publishing follows the same review rule as the web page: a non-reviewer's
  // request stays private and pending.
  router.post('/api/recipes/:id/visibility', service, named, wrap(async (req, res) => {
    const wanted = String((req.body && req.body.visibility) || '');
    if (!['private', 'public'].includes(wanted)) {
      return res.status(400).json({ ok: false, error: "visibility must be 'private' or 'public'" });
    }
    const r = await find(req);
    if (!canEdit(req, r)) return notFound(res);
    if (!(wanted === 'public' && r.visibility === 'public')) {
      const access = publishDecision({ isReviewer: isReviewer(req), requestPublic: wanted === 'public' });
      r.visibility = access.visibility;
      r.reviewStatus = access.reviewStatus;
      r.reviewNote = null;
      await r.save();
    }
    return res.json({ ok: true, id: r.id, title: r.title, visibility: r.visibility, reviewStatus: r.reviewStatus || null });
  }));

  // Everything published, whoever by.
  router.get('/api/public-recipes', service, named, wrap(async (req, res) => {
    const rows = await Recipe.findAll({ where: publicWhere(), order: [['createdAt', 'DESC'], ['id', 'DESC']] });
    const me = ownerOf(req);
    const q = param(req.query.q);
    res.json({
      ok: true,
      recipes: rows.filter((r) => matches(r, q)).map((r) => ({
        ...card(r), createdAt: r.createdAt,
        ingredientCount: normalizeIngredients(r.ingredients).length,
        author: r.owner || null,
        mine: !!me && r.owner === me,
      })),
    });
  }));

  // A private copy. The same 404 covers "no such id" and "not published".
  router.post('/api/public-recipes/:id/copy', service, named, wrap(async (req, res) => {
    const src = await find(req);
    if (!src || src.visibility !== 'public') return notFound(res);
    const copy = await Recipe.create({
      title: src.title, servings: src.servings, ingredients: src.ingredients,
      instructions: src.instructions, keepsForDays: src.keepsForDays, tags: src.tags,
      summary: src.summary, prepMinutes: src.prepMinutes, cookMinutes: src.cookMinutes,
      source: 'copy', sourceUrl: src.sourceUrl, sourceContent: src.sourceContent,
      owner: ownerOf(req), visibility: 'private',
      copiedFrom: src.id, copiedFromAuthor: src.owner || null,
    });
    return res.status(201).json({ ok: true, id: copy.id, title: copy.title });
  }));

  return router;
}

module.exports = { createServiceRecipes };
