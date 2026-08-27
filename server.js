'use strict';

/**
 * Shop Wave's - a small e-commerce website in plain Node.js.
 * No frameworks, no npm dependencies. Run with:  node server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const store = require('./lib/store');
const sessions = require('./lib/sessions');
const views = require('./lib/views');
const cfg = require('./lib/config');
const settings = require('./lib/settings');
const { parseMultipart } = require('./lib/multipart');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Shopweaves01620208';
const FREE_SHIPPING_FROM = cfg.FREE_SHIPPING_FROM;
const FLAT_SHIPPING = cfg.FLAT_SHIPPING;
const PUBLIC_DIR = path.join(__dirname, 'public');

// ---- helpers ------------------------------------------------------------

function send(res, status, body, type = 'text/html; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) req.destroy(); // 1MB guard
    });
    req.on('end', () => resolve(parseForm(data)));
    req.on('error', () => resolve({}));
    req.on('close', () => resolve({}));
  });
}

function parseForm(str) {
  const out = {};
  new URLSearchParams(str).forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/** Collect the raw request body as a Buffer (for multipart uploads). */
function readRawBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) return req.destroy();
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', () => resolve(Buffer.alloc(0)));
    req.on('close', () => resolve(Buffer.concat(chunks)));
  });
}

const IMG_EXT = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
  'image/webp': 'webp', 'image/gif': 'gif',
};

/** Save uploaded image parts to public/img/products/ and return their web paths. */
function saveUploadedImages(id, fileParts) {
  const paths = [];
  const list = [].concat(fileParts || []).filter(Boolean);
  if (!list.length) return paths;
  const dir = path.join(PUBLIC_DIR, 'img', 'products');
  fs.mkdirSync(dir, { recursive: true });
  list.forEach((f, i) => {
    if (!f.data || !f.data.length || !IMG_EXT[f.type]) return;
    const rel = '/img/products/' + id + '-' + Date.now() + '-' + i + '.' + IMG_EXT[f.type];
    fs.writeFileSync(path.join(PUBLIC_DIR, rel.slice(1)), f.data);
    paths.push(rel);
  });
  return paths;
}

/**
 * Parse an admin product edit (urlencoded or multipart).
 * Returns { patch, addImages: [urls], removeImage: url|null } — the route applies them.
 */
async function readProductForm(req, id) {
  const ct = req.headers['content-type'] || '';
  let fields, uploaded = [];

  if (ct.lastIndexOf('multipart/form-data', 0) === 0) {
    const bm = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(ct);
    const boundary = bm ? (bm[1] || bm[2]).trim() : '';
    const parsed = parseMultipart(await readRawBody(req), boundary);
    fields = parsed.files ? parsed.fields : {};
    uploaded = saveUploadedImages(id, parsed.files && (parsed.files.imageFiles || parsed.files.imageFile));
  } else {
    fields = await readBody(req);
  }

  const urlText = [].concat(fields.imageUrls || fields.image || []).join('\n');
  return {
    patch: { price: fields.price, oldPrice: fields.oldPrice, stock: fields.stock },
    addImages: uploaded.concat(String(urlText).split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)),
    removeImage: (fields.removeImage || '').trim() || null,
  };
}

/** Build a rich view of the session cart plus order totals. */
function buildCart(session) {
  const items = [];
  for (const [id, qty] of Object.entries(session.cart)) {
    const p = store.getProduct(id);
    if (!p) {
      delete session.cart[id];
      continue;
    }
    const clamped = Math.min(qty, Math.max(p.stock, 0));
    if (clamped !== qty) session.cart[id] = clamped;
    if (clamped <= 0) {
      delete session.cart[id];
      continue;
    }
    items.push({
      id: p.id,
      name: p.name,
      price: p.price,
      qty: clamped,
      stock: p.stock,
      line: p.price * clamped,
    });
  }
  const st = settings.get();
  const freeFrom = Number(st.freeShippingFrom);
  const flat = Number(st.flatShipping);
  const threshold = isFinite(freeFrom) ? freeFrom : FREE_SHIPPING_FROM;
  const flatFee = isFinite(flat) ? flat : FLAT_SHIPPING;
  const subtotal = items.reduce((s, i) => s + i.line, 0);
  const shipping = subtotal === 0 || subtotal >= threshold ? 0 : flatFee;
  return { items, totals: { subtotal, shipping, total: subtotal + shipping } };
}

const STATIC_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
};

