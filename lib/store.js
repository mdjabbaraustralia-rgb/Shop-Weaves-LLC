'use strict';

/**
 * Tiny JSON-file backed data store for Shop Wave's.
 * Products are seeded from data/products.json; orders are appended to
 * data/orders.json at runtime. No external database required.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

// ---- Products -------------------------------------------------------------

let products = readJson(PRODUCTS_FILE, []);

// migrate: single `image` string -> `images` array (a product gallery)
(() => {
  let changed = false;
  products.forEach((p) => {
    if (!Array.isArray(p.images)) {
      p.images = p.image ? [p.image] : [];
      changed = true;
    }
    if ('image' in p) {
      delete p.image;
      changed = true;
    }
  });
  if (changed) writeJson(PRODUCTS_FILE, products);
})();

function getProducts({ category, search, sort } = {}) {
  let list = products.slice();

  if (category && category !== 'All') {
    list = list.filter((p) => p.category === category);
  }

  if (search) {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.short.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }

  switch (sort) {
    case 'price-asc':
      list.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      list.sort((a, b) => b.price - a.price);
      break;
    case 'rating':
      list.sort((a, b) => b.rating - a.rating);
      break;
    default:
      // keep seed order
      break;
  }

  return list;
}

function getProduct(id) {
  return products.find((p) => p.id === id) || null;
}

function getCategories() {
  return Array.from(new Set(products.map((p) => p.category))).sort();
}

function getFeatured(limit = 6) {
  return products.filter((p) => p.featured).slice(0, limit);
}

function addProduct(data) {
  const id = 'p' + (products.reduce((max, p) => Math.max(max, parseInt(p.id.slice(1), 10) || 0), 0) + 1);
  const product = {
    id,
    name: String(data.name || 'Untitled product').trim(),
    category: String(data.category || 'Misc').trim(),
    price: Math.max(0, Math.round(Number(data.price) || 0)),
    oldPrice: data.oldPrice ? Math.round(Number(data.oldPrice)) : null,
    stock: Math.max(0, Math.round(Number(data.stock) || 0)),
    rating: 4.5,
    featured: Boolean(data.featured),
    colors: ['#6C63FF', '#22223B'],
    short: String(data.short || '').trim(),
    description: String(data.description || data.short || '').trim(),
    images: normImages(data.images || data.image),
    reviews: [],
  };
  products.push(product);
  writeJson(PRODUCTS_FILE, products);
  return product;
}

/** Accept a string, a newline/comma list, or an array -> clean array of urls. */
function normImages(input) {
  let arr = [];
  if (Array.isArray(input)) arr = input;
  else if (typeof input === 'string') arr = input.split(/[\n,]+/);
  return arr.map((s) => String(s).trim()).filter(Boolean).slice(0, 12);
}

/** Append image URLs/paths to a product's gallery (deduped). */
function addProductImages(id, urls) {
  const p = getProduct(id);
  if (!p) return null;
  if (!Array.isArray(p.images)) p.images = [];
  normImages(urls).forEach((u) => {
    if (!p.images.includes(u)) p.images.push(u);
  });
  p.images = p.images.slice(0, 12);
  writeJson(PRODUCTS_FILE, products);
  return p;
}

/** Remove one image from a product's gallery by its URL/path. */
function removeProductImage(id, url) {
  const p = getProduct(id);
  if (!p || !Array.isArray(p.images)) return null;
  p.images = p.images.filter((u) => u !== url);
  writeJson(PRODUCTS_FILE, products);
  return p;
}

/** Update editable fields of an existing product (admin). */
function updateProduct(id, patch) {
  const p = getProduct(id);
  if (!p) return null;
  const set = (key, val) => {
    if (val !== undefined && val !== null && String(val).trim() !== '') p[key] = val;
  };
  if (patch.name !== undefined) set('name', String(patch.name).trim());
  if (patch.category !== undefined) set('category', String(patch.category).trim());
  if (patch.short !== undefined) set('short', String(patch.short).trim());
  if (patch.description !== undefined) set('description', String(patch.description).trim());
  if (patch.price !== undefined && patch.price !== '') p.price = Math.max(0, Math.round(Number(patch.price) || 0));
  if (patch.stock !== undefined && patch.stock !== '') p.stock = Math.max(0, Math.round(Number(patch.stock) || 0));
  if (patch.oldPrice !== undefined) {
    p.oldPrice = patch.oldPrice === '' || patch.oldPrice == null ? null : Math.round(Number(patch.oldPrice)) || null;
  }
  if (patch.featured !== undefined) p.featured = Boolean(patch.featured);
  if (patch.images !== undefined) p.images = normImages(patch.images);
  writeJson(PRODUCTS_FILE, products);
  return p;
}

function addReview(productId, data) {
  const p = getProduct(productId);
  if (!p) return null;
  if (!Array.isArray(p.reviews)) p.reviews = [];
  const review = {
    author: String(data.author || 'Anonymous').trim().slice(0, 60) || 'Anonymous',
    rating: Math.min(5, Math.max(1, Math.round(Number(data.rating) || 5))),
    date: new Date().toISOString().slice(0, 10),
    body: String(data.body || '').trim().slice(0, 800),
  };
  if (!review.body) return null;
  p.reviews.unshift(review);
  writeJson(PRODUCTS_FILE, products);
  return review;
}

function decrementStock(items) {
  let changed = false;
  items.forEach(({ id, qty }) => {
    const p = getProduct(id);
    if (p) {
      p.stock = Math.max(0, p.stock - qty);
      changed = true;
    }
  });
  if (changed) writeJson(PRODUCTS_FILE, products);
}

// ---- Orders -------------------------------------------------------------

let orders = readJson(ORDERS_FILE, []);

function createOrder(order) {
  const seq = orders.length + 1;
  const id = 'SW-' + String(Date.now()).slice(-6) + '-' + String(seq).padStart(3, '0');
  const record = { id, createdAt: new Date().toISOString(), status: 'Confirmed', ...order };
  orders.push(record);
  writeJson(ORDERS_FILE, orders);
  decrementStock(order.items.map((i) => ({ id: i.id, qty: i.qty })));
  return record;
}

function getOrder(id) {
  return orders.find((o) => o.id === id) || null;
}

function getOrders() {
  return orders.slice().reverse();
}

module.exports = {
  getProducts,
  getProduct,
  getCategories,
  getFeatured,
  addProduct,
  updateProduct,
  addProductImages,
  removeProductImage,
  addReview,
  createOrder,
  getOrder,
  getOrders,
};
