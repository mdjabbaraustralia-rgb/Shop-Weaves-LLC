'use strict';

/**
 * All HTML for Shop Wave's is rendered here with template literals -
 * no template engine, no dependencies. Every helper returns a string.
 */

const fs = require('fs');
const path = require('path');
const { cartCount } = require('./sessions');
const store = require('./store');
const cfg = require('./config');
const settings = require('./settings');

/**
 * Cache-busting token for /css and /js. Some hosts/CDNs drop our no-cache
 * header, so we version the asset URLs: the token is the newest mtime of the
 * CSS/JS files, which changes on every deploy (git checkout rewrites mtimes).
 */
const ASSET_VER = (() => {
  try {
    const files = ['../public/css/style.css', '../public/js/app.js'];
    const newest = files.reduce((m, f) => {
      const t = fs.statSync(path.join(__dirname, f)).mtimeMs;
      return t > m ? t : m;
    }, 0);
    return Math.round(newest).toString(36);
  } catch (e) {
    return Date.now().toString(36);
  }
})();

// storeName / currency / shipping thresholds are all read live from settings
function siteName() {
  return settings.get().storeName || cfg.STORE_NAME;
}
function curSym() {
  const s = settings.get().currencySymbol;
  return s == null || s === '' ? cfg.CURRENCY_SYMBOL : s;
}
function freeShip() {
  const n = Number(settings.get().freeShippingFrom);
  return isFinite(n) ? n : cfg.FREE_SHIPPING_FROM;
}
function flatShip() {
  const n = Number(settings.get().flatShipping);
  return isFinite(n) ? n : cfg.FLAT_SHIPPING;
}
/** "tel:" href from a human-typed phone number (keeps digits and a leading +). */
function telHref(phone) {
  const cleaned = String(phone || '').replace(/[^\d+]/g, '');
  return 'tel:' + cleaned;
}

// ---- primitives -------------------------------------------------------

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Primary image URL for a product: first uploaded photo, else generated illustration. */
function imgSrc(p) {
  const first = p && Array.isArray(p.images) && p.images[0];
  return first ? esc(first) : '/img/' + esc(p.id) + '.svg';
}
/** All images to show for a product (photos if any, otherwise the one illustration). */
function productImages(p) {
  const list = p && Array.isArray(p.images) ? p.images.filter(Boolean) : [];
  return list.length ? list : ['/img/' + (p ? p.id : '') + '.svg'];
}

