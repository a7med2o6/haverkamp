(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var style = document.createElement('style');
  style.textContent = [
    '.sa {',
    '  opacity: 0;',
    '  transform: translateY(36px);',
    '  transition: opacity 0.65s cubic-bezier(0.16,1,0.3,1),',
    '              transform 0.65s cubic-bezier(0.16,1,0.3,1);',
    '}',
    '.sa.in { opacity: 1; transform: none; }',

    /* section headings tag */
    '.sa-tag {',
    '  opacity: 0; transform: translateX(20px);',
    '  transition: opacity 0.5s cubic-bezier(0.16,1,0.3,1),',
    '              transform 0.5s cubic-bezier(0.16,1,0.3,1);',
    '}',
    '.sa-tag.in { opacity: 1; transform: none; }',

    /* section headings h2 */
    '.sa-h2 {',
    '  opacity: 0; transform: translateY(22px);',
    '  transition: opacity 0.6s cubic-bezier(0.16,1,0.3,1) 0.09s,',
    '              transform 0.6s cubic-bezier(0.16,1,0.3,1) 0.09s;',
    '}',
    '.sa-h2.in { opacity: 1; transform: none; }',

    /* section desc */
    '.sa-desc {',
    '  opacity: 0; transform: translateY(16px);',
    '  transition: opacity 0.6s cubic-bezier(0.16,1,0.3,1) 0.17s,',
    '              transform 0.6s cubic-bezier(0.16,1,0.3,1) 0.17s;',
    '}',
    '.sa-desc.in { opacity: 1; transform: none; }',
  ].join('\n');
  document.head.appendChild(style);

  /* ── Observer ── */
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.07, rootMargin: '0px 0px -48px 0px' });

  function watch(el) { if (el) obs.observe(el); }

  /* ── Helper: animate section heading children separately ── */
  function animHead(head) {
    if (!head) return;
    var tag  = head.querySelector('.tag');
    var h2   = head.querySelector('h2');
    var desc = head.querySelector('.desc');
    if (tag)  { tag.classList.add('sa-tag');   watch(tag); }
    if (h2)   { h2.classList.add('sa-h2');     watch(h2); }
    if (desc) { desc.classList.add('sa-desc'); watch(desc); }
  }

  /* ── Helper: stagger direct children of a container ── */
  function stagger(containerSel, gapMs) {
    var container = document.querySelector(containerSel);
    if (!container) return;
    Array.from(container.children).forEach(function (el, i) {
      el.classList.add('sa');
      el.style.transitionDelay = (i * gapMs) + 'ms';
      watch(el);
    });
  }

  /* ── Helper: single fade-up element ── */
  function fadeUp(sel, delayMs) {
    var el = document.querySelector(sel);
    if (!el) return;
    el.classList.add('sa');
    if (delayMs) el.style.transitionDelay = delayMs + 'ms';
    watch(el);
  }

  /* ══════════════════════════════════════════════
     index.html
  ══════════════════════════════════════════════ */
  document.querySelectorAll('.section-head').forEach(animHead);
  stagger('.services-grid',  80);
  stagger('.gallery-grid',   70);
  stagger('.why-grid',       70);
  stagger('.testi-grid',     60);
  stagger('.faq-list',       55);
  fadeUp('.contact-info',     0);
  fadeUp('.contact-form',   100);
  fadeUp('.hero-strip');

  /* ══════════════════════════════════════════════
     service pages (protication / tint / paint / polish / wash)
  ══════════════════════════════════════════════ */
  document.querySelectorAll('.svc-sec-head').forEach(function (head) {
    var tag  = head.querySelector('.tag');
    var h2   = head.querySelector('h2');
    var desc = head.querySelector('.desc, p');
    if (tag)  { tag.classList.add('sa-tag');   watch(tag); }
    if (h2)   { h2.classList.add('sa-h2');     watch(h2); }
    if (desc) { desc.classList.add('sa-desc'); watch(desc); }
  });

  /* bento grids (tint / paint / polish / haverkamp) */
  document.querySelectorAll('.bento-grid').forEach(function (grid) {
    Array.from(grid.children).forEach(function (el, i) {
      el.classList.add('sa');
      el.style.transitionDelay = (i * 70) + 'ms';
      watch(el);
    });
  });

  /* wash.html packages */
  stagger('.pkg-grid',  80);
  /* fallback: pkg-cards not inside .pkg-grid */
  document.querySelectorAll('.pkg-card').forEach(function (el, i) {
    if (el.classList.contains('sa')) return;
    el.classList.add('sa');
    el.style.transitionDelay = (i * 80) + 'ms';
    watch(el);
  });

  /* before/after slider */
  document.querySelectorAll('.ba-slider').forEach(function (el) {
    el.classList.add('sa');
    watch(el);
  });

  /* svc CTA block */
  document.querySelectorAll('.svc-cta').forEach(function (el) {
    el.classList.add('sa');
    watch(el);
  });

  /* spec / feature rows in protication */
  document.querySelectorAll('.spec-grid, .feat-grid').forEach(function (grid) {
    Array.from(grid.children).forEach(function (el, i) {
      el.classList.add('sa');
      el.style.transitionDelay = (i * 60) + 'ms';
      watch(el);
    });
  });

  /* faq items on service pages (also used in index) */
  document.querySelectorAll('.svc-faq .faq-item, .svc-faq .faq-list .faq-item').forEach(function (el, i) {
    if (el.classList.contains('sa')) return;
    el.classList.add('sa');
    el.style.transitionDelay = (i * 55) + 'ms';
    watch(el);
  });

  /* ══════════════════════════════════════════════
     accessories.html
  ══════════════════════════════════════════════ */
  document.querySelectorAll('.shop-section-head').forEach(function (head) {
    var tag  = head.querySelector('.tag');
    var h2   = head.querySelector('h2, .shop-title');
    var desc = head.querySelector('.desc, p');
    if (tag)  { tag.classList.add('sa-tag');   watch(tag); }
    if (h2)   { h2.classList.add('sa-h2');     watch(h2); }
    if (desc) { desc.classList.add('sa-desc'); watch(desc); }
  });

  document.querySelectorAll('.products-grid').forEach(function (grid) {
    Array.from(grid.children).forEach(function (el, i) {
      el.classList.add('sa');
      el.style.transitionDelay = (i * 65) + 'ms';
      watch(el);
    });
  });

  document.querySelectorAll('.medals-grid').forEach(function (grid) {
    Array.from(grid.children).forEach(function (el, i) {
      el.classList.add('sa');
      el.style.transitionDelay = (i * 75) + 'ms';
      watch(el);
    });
  });

  /* ══════════════════════════════════════════════
     contactus.html
  ══════════════════════════════════════════════ */
  document.querySelectorAll('.contact-tiles').forEach(function (grid) {
    Array.from(grid.children).forEach(function (el, i) {
      el.classList.add('sa');
      el.style.transitionDelay = (i * 70) + 'ms';
      watch(el);
    });
  });

  ['profile-card', 'hours-card', 'map-card'].forEach(function (cls) {
    var el = document.querySelector('.' + cls);
    if (el) { el.classList.add('sa'); watch(el); }
  });

  /* ══════════════════════════════════════════════
     haverkamp.html (about page)
  ══════════════════════════════════════════════ */
  document.querySelectorAll('.about-stat-row').forEach(function (row) {
    Array.from(row.children).forEach(function (el, i) {
      el.classList.add('sa');
      el.style.transitionDelay = (i * 80) + 'ms';
      watch(el);
    });
  });

  fadeUp('.about-text');

})();
