'use strict';

/**
 * Minimal cookie-based session store (in memory).
 * Each visitor gets a `sw_sid` cookie; the server keeps their cart and
 * admin flag in a Map keyed by that id. Sessions are cleared when the
 * server restarts - fine for a demo shop.
 */

const crypto = require('crypto');

const sessions = new Map();
const COOKIE = 'sw_sid';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > -1) {
      out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    }
  });
  return out;
}

/**
 * Attaches `req.session` and, when a new session is created, sets the
 * cookie on `res`. Returns the session object.
 */
function attach(req, res) {
  const cookies = parseCookies(req);
  let sid = cookies[COOKIE];

  if (!sid || !sessions.has(sid)) {
    sid = crypto.randomBytes(18).toString('hex');
    sessions.set(sid, { id: sid, cart: {}, isAdmin: false, buyer: null, purchased: {} });
    res.setHeader(
      'Set-Cookie',
      `${COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}`
    );
  }

  const session = sessions.get(sid);
  req.session = session;
  return session;
}

// ---- Cart helpers -------------------------------------------------------

function cartCount(session) {
  return Object.values(session.cart).reduce((n, qty) => n + qty, 0);
}

function addToCart(session, productId, qty = 1) {
  const current = session.cart[productId] || 0;
  const next = Math.max(0, current + qty);
  if (next === 0) delete session.cart[productId];
  else session.cart[productId] = next;
}

function setCartQty(session, productId, qty) {
  if (qty <= 0) delete session.cart[productId];
  else session.cart[productId] = qty;
}

function clearCart(session) {
  session.cart = {};
}

module.exports = { attach, cartCount, addToCart, setCartQty, clearCart };