function money(n) {
  n = Number(n || 0);
  const opts =
    n % 1 === 0
      ? { maximumFractionDigits: 0 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return curSym() + n.toLocaleString('en-US', opts);
}

function stars(rating) {
  const full = Math.round(rating);
  return (
    '<span class="stars" aria-label="' +
    esc(rating) +
    ' out of 5">' +
    '★'.repeat(full) +
    '<span class="stars-dim">' +
    '★'.repeat(5 - full) +
    '</span></span>'
  );
}

/* ---- product illustrations (line art on a coloured ground) ---------------
   Each entry is inner SVG authored in a 0..300 box, stroked white.        */
const ART = {
  box: '<rect x="70" y="90" width="160" height="140" rx="16"/><path d="M70 130h160M150 90v140"/>',
  headphones: '<path d="M60 175v-18a90 90 0 0 1 180 0v18"/><rect x="42" y="168" width="46" height="82" rx="18"/><rect x="212" y="168" width="46" height="82" rx="18"/>',
  earbuds: '<path d="M112 96c-20 0-34 20-34 46 0 22 12 40 28 40 9 0 12-7 12-18v-52c0-10-4-16-6-16z"/><path d="M188 96c20 0 34 20 34 46 0 22-12 40-28 40-9 0-12-7-12-18v-52c0-10 4-16 6-16z"/>',
  watch: '<rect x="104" y="104" width="92" height="92" rx="22"/><path d="M120 104l8-42h44l8 42M120 196l8 42h44l8-42"/><path d="M150 150h22"/>',
  speaker: '<rect x="104" y="66" width="92" height="168" rx="18"/><circle cx="150" cy="108" r="13"/><circle cx="150" cy="176" r="30"/>',
  tv: '<rect x="52" y="76" width="196" height="122" rx="14"/><path d="M116 232h68M150 198v34"/>',
  keyboard: '<rect x="52" y="108" width="196" height="92" rx="14"/><path d="M84 136h12M122 136h12M160 136h12M198 136h12M222 136h6M84 168h132"/>',
  camera: '<rect x="58" y="104" width="184" height="122" rx="18"/><path d="M114 104l14-22h44l14 22"/><circle cx="150" cy="166" r="34"/>',
  battery: '<rect x="82" y="94" width="136" height="112" rx="18"/><path d="M154 118l-18 36h30l-18 36"/><path d="M120 94v-14h60v14"/>',
  drive: '<rect x="78" y="112" width="144" height="78" rx="12"/><path d="M104 151h64M200 151h.5"/>',
  garment: '<path d="M112 78 72 108l22 32 24-15v102h66V125l24 15 22-32-40-30-20 13a22 22 0 0 1-40 0z"/>',
  hanger: '<path d="M150 92a15 15 0 1 0-15 15c0 11 8 15 15 20l92 46H58l92-46"/>',
  shoe: '<path d="M56 194h58l42-26 60 8c26 4 42 14 42 32v8H56z"/><path d="M56 194v-32l30-10 16 26"/>',
  sunglasses: '<path d="M52 132h196M100 132c0 27-14 42-31 42s-31-15-31-31 6-11 22-11zM200 132c0 27 14 42 31 42s31-15 31-31-6-11-22-11z"/>',
  bag: '<path d="M84 120h132l14 122H70z"/><path d="M120 120v-16a30 30 0 0 1 60 0v16"/>',
  suitcase: '<rect x="68" y="110" width="164" height="122" rx="18"/><path d="M120 110V86a20 20 0 0 1 20-20h20a20 20 0 0 1 20 20v24M68 166h164"/>',
  bed: '<path d="M52 206v-42a24 24 0 0 1 24-24h148a24 24 0 0 1 24 24v42M52 180h196M52 206v26M248 206v26"/>',
  vacuum: '<circle cx="150" cy="66" r="14"/><path d="M150 80v64M150 144c-42 0-72 12-72 52v40h144v-40c0-40-30-52-72-52z"/>',
  lamp: '<path d="M112 240h76M150 240v-72M150 168l-46-56a46 46 0 0 1 92 0z"/>',
  microwave: '<rect x="52" y="92" width="196" height="124" rx="14"/><rect x="72" y="112" width="116" height="84" rx="8"/><path d="M212 118v22M212 158v22"/>',
  pot: '<path d="M82 128h136l-12 104a16 16 0 0 1-16 14h-64a16 16 0 0 1-16-14z"/><path d="M82 128 58 106M218 128l24-22M150 108V88"/>',
  blender: '<path d="M110 98h80l-9 92h-62z"/><rect x="116" y="190" width="68" height="52" rx="10"/><path d="M150 98V80"/>',
  utensils: '<path d="M120 66v96a20 20 0 0 0 20 20v52M120 66v52M100 66v52M182 66c-15 0-23 21-23 47s8 37 23 37v52"/>',
  bottle: '<path d="M126 88h48v24c0 8 11 15 11 32v98a16 16 0 0 1-16 16h-38a16 16 0 0 1-16-16V144c0-17 11-24 11-32z"/><path d="M122 170h56"/>',
  monitor: '<rect x="76" y="108" width="148" height="92" rx="14"/><path d="M96 154h22l11-22 15 44 11-22h32"/>',
  hairdryer: '<circle cx="128" cy="150" r="56"/><path d="M175 128l58-22v88l-58-22M118 202l-16 46h50l-6-33"/>',
  toothbrush: '<path d="M88 122c0-13 7-20 18-20h8c6 0 8 5 8 13v13h-8v92a13 13 0 0 1-26 0z"/><path d="M122 128h112M130 118v20M150 116v22M170 116v22M190 118v20M212 120v16"/>',
  scale: '<rect x="72" y="88" width="156" height="156" rx="22"/><circle cx="150" cy="166" r="42"/><path d="M150 166l24-24"/>',
  jar: '<path d="M108 112h84v14a72 72 0 0 1-72 118h58"/><path d="M108 112l-6-26h96l-6 26"/><rect x="118" y="150" width="64" height="74" rx="8"/>',
  plant: '<path d="M94 160h112l-15 84H109z"/><path d="M150 160c0-42 22-72 58-82-7 36-28 62-58 82zM150 160c0-30-16-54-42-62 4 28 20 48 42 62z"/>',
  notebook: '<rect x="88" y="66" width="124" height="168" rx="10"/><path d="M120 66v168M136 104h58M136 136h58M136 168h42"/>',
  diffuser: '<path d="M104 162a46 46 0 0 0 92 0c0-32-46-74-46-74s-46 42-46 74z"/><path d="M150 88V70M178 244h-56"/>',
  bench: '<rect x="62" y="150" width="176" height="72" rx="14"/><path d="M62 176h176M84 222v20M216 222v20"/>',
  chip: '<rect x="92" y="92" width="116" height="116" rx="16"/><path d="M122 60v32M178 60v32M122 208v32M178 208v32M60 122h32M60 178h32M208 122h32M208 178h32"/><rect x="126" y="126" width="48" height="48" rx="8"/>',
  house: '<path d="M58 152 150 74l92 78M84 136v100h132V136M130 236v-56h40v56"/>',
  health: '<path d="M122 78h56v42h42v56h-42v42h-56v-42H80v-56h42z"/>',
  basket: '<path d="M68 130h164l-18 102a18 18 0 0 1-18 15H104a18 18 0 0 1-18-15z"/><path d="M110 130 150 68l40 62M120 165v42M180 165v42"/>',
  pencil: '<path d="M200 66 234 100 116 218H82v-34z"/><path d="M174 92l34 34"/>',
};

const ART_KEYWORDS = [
  [/headphone/, 'headphones'], [/earbud|earphone|neckband|air ?pod|pods/, 'earbuds'],
  [/watch/, 'watch'], [/soundbar|speaker/, 'speaker'], [/\btv\b|television/, 'tv'],
  [/keyboard/, 'keyboard'], [/camera|webcam/, 'camera'], [/power ?bank|charger|charging/, 'battery'],
  [/ssd|hard drive|\bdrive\b|hub/, 'drive'],
  [/jacket|sweater|polo|shirt|tee|hoodie|knit/, 'garment'], [/sunglass/, 'sunglasses'],
  [/sneaker|shoe|boot|running/, 'shoe'],
  [/backpack/, 'suitcase'], [/handbag|tote|duffel|packing cube/, 'bag'],
  [/suitcase|luggage|cabin/, 'suitcase'],
  [/bedsheet|bed sheet|pillow|sheet set/, 'bed'], [/vacuum/, 'vacuum'],
  [/lamp/, 'lamp'], [/ottoman|bench/, 'bench'], [/diffuser/, 'diffuser'],
  [/microwave|oven/, 'microwave'], [/air fryer|fryer/, 'pot'],
  [/rice cooker|\bcooker\b|kettle|cooktop/, 'pot'], [/mixer|blender/, 'blender'],
  [/cutlery|knife|fork|spoon/, 'utensils'], [/cookware|\bpan\b|pot set/, 'pot'],
  [/bottle|flask/, 'bottle'],
  [/blood pressure|glucose|meter|monitor/, 'monitor'], [/hair dryer|dryer/, 'hairdryer'],
  [/toothbrush/, 'toothbrush'], [/\bscale\b|weighing/, 'scale'],
  [/date|cashew|nut|honey|olive oil|\boil\b|grocery/, 'jar'],
  [/planter|plant pot/, 'plant'], [/notebook|diary|journal/, 'notebook'],
];

const ART_BY_CATEGORY = {
  Electronics: 'chip',
  Fashion: 'hanger',
  'Home & Living': 'house',
  Appliances: 'microwave',
  'Kitchen & Dining': 'utensils',
  'Health & Beauty': 'health',
  Grocery: 'basket',
  'Bags & Travel': 'suitcase',
  Stationery: 'pencil',
};

function pickArt(product) {
  const name = String(product.name || '').toLowerCase();
  for (const [re, key] of ART_KEYWORDS) if (re.test(name) && ART[key]) return ART[key];
  return ART[ART_BY_CATEGORY[product.category]] || ART.box;
}

/** Deterministic illustrated image for a product (served at /img/<id>.svg). */
function placeholderSvg(product) {
  const [c1, c2] =
    product.colors && product.colors.length >= 2 ? product.colors : ['#e56b1f', '#7c3a10'];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img" aria-label="${esc(
    product.name
  )}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${esc(c1)}"/>
      <stop offset="1" stop-color="${esc(c2)}"/>
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#g)"/>
  <circle cx="300" cy="290" r="188" fill="rgba(255,255,255,0.08)"/>
  <circle cx="300" cy="290" r="140" fill="rgba(255,255,255,0.06)"/>
  <g transform="translate(150,140)" fill="none" stroke="#fff" stroke-width="12"
     stroke-linecap="round" stroke-linejoin="round" opacity="0.94">${pickArt(product)}</g>
  <text x="300" y="530" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="26"
        letter-spacing="3" fill="rgba(255,255,255,0.92)" text-anchor="middle">${esc(
          product.category.toUpperCase()
        )}</text>
</svg>`;
}

// ---- icons (inline, currentColor) -----------------------------------------

const icon = {
  search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  bag: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  truck: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
  shield: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>',
  chat: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

// payment acceptance marks (simple SVG, shown in the footer)
const PAY_MARKS = [
  `<svg viewBox="0 0 48 30" aria-label="Visa"><rect width="48" height="30" rx="4" fill="#fff"/><text x="24" y="20" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="800" font-style="italic" letter-spacing="1" fill="#1434CB" text-anchor="middle">VISA</text></svg>`,
  `<svg viewBox="0 0 48 30" aria-label="Mastercard"><rect width="48" height="30" rx="4" fill="#fff"/><circle cx="21" cy="15" r="8.5" fill="#EB001B"/><circle cx="27" cy="15" r="8.5" fill="#F79E1B"/><path d="M24 8.4a8.5 8.5 0 0 0 0 13.2 8.5 8.5 0 0 0 0-13.2Z" fill="#FF5F00"/></svg>`,
  `<svg viewBox="0 0 48 30" aria-label="American Express"><rect width="48" height="30" rx="4" fill="#1F72CD"/><text x="24" y="19" font-family="Arial,Helvetica,sans-serif" font-size="9.5" font-weight="800" letter-spacing="0.5" fill="#fff" text-anchor="middle">AMEX</text></svg>`,
  `<svg viewBox="0 0 48 30" aria-label="PayPal"><rect width="48" height="30" rx="4" fill="#fff"/><text x="24" y="20" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="800" font-style="italic" text-anchor="middle"><tspan fill="#003087">Pay</tspan><tspan fill="#009CDE">Pal</tspan></text></svg>`,
  `<svg viewBox="0 0 48 30" aria-label="Apple Pay"><rect width="48" height="30" rx="4" fill="#fff"/><path d="M14.9 11.1c-.5.6-1.2.98-2 .93-.1-.8.28-1.63.73-2.13.5-.58 1.35-.98 2.02-1.02.07.83-.26 1.63-.75 2.22Zm.76 1.18c-1.1-.06-2.03.62-2.55.62-.53 0-1.34-.6-2.2-.58-1.13.02-2.18.65-2.75 1.66-1.18 2.04-.3 5.05.84 6.7.56.82 1.22 1.72 2.1 1.68.83-.03 1.15-.54 2.16-.54s1.3.54 2.18.53c.9-.02 1.47-.82 2.02-1.63.64-.93.9-1.83.9-1.88-.01-.01-1.73-.67-1.75-2.66-.02-1.66 1.36-2.46 1.42-2.5-.78-1.15-1.99-1.28-2.42-1.3Z" fill="#000"/><text x="30" y="19.5" font-family="Arial,Helvetica,sans-serif" font-size="10.5" font-weight="700" fill="#000" text-anchor="middle">Pay</text></svg>`,
];

// category icons (24px, currentColor)
const CAT_ICONS = {
  electronics:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2.5v3M15 2.5v3M9 18.5v3M15 18.5v3M2.5 9h3M2.5 15h3M18.5 9h3M18.5 15h3"/></svg>',
  fashion:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3.5 4 6l2 3.5 2-1.2V20.5h8V8.3l2 1.2L20 6l-4-2.5-1.5 1a4 4 0 0 1-5 0L8 3.5Z"/></svg>',
  home:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
  stationery:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 3.5 20.5 7.5 8 20H4v-4L16.5 3.5Z"/><path d="M13.5 6.5l4 4"/></svg>',
  books:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4a2 2 0 0 1 2-2h12v18H7a2 2 0 0 0-2 2V4Z"/><path d="M9 2v18"/></svg>',
  appliances:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M7 6.5h.01M10 6.5h.01"/></svg>',
  kitchen:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 21v-9M6 12a3 3 0 0 0 3-3V3M9 3v6M4 3v6a2 2 0 0 0 2 2"/><path d="M17 21v-8c-2 0-3-1.5-3-4s1-6 3-6 3 3.5 3 6-1 4-3 4"/></svg>',
  beauty:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.4-9.3-9A5 5 0 0 1 12 6a5 5 0 0 1 9.3 6C19 16.6 12 21 12 21Z"/></svg>',
  grocery:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11h14l-1.4 8.3a2 2 0 0 1-2 1.7H8.4a2 2 0 0 1-2-1.7L5 11Z"/><path d="M9 11 12 4l3 7"/><path d="M9.5 15v2M14.5 15v2"/></svg>',
  bags:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M4 14h16"/></svg>',
  mobile:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg>',
  default:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13 11 4h9v9l-9 9-7-7Z"/><circle cx="15.5" cy="8.5" r="1.6"/></svg>',
};
function catIcon(name) {
  const key = String(name || '').toLowerCase();
  if (CAT_ICONS[key]) return CAT_ICONS[key];
  if (key.indexOf('mobile') > -1 || key.indexOf('phone') > -1 || key.indexOf('tablet') > -1) return CAT_ICONS.mobile;
  if (key.indexOf('applianc') > -1) return CAT_ICONS.appliances;
  if (key.indexOf('home') > -1) return CAT_ICONS.home;
  if (key.indexOf('kitchen') > -1 || key.indexOf('dining') > -1) return CAT_ICONS.kitchen;
  if (key.indexOf('beaut') > -1 || key.indexOf('health') > -1 || key.indexOf('care') > -1) return CAT_ICONS.beauty;
  if (key.indexOf('grocer') > -1 || key.indexOf('food') > -1) return CAT_ICONS.grocery;
  if (key.indexOf('bag') > -1 || key.indexOf('travel') > -1 || key.indexOf('luggage') > -1) return CAT_ICONS.bags;
  if (key.indexOf('book') > -1) return CAT_ICONS.books;
  if (key.indexOf('cloth') > -1 || key.indexOf('apparel') > -1) return CAT_ICONS.fashion;
  return CAT_ICONS.default;
}

// ---- shell ----------------------------------------------------------------

function header(session, active) {
  const s = settings.get();
  const count = session ? cartCount(session) : 0;
  const cats = store.getCategories();

  const announce = (s.announce && s.announce.length ? s.announce : ['Free shipping', '7-day returns', 'Secure checkout'])
    .map((m, i) => `${i === 0 ? icon.truck : '<span class="dot">&bull;</span>'}<span>${esc(m)}</span>`)
    .join('\n  ');

  const navItems = [
    ['/', 'Home', 'home'],
    ['/shop', 'Shop', 'shop'],
    ...['Electronics', 'Fashion', 'Appliances', 'Home & Living', 'Health & Beauty']
      .filter((c) => cats.indexOf(c) > -1)
      .map((c) => ['/shop?category=' + encodeURIComponent(c), esc(c), 'cat:' + c]),
  ];

  return `<div class="announcement">
  ${announce}
</div>
<header class="site-header">
  <input id="nav-toggle" class="nav-toggle" type="checkbox" aria-hidden="true">
  <input id="search-toggle" class="search-toggle" type="checkbox" aria-hidden="true">
  <div class="header-bar wrap">
    <label for="nav-toggle" class="nav-burger" aria-label="Menu"><span></span></label>

    <a class="brand" href="/" aria-label="${esc(s.storeName)} home">
      <img class="brand-logo" src="${esc(s.logoUrl || '/img/logo.png')}" alt="${esc(s.storeName)}" height="36">
    </a>

    <nav class="main-nav" aria-label="Primary">
      ${navItems
        .map(
          ([href, label, key]) =>
            `<a href="${href}"${active === key ? ' class="active" aria-current="page"' : ''}>${label}</a>`
        )
        .join('\n      ')}
    </nav>

    <div class="header-actions">
      <label for="search-toggle" class="act-btn search-btn" aria-label="Search" role="button" tabindex="0">${icon.search}</label>
      <a class="act-btn" href="/admin" aria-label="Account">${icon.user}</a>
      <a class="act-btn cart-link" href="/cart" aria-label="Cart (${count} item${count === 1 ? '' : 's'})">
        ${icon.bag}${count > 0 ? `<span class="cart-badge">${count > 99 ? '99+' : count}</span>` : ''}
      </a>
    </div>
  </div>

  <div class="search-drop">
    <form class="search wrap" action="/shop" method="get" role="search">
      <span class="search-ico" aria-hidden="true">${icon.search}</span>
      <input type="search" name="search" placeholder="Search for products, brands and more" aria-label="Search products">
      <button class="search-go" type="submit" aria-label="Search">${icon.arrow}</button>
    </form>
  </div>
</header>`;
}

function footer() {
  const s = settings.get();
  const year = new Date().getFullYear();

  const cols = (s.footerCols || []).map((col) => {
    const links = settings.parseLinks(col.links);
    if (!links.length && !col.title) return '';
    return `<div class="footer-col">
      <h4>${esc(col.title)}</h4>
      <ul>${links.map((l) => `<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`).join('')}</ul>
    </div>`;
  }).join('');

  const soc = s.social || {};
  const social = [
    ['Instagram', 'IG', soc.instagram],
    ['Twitter', 'X', soc.twitter],
    ['Facebook', 'f', soc.facebook],
  ]
    .map(([label, glyph, href]) => `<a href="${esc(href || '#')}" class="soc" aria-label="${label}">${glyph}</a>`)
    .join('');

  const pay = PAY_MARKS.map((svg) => `<span class="pay-mark">${svg}</span>`).join('');
  const legal = s.legalName || s.storeName;
  const copyright = s.copyright || `© ${year} ${esc(legal)}. All rights reserved.`;

  const contactBits = [
    s.address ? esc(s.address) : '',
    s.supportPhone ? `<a href="${esc(telHref(s.supportPhone))}">${esc(s.supportPhone)}</a>` : '',
    s.supportEmail ? `<a href="mailto:${esc(s.supportEmail)}">${esc(s.supportEmail)}</a>` : '',
  ].filter(Boolean);
  const contactLine = contactBits.length
    ? `<p class="footer-contact">${contactBits.join('<span class="dot">&bull;</span>')}</p>`
    : '';

  return `<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="footer-brand">
      <a class="brand" href="/" aria-label="${esc(s.storeName)} home">
        <img class="brand-logo" src="${esc(s.logoDarkUrl || '/img/logo-dark.png')}" alt="${esc(s.storeName)}" height="46">
      </a>
      <p>${esc(s.footerBlurb)}</p>
      ${contactLine}
      <div class="social">${social}</div>
    </div>
    ${cols}
    <div class="footer-col newsletter">
      <h4>${esc(s.newsletterHeading || 'Join the list')}</h4>
      ${s.newsletterText ? `<p>${esc(s.newsletterText)}</p>` : ''}
      <form class="nl-form" action="/newsletter" method="post">
        <input type="email" name="email" placeholder="you@example.com" aria-label="Email address" required>
        <button type="submit">Subscribe</button>
      </form>
    </div>
  </div>
  <div class="wrap footer-bottom">
    <p>${esc(copyright)}</p>
    <div class="pay-row">${pay}</div>
    <div class="footer-legal">
      <a href="/p/privacy">Privacy</a>
      <a href="/p/terms">Terms</a>
      <a href="/p/shipping">Shipping</a>
    </div>
  </div>
</footer>`;
}

function layout({ title, body, session, active = '', flash = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0b0b0f">
<title>${esc(title)} &middot; ${esc(siteName())}</title>
<meta name="description" content="${esc(settings.get().tagline)}">
<link rel="icon" href="/img/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap">
<link rel="stylesheet" href="/css/style.css?v=${ASSET_VER}">
</head>
<body>
${header(session, active)}
${flash ? `<div class="flash-wrap"><div class="wrap"><p class="flash">${icon.shield}<span>${esc(flash)}</span></p></div></div>` : ''}
<main class="wrap">
${body}
</main>
${footer()}
<script src="/js/app.js?v=${ASSET_VER}" defer></script>
</body>
</html>`;
}

// ---- components ---------------------------------------------------------

function productCard(p) {
  const hasSale = p.oldPrice && p.oldPrice > p.price;
  const off = hasSale
    ? `<span class="tag tag-sale">-${Math.round((1 - p.price / p.oldPrice) * 100)}%</span>`
    : '';
  return `<article class="card">
  <a class="card-media" href="/product/${esc(p.id)}">
    <img src="${imgSrc(p)}" alt="${esc(p.name)}" loading="lazy" width="600" height="600">
    <span class="card-tags">${off}${
    p.stock === 0 ? '<span class="tag tag-out">Sold out</span>' : ''
  }</span>
    <span class="card-quick">View product</span>
  </a>
  <div class="card-body">
    <span class="card-cat">${esc(p.category)}</span>
    <h3><a href="/product/${esc(p.id)}">${esc(p.name)}</a></h3>
    <div class="card-rating">${stars(p.rating)}<span>${esc(p.rating)}</span></div>
    <div class="card-foot">
      <span class="price">${money(p.price)}${hasSale ? `<s>${money(p.oldPrice)}</s>` : ''}</span>
      <form method="post" action="/cart/add">
        <input type="hidden" name="id" value="${esc(p.id)}">
        <button class="btn btn-sm" ${p.stock === 0 ? 'disabled' : ''}>Add</button>
      </form>
    </div>
  </div>
</article>`;
}

function grid(products) {
  if (!products.length) {
    return `<div class="empty"><p>No products match your search.</p><a class="btn btn-ghost" href="/shop">Clear filters</a></div>`;
  }
  return `<div class="grid">${products.map(productCard).join('')}</div>`;
}

function trustRow() {
  const icons = [icon.truck, icon.refresh, icon.shield, icon.chat];
  const items = (settings.get().trust || []).filter((t) => t && (t.title || t.text));
  if (!items.length) return '';
  return `<section class="trust">
  ${items
    .map(
      (t, i) =>
        `<div><span class="trust-ico">${icons[i % icons.length]}</span><div><strong>${esc(
          t.title
        )}</strong><span>${esc(t.text)}</span></div></div>`
    )
    .join('\n  ')}
</section>`;
}

// ---- pages ------------------------------------------------------------------

function homePage({ featured, categories, session }) {
  const s = settings.get();
  const heroFlag = s.heroFlag
    ? `<span class="hero-flag">${
        s.heroFlagTag ? `<span class="tag tag-sale">${esc(s.heroFlagTag)}</span> ` : ''
      }${esc(s.heroFlag)}</span>`
    : '';
  const body = `
<section class="hero-banner">
  <picture class="hero-bg">
    <source media="(max-width: 640px)" srcset="/img/hero-banner-mobile.jpg">
    <img src="/img/hero-banner.jpg" alt="${esc(siteName())}" width="1920" height="1279" fetchpriority="high">
  </picture>
  <div class="hero-inner">
    ${s.heroEyebrow ? `<p class="eyebrow">${esc(s.heroEyebrow)}</p>` : ''}
    <h1>${esc(s.heroHeading || s.tagline)}</h1>
    ${s.heroLead ? `<p class="lead">${esc(s.heroLead)}</p>` : ''}
    <div class="hero-actions">
      <a class="btn btn-lg" href="/shop">${esc(s.heroCta || 'Shop all products')}</a>
    </div>
  </div>
  ${heroFlag}
</section>

${trustRow()}

<section>
  <div class="section-head">
    <div><h2>${esc(s.catHeading || 'Shop by category')}</h2>${
      s.catSub ? `<p class="muted">${esc(s.catSub)}</p>` : ''
    }</div>
  </div>
  <div class="cat-grid">
    ${categories
      .map(
        (c) =>
          `<a class="cat-tile" href="/shop?category=${encodeURIComponent(c)}">
            <span class="cat-ico" aria-hidden="true">${catIcon(c)}</span>
            <span class="cat-name">${esc(c)}</span>
            <span class="cat-go" aria-hidden="true">${icon.arrow}</span>
          </a>`
      )
      .join('')}
  </div>
</section>

${categories
  .map((cat) => {
    const items = store.getProducts({ category: cat }).slice(0, 5);
    if (!items.length) return '';
    return `<section class="home-cat">
  <div class="section-head">
    <div><h2>${esc(cat)}</h2></div>
    <a class="section-link" href="/shop?category=${encodeURIComponent(cat)}">View all &rarr;</a>
  </div>
  <div class="grid">${items.map(productCard).join('')}</div>
</section>`;
  })
  .join('')}

<section class="cta-band">
  <div>
    <h2>${esc(s.memberHeading || 'Become a member')}</h2>
    ${s.memberText ? `<p>${esc(s.memberText)}</p>` : ''}
  </div>
  <a class="btn btn-lg btn-invert" href="/shop">${esc(s.memberCta || 'Start shopping')}</a>
</section>`;
  return layout({ title: 'Home', body, session, active: 'home' });
}

function shopPage({ products, categories, filters, session }) {
  const qs = (over) => {
    const params = [];
    const merged = Object.assign(
      { category: filters.category, search: filters.search, sort: filters.sort },
      over
    );
    Object.keys(merged).forEach((k) => {
      if (merged[k]) params.push(k + '=' + encodeURIComponent(merged[k]));
    });
    return params.length ? '?' + params.join('&') : '';
  };

  const chips = ['All', ...categories]
    .map((c) => {
      const on = (!filters.category && c === 'All') || filters.category === c;
      return `<a class="chip${on ? ' on' : ''}" href="/shop${
        c === 'All' ? qs({ category: '' }) : qs({ category: c })
      }">${esc(c)}</a>`;
    })
    .join('');

  const heading = filters.search
    ? `Results for &ldquo;${esc(filters.search)}&rdquo;`
    : esc(filters.category || 'All products');

  const body = `
<nav class="crumbs"><a href="/">Home</a><span>/</span><a href="/shop">Shop</a>${
    filters.category ? `<span>/</span><span>${esc(filters.category)}</span>` : ''
  }</nav>

<div class="shop-head">
  <div><h1>${heading}</h1><p class="muted">${products.length} product${
    products.length === 1 ? '' : 's'
  }</p></div>
  <form method="get" class="sort" action="/shop">
    ${filters.category ? `<input type="hidden" name="category" value="${esc(filters.category)}">` : ''}
    ${filters.search ? `<input type="hidden" name="search" value="${esc(filters.search)}">` : ''}
    <label for="sort">Sort by</label>
    <select id="sort" name="sort" onchange="this.form.submit()">
      <option value="" ${!filters.sort ? 'selected' : ''}>Featured</option>
      <option value="price-asc" ${filters.sort === 'price-asc' ? 'selected' : ''}>Price: low to high</option>
      <option value="price-desc" ${filters.sort === 'price-desc' ? 'selected' : ''}>Price: high to low</option>
      <option value="rating" ${filters.sort === 'rating' ? 'selected' : ''}>Top rated</option>
    </select>
  </form>
</div>

<div class="chips">${chips}</div>

${grid(products)}`;
  return layout({ title: filters.category || 'Shop', body, session, active: 'shop' });
}

function productPage({ product, related, session, flash }) {
  const p = product;
  const hasSale = p.oldPrice && p.oldPrice > p.price;
  const reviews = Array.isArray(p.reviews) ? p.reviews : [];
  const rc = reviews.length;
  const avg = rc ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / rc) * 10) / 10 : 0;
  const canReview = !!(session && session.buyer && session.purchased && session.purchased[p.id]);
  const buyerName = session && session.buyer ? session.buyer.name : '';
  const body = `
<nav class="crumbs">
  <a href="/">Home</a><span>/</span>
  <a href="/shop">Shop</a><span>/</span>
  <a href="/shop?category=${encodeURIComponent(p.category)}">${esc(p.category)}</a><span>/</span>
  <span>${esc(p.name)}</span>
</nav>

<div class="pdp">
  <div class="pdp-gallery${productImages(p).length > 1 ? ' has-thumbs' : ''}">
    <div class="pdp-media">
      ${productImages(p)
        .map(
          (src, i) => `<input type="radio" name="pgal-${esc(p.id)}" id="pgal-${esc(p.id)}-${i}" class="pgal-r"${
            i === 0 ? ' checked' : ''
          }>
      <img class="pgal-img" src="${esc(src)}" alt="${esc(p.name)}${
            i ? ' - view ' + (i + 1) : ''
          }" width="600" height="600"${i === 0 ? '' : ' loading="lazy"'}>`
        )
        .join('\n      ')}
      ${hasSale ? `<span class="tag tag-sale">-${Math.round((1 - p.price / p.oldPrice) * 100)}%</span>` : ''}
    </div>
    ${
      productImages(p).length > 1
        ? `<div class="pdp-thumbs">${productImages(p)
            .map(
              (src, i) =>
                `<label class="pdp-thumb" for="pgal-${esc(p.id)}-${i}"><img src="${esc(
                  src
                )}" alt="" loading="lazy" width="80" height="80"></label>`
            )
            .join('')}</div>`
        : ''
    }
  </div>
  <div class="pdp-info">
    <span class="card-cat">${esc(p.category)}</span>
    <h1>${esc(p.name)}</h1>
    <div class="pdp-rating">${stars(rc ? avg : p.rating)}${
    rc
      ? `<a class="muted" href="#reviews">${avg} &middot; ${rc} review${rc === 1 ? '' : 's'}</a>`
      : `<span class="muted">No reviews yet</span>`
  }</div>
    <p class="pdp-price">${money(p.price)}${hasSale ? `<s>${money(p.oldPrice)}</s>` : ''}${
    hasSale ? `<span class="save">Save ${money(p.oldPrice - p.price)}</span>` : ''
  }</p>
    <p class="pdp-desc">${esc(p.description)}</p>
    <p class="stock ${p.stock === 0 ? 'out' : p.stock < 10 ? 'low' : 'in'}">
      <span class="dot-ind"></span>
      ${p.stock === 0 ? 'Out of stock' : p.stock < 10 ? `Only ${p.stock} left in stock` : 'In stock, ready to ship'}
    </p>
    <form class="pdp-buy" id="buy" method="post" action="/cart/add">
      <input type="hidden" name="id" value="${esc(p.id)}">
      <div class="qty-input">
        <label for="qty">Qty</label>
        <input id="qty" type="number" name="qty" value="1" min="1" max="${Math.max(1, p.stock)}">
      </div>
      <button class="btn btn-lg" ${p.stock === 0 ? 'disabled' : ''}>Add to cart</button>
      <button class="btn btn-lg btn-ghost" formaction="/cart/add?buyNow=1" ${
        p.stock === 0 ? 'disabled' : ''
      }>Buy now</button>
    </form>
    <ul class="pdp-meta">
      <li>${icon.truck}<span>Free delivery over ${money(freeShip())}</span></li>
      <li>${icon.refresh}<span>7-day easy returns</span></li>
      <li>${icon.shield}<span>Genuine product guarantee</span></li>
    </ul>
    <p class="pdp-sku muted">SKU: ${esc(p.id.toUpperCase())}</p>
  </div>
</div>

${reviewsSection(p, reviews, avg, { canReview, buyerName })}

<section>
  <div class="section-head"><div><h2>You might also like</h2></div><a class="section-link" href="/shop?category=${encodeURIComponent(
    p.category
  )}">More ${esc(p.category)} &rarr;</a></div>
  ${grid(related)}
</section>`;
  return layout({ title: p.name, body, session, active: 'shop', flash });
}

