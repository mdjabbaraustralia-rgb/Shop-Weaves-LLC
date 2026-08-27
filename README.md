# Shop Weaves

A complete e-commerce storefront built with **plain Node.js** — no Express, no
database, **zero npm dependencies**. It uses only the built-in `http`, `fs`,
`path`, `crypto` and `url` modules.

## Features

- Home page with hero banner, square category tiles and per-category product rows
- Shop page with **category filter**, **search** and **sort** (price / rating)
- Product detail pages with an image gallery, quantity picker, "Add to cart" and "Buy now"
- Per-product **customer reviews**, with a verified-buyer gate (only shoppers who
  bought the item and left their details at checkout can post)
- Cookie-based **shopping cart** (add / update quantity / remove)
- **Checkout** with server-side validation, Cash-on-Delivery or card
- Order confirmation page; orders saved to `data/orders.json`
- **Admin dashboard** at `/admin`:
  - store stats, add products (category dropdown + "new category")
  - **Site settings** — edit the whole storefront live, no redeploy: brand &
    identity (name, legal/company name, tagline, logos, address, support
    email/phone/hours), announcement bar, hero banner, home-page section copy,
    trust badges, footer (blurb, columns, social, copyright), store & pricing
    (currency symbol, free-shipping threshold, flat fee), and the content pages
    (About, Shipping, Returns, FAQ, Privacy, Terms — title + HTML each)
  - **Inventory & images** grouped by category, with multi-image upload per product
- Auto-generated gradient SVG illustrations for any product without a photo
- Responsive layout (2 products per row on phones), works with JavaScript disabled
- Light animations that respect `prefers-reduced-motion`

## Requirements

- Node.js 16 or newer (`node --version`). Get it from <https://nodejs.org>.

## Run it

```bash
cd ShopWaves
node server.js
```

Then open <http://localhost:3000>. `npm start` does the same thing.

### Configuration (environment variables)

| Variable         | Default              | Purpose                |
| ---------------- | -------------------- | ---------------------- |
| `PORT`           | `3000`               | Port to listen on      |
| `ADMIN_PASSWORD` | `Shopweaves01620208` | Password for `/admin`  |

```bash
PORT=8080 ADMIN_PASSWORD=secret node server.js
```

## Project layout

```
ShopWaves/
├── server.js            HTTP server + router
├── lib/
│   ├── config.js        base store name, currency, shipping, nav/footer defaults
│   ├── settings.js      runtime-editable site settings (data/settings.json)
│   ├── store.js         products & orders (JSON files)
│   ├── sessions.js      cookie sessions + cart helpers
│   ├── multipart.js     multipart/form-data parser for image uploads
│   └── views.js         all HTML rendering (template literals)
├── data/
│   ├── products.json    catalogue (edited by the admin panel)
│   ├── orders.json      orders placed at runtime  (git-ignored)
│   └── settings.json    header/footer overrides   (git-ignored, created on first save)
└── public/
    ├── css/style.css
    ├── js/app.js         small progressive enhancements
    └── img/              logo, hero banner, uploaded product photos
```

## Notes

- Sessions and carts live in memory and reset when the server restarts.
- Prices are shown with a `$` symbol.
- Storefront text, branding, pricing rules and content pages are edited from
  **Admin → Site settings** and persist to `data/settings.json`; delete that file
  to fall back to the built-in defaults in `lib/settings.js` / `lib/config.js`.
- The UI loads Inter + Space Grotesk from Google Fonts and falls back to system
  fonts when offline.
