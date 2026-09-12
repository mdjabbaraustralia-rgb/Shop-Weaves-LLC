'use strict';

/**
 * Editable site settings — the whole storefront's text, links, branding,
 * pricing rules and content pages that the admin panel can change at runtime.
 * Persisted to data/settings.json; anything not saved falls back to the
 * defaults derived from lib/config.js (and the built-in page copy in views.js).
 */

const fs = require('fs');
const path = require('path');
const cfg = require('./config');

const FILE = path.join(__dirname, '..', 'data', 'settings.json');

// content pages the admin can rewrite (contact is form-driven, not in this list)
const PAGE_KEYS = ['about', 'shipping', 'returns', 'faq', 'contact', 'privacy', 'terms'];

const DEFAULTS = {
  // ---- identity ----
  storeName: cfg.STORE_NAME,
  legalName: 'Shop Weaves LLC', // blank => storeName
  tagline: cfg.TAGLINE,
  logoUrl: '/img/logo.png',
  logoDarkUrl: '/img/logo-dark.png',
  address: '7010 HARNEY RD, TAMPA, FL 33617',
  supportEmail: 'contact@shopweavescorporation.com',
  supportPhone: '',
  supportHours: 'Support hours: 9am–9pm, daily',
  announce: ['Free shipping over $75', '7-day easy returns', 'Secure checkout'],

  // ---- hero (home page) ----
  heroEyebrow: 'New season collection',
  heroHeading: '', // blank => tagline
  heroLead: 'Electronics, home & lifestyle — at honest prices.',
  heroCta: 'Shop all products',
  heroFlagTag: '-25%',
  heroFlag: 'Members’ week',

  // ---- home page blocks ----
  catHeading: 'Shop by category',
  catSub: 'Find what you need, faster',
  memberHeading: 'Become a member',
  memberText: 'Free express shipping, early access to drops, and a birthday treat.',
  memberCta: 'Start shopping',
  newsletterHeading: 'Join the list',
  newsletterText: 'New arrivals and members-only offers. No spam.',

  // ---- trust badges (4) ----
  trust: [
    { title: 'Fast, free shipping', text: 'On orders over $75' },
    { title: '7-day returns', text: 'No-questions-asked' },
    { title: 'Secure checkout', text: 'Card or cash on delivery' },
    { title: 'Real support', text: 'Every day, 9am–9pm' },
  ],

  // ---- footer ----
  footerBlurb:
    cfg.TAGLINE + ' Genuine products from verified sellers, delivered fast.',
  social: {
    instagram: 'https://www.instagram.com/shopweaves1?stkn=MW1ib2V5dG93NHN4Mw==',
    facebook: 'https://www.facebook.com/share/1HpErLoctd/',
  },
  footerCols: cfg.FOOTER.map((col) => ({
    title: col.title,
    links: col.links.map((l) => `${l.label} | ${l.href}`).join('\n'),
  })),
  copyright: '', // blank => "© <year> <legalName/storeName>. All rights reserved."

  // ---- store & pricing ----
  currencySymbol: cfg.CURRENCY_SYMBOL,
  freeShippingFrom: cfg.FREE_SHIPPING_FROM,
  flatShipping: cfg.FLAT_SHIPPING,

  // ---- content pages (blank => built-in copy from views.js) ----
  pages: PAGE_KEYS.reduce((o, k) => ((o[k] = { title: '', html: '' }), o), {}),
};

let current = load();

function load() {
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    saved = {};
  }
  return merge(DEFAULTS, saved);
}

