'use strict';

/**
 * Shared configuration for Shop Wave's - imported by both the server and
 * the view layer so money, shipping rules and navigation stay in sync.
 */

module.exports = {
  STORE_NAME: 'Shop Weaves',
  TAGLINE: 'Quality you trust, prices you love.',

  // Money
  CURRENCY_SYMBOL: '$',
  CURRENCY_CODE: 'USD',

  // Shipping
  FREE_SHIPPING_FROM: 75,
  FLAT_SHIPPING: 6.99,

  // Primary navigation (category links are appended from the catalogue)
  NAV: [
    { href: '/', label: 'Home', key: 'home' },
    { href: '/shop', label: 'Shop', key: 'shop' },
  ],

  // Footer link columns
  FOOTER: [
    {
      title: 'Shop',
      links: [
        { href: '/shop', label: 'All products' },
        { href: '/shop?category=Electronics', label: 'Electronics' },
        { href: '/shop?category=Fashion', label: 'Fashion' },
        { href: '/shop?category=' + encodeURIComponent('Home Appliances'), label: 'Home Appliances' },
        { href: '/shop?category=' + encodeURIComponent('Health & Beauty'), label: 'Health & Beauty' },
      ],
    },
    {
      title: 'Help',
      links: [
        { href: '/p/shipping', label: 'Shipping & delivery' },
        { href: '/p/returns', label: 'Returns & refunds' },
        { href: '/p/faq', label: 'FAQ' },
        { href: '/p/contact', label: 'Contact us' },
      ],
    },
    {
      title: 'Company',
      links: [
        { href: '/p/about', label: 'About Shop Weaves' },
        { href: '/p/privacy', label: 'Privacy policy' },
        { href: '/p/terms', label: 'Terms of service' },
      ],
    },
  ],

  SOCIAL: [
    { href: '#', label: 'Instagram', glyph: 'IG' },
    { href: '#', label: 'Facebook', glyph: 'f' },
  ],
};