function reviewItem(r) {
  const initials = String(r.author || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const when = (() => {
    const d = new Date(r.date);
    return isNaN(d) ? esc(r.date) : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  })();
  return `<article class="review">
  <div class="review-head">
    <span class="review-avatar" aria-hidden="true">${esc(initials)}</span>
    <div class="review-who">
      <strong>${esc(r.author || 'Anonymous')}</strong>
      <span class="review-sub">${stars(r.rating)} <span class="dot">&bull;</span> ${when} <span class="verified">Verified buyer</span></span>
    </div>
  </div>
  <p>${esc(r.body)}</p>
</article>`;
}

function reviewsSection(p, reviews, avg, opts = {}) {
  const rc = reviews.length;
  const { canReview, buyerName } = opts;
  const dist = [5, 4, 3, 2, 1].map((n) => ({
    n,
    c: reviews.filter((r) => Math.round(r.rating) === n).length,
  }));
  return `<section class="reviews" id="reviews">
  <div class="section-head"><div><h2>Customer reviews</h2><p class="muted">${
    rc ? `${avg} out of 5 &middot; ${rc} review${rc === 1 ? '' : 's'}` : 'Be the first to review this product'
  }</p></div></div>
  <div class="reviews-layout">
    <div class="reviews-summary">
      <div class="rev-score">${rc ? avg : '&ndash;'}</div>
      <div class="rev-score-stars">${stars(rc ? avg : 0)}</div>
      <p class="muted">${rc} review${rc === 1 ? '' : 's'}</p>
      ${
        rc
          ? `<div class="rev-bars">${dist
              .map(
                (d) =>
                  `<div class="rev-bar"><span>${d.n}&#9733;</span><div class="rev-track"><span style="width:${
                    rc ? Math.round((d.c / rc) * 100) : 0
                  }%"></span></div><span class="rev-c">${d.c}</span></div>`
              )
              .join('')}</div>`
          : ''
      }
    </div>
    <div class="reviews-main">
      ${rc ? reviews.map(reviewItem).join('') : '<p class="muted no-rev">No reviews yet &mdash; be the first verified buyer to review this product.</p>'}
      ${
        canReview
          ? `<details class="review-write" open>
        <summary>Write a review</summary>
        <form method="post" action="/product/${esc(p.id)}/review" class="review-form">
          <p class="muted small">Posting as <strong>${esc(buyerName)}</strong> &middot; <span class="verified">Verified buyer</span></p>
          <label class="field"><span>Rating</span>
            <select name="rating">
              <option value="5">5 &mdash; Excellent</option>
              <option value="4">4 &mdash; Good</option>
              <option value="3">3 &mdash; Okay</option>
              <option value="2">2 &mdash; Poor</option>
              <option value="1">1 &mdash; Bad</option>
            </select>
          </label>
          <label class="field"><span>Your review</span><textarea name="body" rows="3" required placeholder="What did you think?"></textarea></label>
          <button class="btn">Submit review</button>
        </form>
      </details>`
          : `<div class="review-locked">
        ${icon.shield}
        <div>
          <strong>Only verified buyers can review this product</strong>
          <p class="muted small">Reviews come from customers who bought this item. <a href="/product/${esc(
            p.id
          )}#buy">Purchase it</a> and it will unlock here after checkout.</p>
        </div>
      </div>`
      }
    </div>
  </div>
</section>`;
}