function merge(base, over) {
  const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
  Object.keys(over || {}).forEach((k) => {
    const v = over[k];
    if (
      v && typeof v === 'object' && !Array.isArray(v) &&
      base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])
    ) {
      out[k] = merge(base[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  });
  return out;
}

/** Current settings (live object; treat as read-only). */
function get() {
  return current;
}

/** Parse a "Label | /href" text block into [{label, href}]. */
function parseLinks(text) {
  return String(text || '')
    .split('\n')
    .map((line) => {
      const [label, href] = line.split('|').map((s) => s.trim());
      return label ? { label, href: href || '#' } : null;
    })
    .filter(Boolean);
}

/**
 * Apply an admin patch and persist. The patch only needs to carry the fields
 * for the section being saved — any group whose fields are absent is left
 * untouched, so the admin panel can save one section at a time.
 */
function save(patch) {
  const p = patch || {};
  const next = JSON.parse(JSON.stringify(current));
  const has = (...keys) => keys.some((k) => k in p);
  const str = (k, max = 300) => {
    if (k in p) next[k] = String(p[k]).trim().slice(0, max);
  };
  const num = (k, def) => {
    if (k in p) {
      const n = parseFloat(p[k]);
      next[k] = isFinite(n) && n >= 0 ? n : def;
    }
  };

  // identity
  str('storeName', 80);
  str('legalName', 120);
  str('tagline', 200);
  str('logoUrl', 400);
  str('logoDarkUrl', 400);
  str('address', 300);
  str('supportEmail', 160);
  str('supportPhone', 60);
  str('supportHours', 200);

  // hero
  str('heroEyebrow', 120);
  str('heroHeading', 200);
  str('heroLead', 240);
  str('heroCta', 60);
  str('heroFlagTag', 24);
  str('heroFlag', 80);

  // home blocks
  str('catHeading', 120);
  str('catSub', 200);
  str('memberHeading', 120);
  str('memberText', 300);
  str('memberCta', 60);
  str('newsletterHeading', 120);
  str('newsletterText', 300);

  // footer
  str('footerBlurb', 400);
  str('copyright', 200);

  // store & pricing
  str('currencySymbol', 8);
  num('freeShippingFrom', DEFAULTS.freeShippingFrom);
  num('flatShipping', DEFAULTS.flatShipping);

  if (has('announce1', 'announce2', 'announce3')) {
    const a = [p.announce1, p.announce2, p.announce3]
      .map((s) => String(s == null ? '' : s).trim().slice(0, 120))
      .filter(Boolean);
    next.announce = a.length ? a : DEFAULTS.announce.slice();
  }

  if (has('instagram', 'facebook')) {
    next.social = {
      instagram: String(p.instagram || '').trim() || '#',
      facebook: String(p.facebook || '').trim() || '#',
    };
  }

  if (has('colTitle0', 'colTitle1', 'colTitle2', 'colLinks0', 'colLinks1', 'colLinks2')) {
    next.footerCols = [0, 1, 2].map((i) => ({
      title: String(p['colTitle' + i] || (DEFAULTS.footerCols[i] || {}).title || '')
        .trim()
        .slice(0, 40),
      links: String(p['colLinks' + i] || '').trim().slice(0, 2000),
    }));
  }

  if (has('trustTitle0', 'trustTitle1', 'trustTitle2', 'trustTitle3')) {
    const t = [0, 1, 2, 3]
      .map((i) => ({
        title: String(p['trustTitle' + i] || '').trim().slice(0, 60),
        text: String(p['trustText' + i] || '').trim().slice(0, 90),
      }))
      .filter((x) => x.title || x.text);
    next.trust = t.length ? t : DEFAULTS.trust.slice();
  }

  next.pages = next.pages || {};
  PAGE_KEYS.forEach((slug) => {
    if (('pageTitle_' + slug) in p || ('pageHtml_' + slug) in p) {
      next.pages[slug] = {
        title: String(p['pageTitle_' + slug] || '').trim().slice(0, 120),
        html: String(p['pageHtml_' + slug] || '').trim().slice(0, 20000),
      };
    }
  });

  current = next;
  try {
    fs.writeFileSync(FILE, JSON.stringify(next, null, 2) + '\n');
  } catch (e) {
    /* ignore write errors in read-only environments */
  }
  return current;
}

module.exports = { get, save, parseLinks, DEFAULTS, PAGE_KEYS };