function serveStatic(res, pathname) {
  const rel = pathname.replace(/^\/+/, '');
  const filePath = path.join(PUBLIC_DIR, rel);
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden', 'text/plain');
  fs.readFile(filePath, (err, buf) => {
    if (err) return send(res, 404, 'Not found', 'text/plain');
    const ext = path.extname(filePath);
    // CSS/JS: always revalidate so edits show up on a normal refresh
    const cache = ext === '.css' || ext === '.js' ? 'no-cache, must-revalidate' : 'public, max-age=3600';
    res.writeHead(200, {
      'Content-Type': STATIC_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': cache,
    });
    res.end(buf);
  });
}

function validateCheckout(form) {
  const errors = {};
  if (!form.name || form.name.trim().length < 2) errors.name = 'Please enter your name.';
  if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email.';
  if (!form.phone || form.phone.replace(/\D/g, '').length < 6) errors.phone = 'Enter a valid phone number.';
  if (!form.address || form.address.trim().length < 5) errors.address = 'Enter your address.';
  if (!form.city || form.city.trim().length < 2) errors.city = 'Enter your city.';
  return errors;
}

// ---- router -----------------------------------------------------------------

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;
  const method = req.method.toUpperCase();
  const session = sessions.attach(req, res);
  const flash = url.searchParams.get('flash') || '';

  // static assets
  if (pathname.startsWith('/css/') || pathname.startsWith('/js/')) {
    return serveStatic(res, pathname);
  }

  // generated placeholder images
  if (pathname.startsWith('/img/')) {
    if (pathname === '/img/favicon.svg') {
      return send(
        res,
        200,
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#E67E22"/><path d="M13 18h7l5 22h20l5-15H26" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="28" cy="49" r="3.6" fill="#fff"/><circle cx="42" cy="49" r="3.6" fill="#fff"/></svg>`,
        'image/svg+xml'
      );
    }
    const m = pathname.match(/^\/img\/(p\d+)\.svg$/);
    if (m) {
      const p = store.getProduct(m[1]);
      if (p) return send(res, 200, views.placeholderSvg(p), 'image/svg+xml');
    }
    // real image files in public/img/ (banner, uploads, ...); 404 if missing
    return serveStatic(res, pathname);
  }

  // ---- pages ----
  if (method === 'GET' && pathname === '/') {
    return send(
      res,
      200,
      views.homePage({
        featured: store.getFeatured(6),
        categories: store.getCategories(),
        session,
      })
    );
  }

  if (method === 'GET' && pathname === '/shop') {
    const filters = {
      category: url.searchParams.get('category') || '',
      search: url.searchParams.get('search') || '',
      sort: url.searchParams.get('sort') || '',
    };
    const products = store.getProducts(filters);
    return send(res, 200, views.shopPage({ products, categories: store.getCategories(), filters, session }));
  }

  if (method === 'GET' && pathname.startsWith('/product/')) {
    const id = pathname.split('/')[2];
    const product = store.getProduct(id);
    if (!product) return send(res, 404, views.notFoundPage({ session }));
    const related = store
      .getProducts({ category: product.category })
      .filter((p) => p.id !== product.id)
      .slice(0, 3);
    return send(res, 200, views.productPage({ product, related, session, flash }));
  }

  if (method === 'POST' && /^\/product\/p\d+\/review$/.test(pathname)) {
    const id = pathname.split('/')[2];
    const form = await readBody(req);
    const purchased = session.purchased && session.purchased[id];
    if (!store.getProduct(id) || !purchased || !session.buyer) {
      return redirect(
        res,
        '/product/' + id + '?flash=' + encodeURIComponent('Only verified buyers can review this product.') + '#reviews'
      );
    }
    // reviewer identity comes from their order, not free text
    const saved = store.addReview(id, { author: session.buyer.name, rating: form.rating, body: form.body });
    return redirect(
      res,
      '/product/' + id + (saved ? '?flash=' + encodeURIComponent('Thanks — your review has been posted.') : '') + '#reviews'
    );
  }

  if (method === 'POST' && pathname === '/cart/add') {
    const form = await readBody(req);
    const product = store.getProduct(form.id);
    if (product) {
      const qty = Math.max(1, parseInt(form.qty, 10) || 1);
      sessions.addToCart(session, product.id, qty);
    }
    return redirect(res, url.searchParams.get('buyNow') ? '/checkout' : '/cart?flash=Added+to+cart');
  }

  if (method === 'POST' && pathname === '/cart/update') {
    const form = await readBody(req);
    if (form.id) sessions.setCartQty(session, form.id, parseInt(form.qty, 10) || 0);
    return redirect(res, '/cart');
  }

  if (method === 'GET' && pathname === '/cart') {
    const { items, totals } = buildCart(session);
    return send(res, 200, views.cartPage({ items, totals, session, flash }));
  }

  if (method === 'GET' && pathname === '/checkout') {
    const { items, totals } = buildCart(session);
    if (!items.length) return redirect(res, '/cart');
    return send(res, 200, views.checkoutPage({ items, totals, session }));
  }

  if (method === 'POST' && pathname === '/checkout') {
    const form = await readBody(req);
    const { items, totals } = buildCart(session);
    if (!items.length) return redirect(res, '/cart');

    const errors = validateCheckout(form);
    if (Object.keys(errors).length) {
      return send(res, 200, views.checkoutPage({ items, totals, session, errors, values: form }));
    }

    const order = store.createOrder({
      customer: {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        postcode: (form.postcode || '').trim(),
        payment: form.payment === 'card' ? 'card' : 'cod',
      },
      items: items.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
      totals,
    });
    sessions.clearCart(session);
    // this visitor is now a verified buyer of these items — unlock reviews
    session.buyer = { name: order.customer.name, email: order.customer.email };
    if (!session.purchased) session.purchased = {};
    order.items.forEach((i) => {
      session.purchased[i.id] = true;
    });
    return redirect(res, '/order/' + order.id);
  }

  if (method === 'GET' && pathname.startsWith('/order/')) {
    const order = store.getOrder(pathname.split('/')[2]);
    if (!order) return send(res, 404, views.notFoundPage({ session }));
    return send(res, 200, views.confirmationPage({ order, session }));
  }

  // ---- static content pages ----
  if (method === 'GET' && pathname.startsWith('/p/')) {
    const slug = pathname.split('/')[2];
    if (!views.PAGE_SLUGS.includes(slug)) return send(res, 404, views.notFoundPage({ session }));
    return send(res, 200, views.staticPage({ slug, session, flash }));
  }

  if (method === 'POST' && pathname === '/newsletter') {
    await readBody(req);
    return redirect(res, '/?flash=' + encodeURIComponent("You're subscribed — welcome aboard!"));
  }

  if (method === 'POST' && pathname === '/contact') {
    await readBody(req);
    return redirect(res, '/p/contact?flash=' + encodeURIComponent('Thanks — we\'ll reply within one business day.'));
  }

  // ---- admin ----
  if (pathname === '/admin' && method === 'GET') {
    if (!session.isAdmin) return send(res, 200, views.adminLoginPage({ session }));
    return send(
      res,
      200,
      views.adminPage({ products: store.getProducts(), orders: store.getOrders(), session, flash })
    );
  }

  if (pathname === '/admin/login' && method === 'POST') {
    const form = await readBody(req);
    if (form.password === ADMIN_PASSWORD) {
      session.isAdmin = true;
      return redirect(res, '/admin');
    }
    return send(res, 401, views.adminLoginPage({ session, error: 'Wrong password. Try again.' }));
  }

  if (pathname === '/admin/logout' && method === 'POST') {
    session.isAdmin = false;
    return redirect(res, '/admin');
  }

  if (pathname === '/admin/products' && method === 'POST') {
    if (!session.isAdmin) return redirect(res, '/admin');
    const form = await readBody(req);
    const category = (form.newCategory || '').trim() || form.category || 'Misc';
    store.addProduct({ ...form, category, featured: form.featured === '1' });
    return redirect(res, '/admin?flash=Product+added');
  }

  if (method === 'POST' && /^\/admin\/products\/p\d+$/.test(pathname)) {
    if (!session.isAdmin) return redirect(res, '/admin');
    const id = pathname.split('/')[3];
    const { patch, addImages, removeImage } = await readProductForm(req, id);
    store.updateProduct(id, patch);
    if (removeImage) store.removeProductImage(id, removeImage);
    if (addImages.length) store.addProductImages(id, addImages);
    return redirect(res, '/admin?flash=' + encodeURIComponent(id + ' updated') + '#inv-' + id);
  }

  if (pathname === '/admin/settings' && method === 'POST') {
    if (!session.isAdmin) return redirect(res, '/admin');
    settings.save(await readBody(req));
    return redirect(res, '/admin?flash=' + encodeURIComponent('Site settings saved') + '#settings');
  }

  // fallback
  return send(res, 404, views.notFoundPage({ session }));
}

// ---- boot -----------------------------------------------------------------

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) send(res, 500, 'Something went wrong.', 'text/plain');
  });
});

server.listen(PORT, () => {
  console.log(`\n  ${cfg.STORE_NAME} is running at  http://localhost:${PORT}`);
  console.log(`  Admin panel:               http://localhost:${PORT}/admin  (password: ${ADMIN_PASSWORD})\n`);
});