function cartLine(item) {
  return `<tr>
  <td class="c-prod">
    <img src="/img/${esc(item.id)}.svg" alt="" width="72" height="72">
    <div>
      <a href="/product/${esc(item.id)}">${esc(item.name)}</a>
      <span class="muted">${money(item.price)} each</span>
    </div>
  </td>
  <td>
    <div class="qty-form">
      <form method="post" action="/cart/update">
        <input type="hidden" name="id" value="${esc(item.id)}">
        <input type="hidden" name="qty" value="${item.qty - 1}">
        <button aria-label="Decrease quantity">&minus;</button>
      </form>
      <form method="post" action="/cart/update">
        <input type="hidden" name="id" value="${esc(item.id)}">
        <input type="number" name="qty" value="${item.qty}" min="0" max="${item.stock}" aria-label="Quantity">
        <button class="qty-set" aria-label="Update quantity">OK</button>
      </form>
      <form method="post" action="/cart/update">
        <input type="hidden" name="id" value="${esc(item.id)}">
        <input type="hidden" name="qty" value="${item.qty + 1}">
        <button aria-label="Increase quantity" ${item.qty >= item.stock ? 'disabled' : ''}>+</button>
      </form>
    </div>
  </td>
  <td class="c-line">${money(item.price * item.qty)}</td>
  <td>
    <form method="post" action="/cart/update">
      <input type="hidden" name="id" value="${esc(item.id)}">
      <input type="hidden" name="qty" value="0">
      <button class="link-danger" aria-label="Remove ${esc(item.name)}">Remove</button>
    </form>
  </td>
</tr>`;
}

