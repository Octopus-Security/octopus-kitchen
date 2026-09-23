'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const { createSSOMiddleware } = require('@octopus-security/auth-client');

const { BUILD, STARTED_AT, asset } = require('./build');
const { Recipe, initDatabase } = require('./database');
const { allTemps, relevantTemps } = require('./safe-temps');
const { withTag, amazonSearch, AMAZON_TAG } = require('./amazon');
const {
  ownerOf, publicWhere, visibleWhere, ownedWhere, canView, canEdit,
} = require('./ownership');

const app = express();

// Express 4 does not catch a rejected promise from an async handler, and an
// unhandled rejection terminates the process — one rejecting query would kill
// the service, not just the request. Wrapping the routing methods once forwards
// any rejection to the error handler. (Same guard shopper uses.)
for (const method of ['get', 'post', 'put', 'patch', 'delete', 'use']) {
  const original = app[method].bind(app);
  app[method] = (...args) => original(...args.map((a) =>
    typeof a === 'function' && a.length < 4
      ? function (req, res, next) { return Promise.resolve(a(req, res, next)).catch(next); }
      : a));
}

const port = process.env.PORT || 3014;
const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://octopus-auth:3002';
const AUTH_PUBLIC_URL = process.env.AUTH_PUBLIC_URL || 'https://auth.octopustechnology.net';
const PUBLIC_HOST = process.env.PUBLIC_HOST || 'food.octopustechnology.net';
const APP_HOST = process.env.APP_HOST || 'kitchen.octopustechnology.net';
const KITCHEN_SERVICE_TOKEN = process.env.KITCHEN_SERVICE_TOKEN || '';

app.set('trust proxy', true); // behind the estate reverse proxy — trust X-Forwarded-*
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Helpers every view gets. asset() is app.locals so no render can forget it and
// silently ship a Cloudflare-stale asset. (Const, so assigned AFTER its require
// above — assigning earlier throws at module load and the container never boots.)
app.locals.asset = asset;
app.locals.withTag = withTag;
app.locals.amazonSearch = amazonSearch;
app.locals.hasAffiliate = !!AMAZON_TAG;
app.locals.APP_HOST = APP_HOST;
app.locals.PUBLIC_HOST = PUBLIC_HOST;

// ── Liveness + deploy stamp (before auth: a liveness check that needs a working
// login is not a liveness check) ─────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'octopus-kitchen' }));
app.get('/api/build', (req, res) => res.json({
  ok: true, service: 'octopus-kitchen', build: BUILD, startedAt: STARTED_AT,
}));

// ── Optional SSO ──────────────────────────────────────────────────────────────
// Sets req.user when a valid session cookie is present; absent otherwise. Login
// is optional — the public storefront serves public recipes with no session.
const ssoSession = createSSOMiddleware({
  baseUrl: AUTH_URL,
  cacheTtlMs: 5 * 60 * 1000,
  onUser: (user, token) => ({ username: user.username, userId: user.userId, role: user.role, token }),
});
app.use(ssoSession, (req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.isPublicHost = isPublicHost(req);
  next();
});

function isPublicHost(req) {
  // Default unknown hosts (local dev, direct IP) to the app view.
  return req.hostname === PUBLIC_HOST;
}

function requireLogin(req, res, next) {
  if (req.user) return next();
  const back = encodeURIComponent(`https://${req.hostname}${req.originalUrl}`);
  return res.redirect(`${AUTH_PUBLIC_URL}/login?redirect=${back}`);
}

function requireServiceToken(req, res, next) {
  const tok = req.get('X-Service-Token');
  if (KITCHEN_SERVICE_TOKEN && tok && tok === KITCHEN_SERVICE_TOKEN) {
    req.serviceCall = true;
    return next();
  }
  return res.status(401).json({ ok: false, error: 'service token required' });
}

// ── Recipe presentation ────────────────────────────────────────────────────────
function parseIngredients(recipe) {
  let ings = recipe.ingredients;
  if (typeof ings === 'string') { try { ings = JSON.parse(ings); } catch { ings = []; } }
  return Array.isArray(ings) ? ings : [];
}
function recipeCard(r) {
  return {
    id: r.id, title: r.title, servings: r.servings, tags: r.tags,
    summary: r.summary, heroImage: r.heroImage, visibility: r.visibility,
  };
}

