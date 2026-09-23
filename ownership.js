'use strict';

// Ownership + visibility (games pattern, octopus-ops/MULTI-USER.md).
//
// Recipes are keyed on USERNAME — matching shopper/health/budget and the
// X-Service-User a cortex/Neith service call carries, so a recipe saved by
// talking to the assistant is the same row the web app shows.
//
// visibility: 'public' is world-readable (the food.octo storefront, no login).
// 'private' is owner-only. A viewer who may not see a recipe gets 404, never
// 403 — a 403 confirms the id exists.

const { Op } = require('sequelize');

const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || '').trim();
const SERVICE_DEFAULT_OWNER = (process.env.SERVICE_DEFAULT_OWNER || ADMIN_USERNAME).trim();

/** Who this request is for: the linked account on a proven service call, else the session. */
function ownerOf(req) {
  if (req.serviceCall) {
    const svc = req.get('X-Service-User');
    if (svc && String(svc).trim()) return String(svc).trim();
    return SERVICE_DEFAULT_OWNER; // scheduled/unattributed service work
  }
  return String(req.user?.username || '').trim();
}

const isAdminReq = (req) => !!ADMIN_USERNAME && ownerOf(req) === ADMIN_USERNAME;

/** Rows visible on the PUBLIC storefront — public only, no session needed. */
const publicWhere = () => ({ visibility: 'public' });

/** Rows the current viewer may see: anything public, plus their own. */
function visibleWhere(req) {
  const me = ownerOf(req);
  if (!me) return { visibility: 'public' };
  return { [Op.or]: [{ visibility: 'public' }, { owner: me }, ...(isAdminReq(req) ? [{ owner: null }] : [])] };
}

/** Rows owned by the current viewer (the "my recipes" management list). */
function ownedWhere(req) {
  const me = ownerOf(req);
  if (!me) return { [Op.and]: [require('sequelize').literal('0 = 1')] };
  return isAdminReq(req) ? { [Op.or]: [{ owner: me }, { owner: null }] } : { owner: me };
}

/** Can this request VIEW this row? Public → yes; else owner (or admin for NULL). */
function canView(req, row) {
  if (!row) return false;
  if (row.visibility === 'public') return true;
  const me = ownerOf(req);
  if (!me) return false;
  if (row.owner == null) return isAdminReq(req);
  return row.owner === me;
}

/** Can this request EDIT this row? Owner only (admin also owns NULL rows). */
function canEdit(req, row) {
  if (!row) return false;
  const me = ownerOf(req);
  if (!me) return false;
  if (row.owner == null) return isAdminReq(req);
  return row.owner === me;
}

module.exports = { ownerOf, isAdminReq, publicWhere, visibleWhere, ownedWhere, canView, canEdit, ADMIN_USERNAME };
