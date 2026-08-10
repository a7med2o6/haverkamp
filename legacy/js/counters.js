// Animated counters — trigger when hero strip enters viewport
(function() {
  const counters = document.querySelectorAll('.strip-num[data-count]');
  if (!counters.length) return;

  function formatNum(n, format) {
    const rounded = Math.round(n);
    if (format === 'comma') return rounded.toLocaleString('en-US');
    return String(rounded);
  }

  function animate(el) {
    const target = parseInt(el.dataset.count, 10);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const format = el.dataset.format;
    const duration = 1800;
    const start = performance.now();

    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const v = target * eased;
      el.textContent = prefix + formatNum(v, format) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const seen = new WeakSet();
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !seen.has(entry.target)) {
        seen.add(entry.target);
        animate(entry.target);
      }
    });
  }, { threshold: 0.4 });

  counters.forEach((c) => obs.observe(c));
})();