function summaryBox(totals, cta) {
  const FREE_SHIPPING_FROM = freeShip();
  const remaining = FREE_SHIPPING_FROM - totals.subtotal;
  return `<aside class="summary">
  <h2>Order summary</h2>
  <dl>
    <div><dt>Subtotal</dt><dd>${money(totals.subtotal)}</dd></div>
    <div><dt>Shipping</dt><dd>${totals.shipping === 0 ? 'Free' : money(totals.shipping)}</dd></div>
    <div class="total"><dt>Total</dt><dd>${money(totals.total)}</dd></div>
  </dl>
  ${
    totals.subtotal > 0 && totals.shipping > 0
      ? `<div class="ship-bar"><p>Add <strong>${money(
          remaining
        )}</strong> for free shipping</p><div class="bar"><span style="width:${Math.min(
          100,
          Math.round((totals.subtotal / FREE_SHIPPING_FROM) * 100)
        )}%"></span></div></div>`
      : totals.subtotal > 0
      ? `<p class="ship-ok">${icon.truck}<span>You&rsquo;ve unlocked free shipping</span></p>`
      : ''
  }
  ${cta}
  <p class="pay-note muted">${icon.shield}<span>Encrypted, secure payment</span></p>
</aside>`;
}

function cartPage({ items, totals, session, flash }) {
  const body = items.length
    ? `<div class="page-head"><h1>Your cart</h1><a class="section-link" href="/shop">&larr; Continue shopping</a></div>
