/* Small progressive enhancements for Shop Wave's. The site works fully
   without JavaScript; this just smooths a few interactions. */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  // Auto-submit the cart quantity field when it changes.
  document.querySelectorAll('.qty-form input[name="qty"]').forEach(function (input) {
    input.addEventListener('change', function () {
      var v = parseInt(input.value, 10);
      if (isNaN(v) || v < 0) v = 0;
      input.value = v;
      if (input.form.requestSubmit) input.form.requestSubmit();
      else input.form.submit();
    });
  });

  // Dismiss the flash banner on click / after a few seconds.
  var flash = document.querySelector('.flash');
  if (flash) {
    flash.style.cursor = 'pointer';
    flash.title = 'Dismiss';
    flash.addEventListener('click', function () { flash.remove(); });
    setTimeout(function () { if (flash) flash.remove(); }, 4000);
  }

  // Reflect grid "Add to cart" clicks without a full page reload.
  document.querySelectorAll('form[action="/cart/add"]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      // Let "Buy now" and the product-detail form submit normally.
      if (form.querySelector('[formaction]') || form.closest('.pdp-buy')) return;
      e.preventDefault();
      var body = new URLSearchParams(new FormData(form)).toString();
      fetch('/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body,
      })
        .then(function () {
          // bump the cart badge (create it the first time an item is added)
          var cartLink = document.querySelector('.cart-link');
          if (cartLink) {
            var badge = cartLink.querySelector('.cart-badge');
            if (!badge) {
              badge = document.createElement('span');
              badge.className = 'cart-badge';
              badge.textContent = '0';
              cartLink.appendChild(badge);
            }
            var n = (parseInt(badge.textContent, 10) || 0) + 1;
            badge.textContent = n > 99 ? '99+' : String(n);
          }
          var btn = form.querySelector('button');
          if (btn) {
            var label = btn.textContent;
            btn.textContent = 'Added ✓';
            btn.disabled = true;
            setTimeout(function () { btn.textContent = label; btn.disabled = false; }, 1200);
          }
        })
        .catch(function () { form.submit(); });
    });
  });

  // Give the sticky header a shadow once the page is scrolled, so it reads as
  // a separate layer above the content.
  var siteHeader = document.querySelector('.site-header');
  if (siteHeader) {
    var shadowTick = false;
    var syncHeaderShadow = function () {
      siteHeader.classList.toggle('scrolled', (window.pageYOffset || 0) > 4);
      shadowTick = false;
    };
    syncHeaderShadow();
    window.addEventListener(
      'scroll',
      function () {
        if (shadowTick) return;
        shadowTick = true;
        window.requestAnimationFrame(syncHeaderShadow);
      },
      { passive: true }
    );
  }

  // Product-detail gallery: swipe, or the prev/next arrow buttons, step
  // through the images (wrapping at the ends). Thumbnail clicks keep working
  // on their own since they're plain <label for="..."> radio toggles.
  document.querySelectorAll('.pdp-media').forEach(function (media) {
    var radios = Array.prototype.slice.call(media.querySelectorAll('.pgal-r'));
    if (radios.length < 2) return;

    var step = function (dir) {
      var current = radios.findIndex(function (r) { return r.checked; });
      if (current === -1) current = 0;
      var next = current + dir;
      if (next < 0) next = radios.length - 1;
      if (next >= radios.length) next = 0;
      radios[next].checked = true;
    };

    var prevBtn = media.querySelector('.pgal-prev');
    var nextBtn = media.querySelector('.pgal-next');
    if (prevBtn) prevBtn.addEventListener('click', function () { step(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { step(1); });

    var startX = 0;
    var startY = 0;
    var tracking = false;
    media.addEventListener(
      'touchstart',
      function (e) {
        if (e.touches.length !== 1) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        tracking = true;
      },
      { passive: true }
    );
    media.addEventListener(
      'touchend',
      function (e) {
        if (!tracking) return;
        tracking = false;
        var t = e.changedTouches[0];
        var dx = t.clientX - startX;
        var dy = t.clientY - startY;
        // require a clearly horizontal, deliberate swipe (not a scroll/tap)
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        step(dx < 0 ? 1 : -1);
      },
      { passive: true }
    );
  });

  // Search panel: focus the field when it opens, close on Esc or outside click.
  var searchToggle = document.getElementById('search-toggle');
  var searchField = document.querySelector('.search-drop input[name="search"]');
  if (searchToggle && searchField) {
    searchToggle.addEventListener('change', function () {
      if (searchToggle.checked) setTimeout(function () { searchField.focus(); }, 60);
    });
    searchField.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { searchToggle.checked = false; searchField.blur(); }
    });
    document.addEventListener('click', function (e) {
      if (searchToggle.checked && !e.target.closest('.site-header')) searchToggle.checked = false;
    });
  }

  // Reveal elements as they scroll into view (progressive; no JS = all visible).
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    var groups = [
      ['.trust', false],
      ['.section-head', false],
      ['.cat-grid .cat-tile', true],
      ['.grid .card', true],
      ['.cta-band', false],
      ['.promo', false],
      ['.reviews-layout', false],
      ['.pdp', false],
      ['.confirm-card', false],
      ['.prose', false],
      ['.admin-panel', false],
    ];
    groups.forEach(function (g) {
      document.querySelectorAll(g[0]).forEach(function (el, i) {
        el.classList.add('reveal');
        if (g[1]) el.style.transitionDelay = Math.min(i, 8) * 45 + 'ms';
        io.observe(el);
      });
    });
    // safety: never leave anything hidden
    setTimeout(function () {
      document.querySelectorAll('.reveal:not(.in)').forEach(function (el) { el.classList.add('in'); });
    }, 2500);
  }
})();