// ── Public storefront + shared pages ────────────────────────────────────────────
app.get('/', async (req, res) => {
  if (isPublicHost(req)) {
    const recipes = await Recipe.findAll({ where: publicWhere(), order: [['title', 'ASC']] });
    return res.render('index', { title: 'Recipes', recipes: recipes.map(recipeCard) });
  }
  return res.render('tools', { title: 'Kitchen' });
});

app.get('/recipes', async (req, res) => {
  const recipes = await Recipe.findAll({ where: visibleWhere(req), order: [['title', 'ASC']] });
  res.render('index', { title: 'Recipes', recipes: recipes.map(recipeCard) });
});

app.get('/recipes/:id', async (req, res, next) => {
  const r = await Recipe.findByPk(req.params.id);
  if (!r || !canView(req, r)) return next(); // → 404, never 403
  const ingredients = parseIngredients(r);
  res.render('recipe', {
    title: r.title,
    recipe: r,
    ingredients,
    steps: (r.instructions || '').split('\n').filter(Boolean),
    temps: relevantTemps(r),
    canEdit: canEdit(req, r),
  });
});

app.get('/temps', (req, res) => {
  res.render('temps', { title: 'Safe cooking temperatures', temps: allTemps() });
});

app.get('/timers', (req, res) => {
  res.render('timers', { title: 'Kitchen timers' });
});

// ── Management (login required) ──────────────────────────────────────────────
app.get('/my', requireLogin, async (req, res) => {
  const recipes = await Recipe.findAll({ where: ownedWhere(req), order: [['title', 'ASC']] });
  res.render('my', { title: 'My recipes', recipes: recipes.map(recipeCard) });
});

app.post('/recipes/:id/visibility', requireLogin, async (req, res, next) => {
  const r = await Recipe.findByPk(req.params.id);
  if (!r || !canEdit(req, r)) return next(); // 404
  r.visibility = r.visibility === 'public' ? 'private' : 'public';
  await r.save();
  res.redirect('/my');
});

app.get('/login', (req, res) => res.redirect(`${AUTH_PUBLIC_URL}/login`));

// ── Service API (cortex / Neith) ─────────────────────────────────────────────
app.get('/api/recipes', requireServiceToken, async (req, res) => {
  const recipes = await Recipe.findAll({ where: ownedWhere(req), order: [['title', 'ASC']] });
  res.json({ ok: true, recipes: recipes.map(recipeCard) });
});

app.get('/api/recipes/:id', requireServiceToken, async (req, res) => {
  const r = await Recipe.findByPk(req.params.id);
  if (!r || !canView(req, r)) return res.status(404).json({ ok: false });
  res.json({ ok: true, recipe: { ...recipeCard(r), ingredients: parseIngredients(r), instructions: r.instructions } });
});

app.post('/api/recipes', requireServiceToken, async (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.ingredients) return res.status(400).json({ ok: false, error: 'title and ingredients required' });
  const r = await Recipe.create({
    title: b.title,
    servings: b.servings || 1,
    ingredients: typeof b.ingredients === 'string' ? b.ingredients : JSON.stringify(b.ingredients),
    instructions: Array.isArray(b.instructions) ? b.instructions.join('\n') : (b.instructions || ''),
    keepsForDays: b.keepsForDays || 0,
    tags: b.tags || '',
    source: b.source || 'text',
    owner: ownerOf(req),
    visibility: b.visibility === 'public' ? 'public' : 'private',
  });
  res.status(201).json({ ok: true, id: r.id });
});

// ── 404 + error handler ──────────────────────────────────────────────────────
app.use((req, res) => res.status(404).render('404', { title: 'Not found' }));
app.use((err, req, res, next) => {
  console.error('[kitchen] error:', err.message);
  res.status(500).json({ ok: false, error: 'internal error' });
});

// Exported for the boot test; only listens when run directly.
async function start() {
  await initDatabase();
  return app.listen(port, () => console.log(`[kitchen] listening on ${port} (build ${BUILD})`));
}
if (require.main === module) {
  start().catch((err) => { console.error('[kitchen] failed to start:', err); process.exit(1); });
}

module.exports = { app, start };