<div class="cart-layout">
  <table class="cart-table">
    <thead><tr><th>Product</th><th>Quantity</th><th>Total</th><th></th></tr></thead>
    <tbody>${items.map(cartLine).join('')}</tbody>
  </table>
  ${summaryBox(
    totals,
    '<a class="btn btn-lg btn-block" href="/checkout">Proceed to checkout</a>'
  )}
</div>`
    : `<div class="empty-state">
  <div class="empty-ico">${icon.bag}</div>
  <h1>Your cart is empty</h1>
  <p>Once you add items, they&rsquo;ll show up here.</p>
  <a class="btn btn-lg" href="/shop">Start shopping</a>
</div>`;
  return layout({ title: 'Cart', body, session, active: '', flash });
}

function checkoutPage({ items, totals, session, errors = {}, values = {} }) {
  const field = (name, label, type = 'text', extra = '') => `
  <label class="field ${errors[name] ? 'has-error' : ''}">
    <span>${label}</span>
    ${
      type === 'textarea'
        ? `<textarea name="${name}" rows="3" ${extra}>${esc(values[name] || '')}</textarea>`
        : `<input type="${type}" name="${name}" value="${esc(values[name] || '')}" ${extra}>`
    }
    ${errors[name] ? `<em class="err">${esc(errors[name])}</em>` : ''}
  </label>`;

  const body = `
<div class="page-head"><h1>Checkout</h1><a class="section-link" href="/cart">&larr; Back to cart</a></div>
<div class="cart-layout">
  <form class="checkout-form" method="post" action="/checkout">
    <fieldset>
      <legend><span class="step">1</span> Contact</legend>
      ${field('name', 'Full name', 'text', 'required autocomplete="name"')}
      <div class="row">
        ${field('email', 'Email', 'email', 'required autocomplete="email"')}
        ${field('phone', 'Phone', 'tel', 'required autocomplete="tel"')}
      </div>
    </fieldset>
    <fieldset>
      <legend><span class="step">2</span> Delivery address</legend>
      ${field('address', 'Street address', 'textarea', 'required autocomplete="street-address"')}
      <div class="row">
        ${field('city', 'City', 'text', 'required')}
        ${field('postcode', 'ZIP / Postcode', 'text', 'autocomplete="postal-code"')}
      </div>
    </fieldset>
    <fieldset>
      <legend><span class="step">3</span> Payment</legend>
      <label class="pay-opt"><input type="radio" name="payment" value="cod" ${
        values.payment !== 'card' ? 'checked' : ''
      }><span><strong>Cash on delivery</strong><small>Pay when your order arrives</small></span></label>
      <label class="pay-opt"><input type="radio" name="payment" value="card" ${
        values.payment === 'card' ? 'checked' : ''
      }><span><strong>Card</strong><small>Visa, Mastercard &amp; American Express</small></span></label>
      <p class="muted small">${icon.shield}<span> Payments are encrypted and processed securely.</span></p>
    </fieldset>
    <button class="btn btn-lg btn-block" type="submit">Place order &middot; ${money(totals.total)}</button>
  </form>
  ${summaryBox(
    totals,
    `<ul class="mini-items">${items
      .map(
        (i) =>
          `<li><span class="mi-name">${esc(i.name)}<span class="muted"> &times;${i.qty}</span></span><span>${money(
            i.price * i.qty
          )}</span></li>`
      )
      .join('')}</ul>`
  )}
</div>`;
  return layout({ title: 'Checkout', body, session, active: '' });
}

function confirmationPage({ order, session }) {
  const body = `
<div class="confirm">
  <div class="check">${icon.shield}</div>
  <h1>Thank you, ${esc(order.customer.name.split(' ')[0])}!</h1>
  <p class="confirm-sub">Order <strong>${esc(order.id)}</strong> is confirmed. A receipt is on its way to ${esc(
    order.customer.email
  )}.</p>

  <div class="confirm-card">
    <div class="confirm-card-head">
      <div><h2>Order ${esc(order.id)}</h2><p class="muted">Placed ${new Date(
    order.createdAt
  ).toLocaleString()}</p></div>
      <span class="tag tag-in">${esc(order.status)}</span>
    </div>
    <table class="line-table">
      <tbody>
        ${order.items
          .map(
            (i) =>
              `<tr><td>${esc(i.name)} <span class="muted">&times;${i.qty}</span></td><td class="c-line">${money(
                i.price * i.qty
              )}</td></tr>`
          )
          .join('')}
      </tbody>
      <tfoot>
        <tr><td>Subtotal</td><td class="c-line">${money(order.totals.subtotal)}</td></tr>
        <tr><td>Shipping</td><td class="c-line">${
          order.totals.shipping === 0 ? 'Free' : money(order.totals.shipping)
        }</td></tr>
        <tr class="grand"><td>Total</td><td class="c-line">${money(order.totals.total)}</td></tr>
      </tfoot>
    </table>
    <div class="confirm-meta">
      <div><span class="muted">Deliver to</span><p>${esc(order.customer.address)}, ${esc(
    order.customer.city
  )} ${esc(order.customer.postcode || '')}</p></div>
      <div><span class="muted">Payment</span><p>${
        order.customer.payment === 'card' ? 'Card' : 'Cash on delivery'
      }</p></div>
    </div>
  </div>

  <a class="btn btn-lg" href="/shop">Continue shopping</a>
</div>`;
  return layout({ title: 'Order confirmed', body, session, active: '' });
}

function staticPage({ slug, session, flash }) {
  const p = pages()[slug];
  if (!p) return notFoundPage({ session });
  const body = `
<nav class="crumbs"><a href="/">Home</a><span>/</span><span>${esc(p.title)}</span></nav>
<article class="prose">
  <h1>${esc(p.title)}</h1>
  ${p.html}
</article>`;
  return layout({ title: p.title, body, session, active: '', flash });
}

function adminLoginPage({ error, session }) {
  const body = `
<div class="admin-login">
  <h1>Admin sign in</h1>
  ${error ? `<p class="flash-error">${esc(error)}</p>` : ''}
  <form method="post" action="/admin/login">
    <label class="field"><span>Password</span><input type="password" name="password" required autofocus></label>
    <button class="btn btn-lg btn-block">Sign in</button>
  </form>
</div>`;
  return layout({ title: 'Admin', body, session, active: '' });
}

function settingsPanel() {
  const s = settings.get();
  const v = (x) => esc(x == null ? '' : x);
  const cols = s.footerCols || [];
  const trust = s.trust || [];
  const defs = pageDefaults();
  const ov = s.pages || {};

  const text = (name, label, val, ph) =>
    `<label class="field"><span>${label}</span><input name="${name}" value="${v(val)}"${
      ph ? ` placeholder="${esc(ph)}"` : ''
    }></label>`;
  const area = (name, label, val, rows) =>
    `<label class="field"><span>${label}</span><textarea name="${name}" rows="${rows || 2}">${v(
      val
    )}</textarea></label>`;
  const section = (title, open, inner) =>
    `<details class="admin-sub"${open ? ' open' : ''}>
    <summary>${title}</summary>
    <form class="admin-form" method="post" action="/admin/settings">
      ${inner}
      <button class="btn">Save</button>
    </form>
  </details>`;

  return `<section class="admin-panel" id="settings">
  <h2>Site settings</h2>
  <p class="muted small">Edit any part of the storefront &mdash; header, hero, home page, footer, pricing and the
  content pages. Each block below saves on its own and applies instantly across the site.</p>

  ${section('Brand &amp; identity', true, `
    <div class="row">
      ${text('storeName', 'Store name', s.storeName)}
      ${text('legalName', 'Legal / company name', s.legalName, 'Shop Weaves LLC')}
    </div>
    ${text('tagline', 'Tagline (meta description + hero fallback)', s.tagline)}
    <div class="row">
      ${text('logoUrl', 'Logo URL &mdash; header', s.logoUrl, '/img/logo.png')}
      ${text('logoDarkUrl', 'Logo URL &mdash; footer (dark bg)', s.logoDarkUrl, '/img/logo-dark.png')}
    </div>
    ${area('address', 'Office / business address', s.address, 2)}
    <div class="row row-3">
      ${text('supportEmail', 'Support email', s.supportEmail)}
      ${text('supportPhone', 'Contact number (Contact page + footer)', s.supportPhone, '+1 813 000 0000')}
      ${text('supportHours', 'Support hours / note', s.supportHours)}
    </div>`)}

  ${section('Announcement bar', false, `
    <div class="row row-3">
      ${text('announce1', 'Message 1', s.announce[0])}
      ${text('announce2', 'Message 2', s.announce[1])}
      ${text('announce3', 'Message 3', s.announce[2])}
    </div>`)}

  ${section('Hero (home page banner)', false, `
    <div class="row">
      ${text('heroEyebrow', 'Small label above heading', s.heroEyebrow)}
      ${text('heroHeading', 'Heading (blank = tagline)', s.heroHeading)}
    </div>
    ${text('heroLead', 'Sub-text under the heading', s.heroLead)}
    <div class="row row-3">
      ${text('heroCta', 'Button label', s.heroCta)}
      ${text('heroFlagTag', 'Corner badge (e.g. -25%)', s.heroFlagTag)}
      ${text('heroFlag', 'Corner badge text', s.heroFlag)}
    </div>`)}

  ${section('Home page sections', false, `
    <div class="row">
      ${text('catHeading', '&ldquo;Shop by category&rdquo; heading', s.catHeading)}
      ${text('catSub', '&ldquo;Shop by category&rdquo; sub-text', s.catSub)}
    </div>
    <div class="row row-3">
      ${text('memberHeading', 'Member band &mdash; heading', s.memberHeading)}
      ${text('memberText', 'Member band &mdash; text', s.memberText)}
      ${text('memberCta', 'Member band &mdash; button', s.memberCta)}
    </div>
    <div class="row">
      ${text('newsletterHeading', 'Newsletter &mdash; heading', s.newsletterHeading)}
      ${text('newsletterText', 'Newsletter &mdash; text', s.newsletterText)}
    </div>`)}

  ${section('Trust badges (below the hero)', false, `
    <div class="row">
      ${[0, 1, 2, 3]
        .map(
          (i) => `<div class="field">
        <span>Badge ${i + 1}</span>
        <input name="trustTitle${i}" value="${v(trust[i] && trust[i].title)}" placeholder="Title">
        <input name="trustText${i}" value="${v(trust[i] && trust[i].text)}" placeholder="Sub-text" style="margin-top:6px">
      </div>`
        )
        .join('')}
    </div>`)}

  ${section('Footer', false, `
    ${area('footerBlurb', 'Footer blurb (under the logo)', s.footerBlurb, 2)}
    <div class="row row-3">
      ${text('instagram', 'Instagram URL', s.social.instagram)}
      ${text('twitter', 'Twitter / X URL', s.social.twitter)}
      ${text('facebook', 'Facebook URL', s.social.facebook)}
    </div>
    <p class="muted small" style="margin-top:6px">Link columns &mdash; one link per line as <code>Label | /path</code></p>
    <div class="row row-3">
      ${[0, 1, 2]
        .map(
          (i) => `<div class="field">
        <span>Column ${i + 1} title</span>
        <input name="colTitle${i}" value="${v(cols[i] && cols[i].title)}">
        <textarea name="colLinks${i}" rows="5" placeholder="All products | /shop">${v(cols[i] && cols[i].links)}</textarea>
      </div>`
        )
        .join('')}
    </div>
    ${text('copyright', 'Copyright line (blank = &copy; year, company name)', s.copyright)}`)}

  ${section('Store &amp; pricing', false, `
    <div class="row row-3">
      ${text('currencySymbol', 'Currency symbol', s.currencySymbol, '$')}
      ${text('freeShippingFrom', 'Free shipping from (amount)', s.freeShippingFrom)}
      ${text('flatShipping', 'Flat shipping fee', s.flatShipping)}
    </div>
    <p class="muted small">Applies to product prices, cart totals, checkout and the shipping/FAQ pages.</p>`)}

  ${section('Content pages', false, `
    <p class="muted small">Leave a box blank to keep the built-in text. HTML is allowed &mdash; headings, lists, links.
    On the Contact page the message form and your support email / phone / hours / address are added automatically below whatever you write here.</p>
    ${settings.PAGE_KEYS.map((slug) => {
      const o = ov[slug] || {};
      return `<fieldset class="page-edit">
      <legend>${esc(defs[slug].title)} <span class="muted small">&middot; /p/${slug}</span></legend>
      ${text('pageTitle_' + slug, 'Page title', o.title, defs[slug].title)}
      <label class="field"><span>Page content (HTML)${
        slug === 'contact' ? ' &mdash; intro text above the form' : ''
      }</span><textarea name="pageHtml_${slug}" rows="7" placeholder="Leave blank for the default copy">${v(
        o.html
      )}</textarea></label>
    </fieldset>`;
    }).join('')}`)}
</section>`;
}

function adminPage({ products, orders, session, flash }) {
  const revenue = orders.reduce((s, o) => s + o.totals.total, 0);
  const units = orders.reduce((s, o) => s + o.items.reduce((n, i) => n + i.qty, 0), 0);
  const body = `
<div class="page-head">
  <h1>Dashboard</h1>
  <form method="post" action="/admin/logout"><button class="btn btn-ghost btn-sm">Sign out</button></form>
</div>

<div class="admin-stats">
  <div class="stat"><span class="stat-n">${products.length}</span><span class="stat-l">Products</span></div>
  <div class="stat"><span class="stat-n">${orders.length}</span><span class="stat-l">Orders</span></div>
  <div class="stat"><span class="stat-n">${units}</span><span class="stat-l">Units sold</span></div>
  <div class="stat"><span class="stat-n">${money(revenue)}</span><span class="stat-l">Revenue</span></div>
</div>

${settingsPanel()}

<section class="admin-panel">
  <h2>Add a product</h2>
  <form class="admin-form" method="post" action="/admin/products">
    <div class="row">
      <label class="field"><span>Name</span><input name="name" required></label>
      <label class="field"><span>Category</span>
        <select name="category" required>
          ${store
            .getCategories()
            .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`)
            .join('')}
          <option value="">+ New category&hellip;</option>
        </select>
      </label>
    </div>
    <label class="field" data-newcat><span>New category name <span class="muted small">(only if you picked &ldquo;New category&rdquo;)</span></span><input name="newCategory" placeholder="e.g. Toys &amp; Games"></label>
    <div class="row row-3">
      <label class="field"><span>Price (${esc(curSym())})</span><input name="price" type="number" min="0" step="0.01" required></label>
      <label class="field"><span>Compare-at (${esc(curSym())})</span><input name="oldPrice" type="number" min="0" step="0.01"></label>
      <label class="field"><span>Stock</span><input name="stock" type="number" min="0" value="10"></label>
    </div>
    <label class="field"><span>Short description</span><input name="short" required></label>
    <label class="field"><span>Full description</span><textarea name="description" rows="3"></textarea></label>
    <label class="field"><span>Image URLs (optional, one per line)</span><textarea name="images" rows="2" placeholder="/img/products/photo.jpg&#10;https://…  — or add photos later from Inventory"></textarea></label>
    <label class="check-inline"><input type="checkbox" name="featured" value="1"> Feature on the home page</label>
    <button class="btn btn-lg">Add product</button>
  </form>
</section>

<section class="admin-panel">
  <h2>Recent orders</h2>
  ${
    orders.length
      ? `<div class="table-scroll"><table class="admin-table">
    <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th></tr></thead>
    <tbody>${orders
      .map(
        (o) =>
          `<tr><td><code>${esc(o.id)}</code></td><td>${new Date(
            o.createdAt
          ).toLocaleDateString()}</td><td>${esc(o.customer.name)}<br><span class="muted small">${esc(
            o.customer.email
          )}</span></td><td>${o.items.reduce((n, i) => n + i.qty, 0)}</td><td>${money(
            o.totals.total
          )}</td></tr>`
      )
      .join('')}</tbody>
  </table></div>`
      : '<p class="muted">No orders yet.</p>'
  }
</section>

${(() => {
    const invRow = (p) => {
      const imgs = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
      const shots = imgs.length
        ? imgs
            .map(
              (src) =>
                `<span class="inv-shot"><img src="${esc(src)}" alt="" width="46" height="46" loading="lazy">
        <form method="post" action="/admin/products/${esc(p.id)}" class="inv-rm">
          <input type="hidden" name="removeImage" value="${esc(src)}">
          <button title="Remove this photo" aria-label="Remove photo">&times;</button>
        </form></span>`
            )
            .join('')
        : `<span class="inv-shot inv-shot-ph"><img src="/img/${esc(
            p.id
          )}.svg" alt="" width="46" height="46"><em>illustration</em></span>`;

      return `<div class="inv-row" id="inv-${esc(p.id)}">
      <div class="inv-meta"><strong>${esc(p.name)}</strong><span class="muted small"><code>${esc(
        p.id
      )}</code> &middot; ${imgs.length} photo${imgs.length === 1 ? '' : 's'}</span></div>
      <div class="inv-gallery">${shots}</div>
      <form class="inv-edit" method="post" action="/admin/products/${esc(
        p.id
      )}" enctype="multipart/form-data">
        <label class="inv-f inv-img"><span>Add photos (one or more)</span><input type="file" name="imageFiles" accept="image/*" multiple></label>
        <label class="inv-f inv-img"><span>&hellip; or image URLs (one per line)</span><textarea name="imageUrls" rows="2" placeholder="/img/products/photo.jpg&#10;https://…"></textarea></label>
        <label class="inv-f"><span>Price</span><input name="price" type="number" min="0" step="0.01" value="${p.price}"></label>
        <label class="inv-f"><span>Was</span><input name="oldPrice" type="number" min="0" step="0.01" value="${
          p.oldPrice || ''
        }"></label>
        <label class="inv-f"><span>Stock</span><input name="stock" type="number" min="0" value="${p.stock}"></label>
        <button class="btn btn-sm">Save</button>
      </form>
    </div>`;
    };

    const cats = Array.from(new Set(products.map((p) => p.category))).sort();
    const slug = (c) => 'invcat-' + c.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    return `<section class="admin-panel" id="inventory">
  <h2>Inventory &amp; images</h2>
  <p class="muted small">Grouped by category. Add a photo to any product by uploading a file or pasting an image URL &mdash;
  leave the URL blank to use the built-in illustration.</p>
  <nav class="inv-jump">${cats
    .map(
      (c) =>
        `<a href="#${slug(c)}">${esc(c)} <span class="inv-jump-n">${
          products.filter((p) => p.category === c).length
        }</span></a>`
    )
    .join('')}</nav>
  ${cats
    .map((c) => {
      const rows = products.filter((p) => p.category === c);
      return `<details class="inv-cat" id="${slug(c)}" open>
    <summary><span class="inv-cat-name">${esc(c)}</span><span class="inv-cat-count">${
        rows.length
      } item${rows.length === 1 ? '' : 's'}</span></summary>
    <div class="inv-list">${rows.map(invRow).join('')}</div>
  </details>`;
    })
    .join('')}
</section>`;
  })()}`;
  return layout({ title: 'Admin dashboard', body, session, active: '', flash });
}

function notFoundPage({ session }) {
  const body = `
<div class="empty-state">
  <div class="empty-ico">404</div>
  <h1>Page not found</h1>
  <p>The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.</p>
  <a class="btn btn-lg" href="/">Back to home</a>
</div>`;
  return layout({ title: 'Not found', body, session, active: '' });
}

// ---- static content pages -------------------------------------------------

/** Built-in copy for each content page — used when the admin hasn't set an override. */
function pageDefaults() {
  const s = settings.get();
  const nm = esc(s.storeName);
  const legal = esc(s.legalName || s.storeName);
  const officeBlock = s.address
    ? `<h2>Our office</h2>\n      <p>${esc(s.address)}</p>`
    : '';
  return {
    about: {
      title: 'About ' + s.storeName,
      html: `<p><strong>${legal}</strong> is an online marketplace bringing electronics, fashion,
      home appliances, groceries and everyday essentials together in one place &mdash; at prices you
      can trust.</p>
      <p>We work directly with verified sellers and authorised distributors so that every order is
      genuine, fairly priced and delivered fast.</p>
      <h2>What we stand for</h2>
      <ul>
        <li>Honest pricing and a clear 7-day return policy</li>
        <li>Fast delivery with order tracking</li>
        <li>Verified sellers and authentic products only</li>
        <li>Friendly support, every day of the week</li>
      </ul>
      ${officeBlock}`,
    },
    shipping: {
      title: 'Shipping & delivery',
      html: `<p>We deliver from regional warehouses to keep your wait short.</p>
      <h2>Delivery charges</h2>
      <ul>
        <li><strong>Standard (2&ndash;4 days):</strong> flat ${money(flatShip())}, free on orders over ${money(
        freeShip()
      )}</li>
        <li><strong>Express (next day, selected areas):</strong> calculated at checkout</li>
        <li><strong>Cash on delivery</strong> is available everywhere we ship</li>
      </ul>
      <h2>Order tracking</h2>
      <p>You'll receive an SMS and email with a tracking link the moment your parcel leaves the
      warehouse.</p>`,
    },
    returns: {
      title: 'Returns & refunds',
      html: `<p>Changed your mind or received the wrong item? You have <strong>7 days</strong> from
      delivery to request a return for a full refund or exchange.</p>
      <ol>
        <li>Open a return request from your account or by contacting support.</li>
        <li>Pack the item with all original accessories and packaging.</li>
        <li>Hand it to our pickup rider, or drop it at the nearest collection point.</li>
      </ol>
      <p>Refunds are issued to the original payment method within 5 business days of us receiving and
      inspecting the item. Cash-on-delivery orders are refunded by bank transfer or mobile wallet.</p>`,
    },
    faq: {
      title: 'Frequently asked questions',
      html: `<h2>Are the products genuine?</h2>
      <p>Yes. We source only from verified sellers and authorised distributors, and every order is
      checked before it ships.</p>
      <h2>Which payment methods can I use?</h2>
      <p>Cash on delivery, and Visa, Mastercard or American Express cards at checkout.</p>
      <h2>How much is delivery?</h2>
      <p>A flat ${money(flatShip())}, and free on orders over ${money(freeShip())}.</p>
      <h2>How do I track my order?</h2>
      <p>Use the tracking link in your confirmation SMS/email, or check the status from your account.</p>
      <h2>How do I contact support?</h2>
      <p>Use the <a href="/p/contact">contact form</a> and we'll reply within one business day.</p>`,
    },
    privacy: {
      title: 'Privacy policy',
      html: `<p>We collect only the information needed to process and deliver your orders &mdash; your
      name, contact details, delivery address and order history.</p>
      <p>Your details are never sold. We share delivery information with our courier partners solely
      to fulfil your order, and payment is handled over an encrypted connection.</p>
      <p>You can request a copy or deletion of your data at any time by contacting support.</p>`,
    },
    terms: {
      title: 'Terms of service',
      html: `<p>By placing an order with ${legal} you agree to these terms. Prices, offers and
      availability are shown at the time of ordering and may change without notice.</p>
      <p>We reserve the right to cancel an order in the event of a pricing error, stock shortage or
      suspected fraud, with a full refund of any amount paid.</p>
      <p>Our returns policy is set out on the <a href="/p/returns">Returns &amp; refunds</a> page and
      does not affect your statutory rights.</p>`,
    },
    contact: {
      title: 'Contact us',
      html: `<p>Questions about an order or a product? Send us a message and we'll get back to you
      within one business day.</p>`,
    },
  };
}

/** The message form + live contact details that are always appended to the Contact page. */
function contactFormBlock() {
  const s = settings.get();
  return `
      <form class="contact-form" method="post" action="/contact">
        <div class="row">
          <label class="field"><span>Name</span><input name="name" required></label>
          <label class="field"><span>Email</span><input type="email" name="email" required></label>
        </div>
        <label class="field"><span>Message</span><textarea name="message" rows="5" required></textarea></label>
        <button class="btn btn-lg">Send message</button>
      </form>
      <ul class="contact-details">
        ${
          s.supportPhone
            ? `<li><strong>Call us:</strong> <a href="${esc(telHref(s.supportPhone))}">${esc(
                s.supportPhone
              )}</a></li>`
            : ''
        }
        ${s.supportEmail ? `<li><strong>Email:</strong> <a href="mailto:${esc(s.supportEmail)}">${esc(s.supportEmail)}</a></li>` : ''}
        ${s.supportHours ? `<li><strong>Hours:</strong> ${esc(s.supportHours)}</li>` : ''}
        ${s.address ? `<li><strong>Address:</strong> ${esc(s.address)}</li>` : ''}
      </ul>`;
}

/** Resolved content pages: admin overrides where set, built-in copy otherwise. */
function pages() {
  const s = settings.get();
  const defs = pageDefaults();
  const ov = s.pages || {};
  const out = {};
  settings.PAGE_KEYS.forEach((slug) => {
    const o = ov[slug] || {};
    let html = (o.html && o.html.trim()) || defs[slug].html;
    // the Contact page's intro text is editable; the form + live details are always appended
    if (slug === 'contact') html += contactFormBlock();
    out[slug] = {
      title: (o.title && o.title.trim()) || defs[slug].title,
      html,
    };
  });
  return out;
}

const PAGE_SLUGS = settings.PAGE_KEYS.slice();

module.exports = {
  esc,
  money,
  placeholderSvg,
  homePage,
  shopPage,
  productPage,
  cartPage,
  checkoutPage,
  confirmationPage,
  staticPage,
  adminLoginPage,
  adminPage,
  notFoundPage,
  PAGE_SLUGS,
};
