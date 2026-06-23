(function () {
  function initSlider(el) {
    const before = el.querySelector('.ba-before');
    const divider = el.querySelector('.ba-divider');
    let pct = 50;
    let dragging = false;

    function setPosition(x) {
      const rect = el.getBoundingClientRect();
      pct = Math.min(100, Math.max(0, ((x - rect.left) / rect.width) * 100));
      before.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
      divider.style.left = pct + '%';
    }

    // init
    before.style.clipPath = 'inset(0 50% 0 0)';

    el.addEventListener('mousedown', function (e) { dragging = true; setPosition(e.clientX); e.preventDefault(); });
    window.addEventListener('mousemove', function (e) { if (dragging) setPosition(e.clientX); });
    window.addEventListener('mouseup', function () { dragging = false; });

    el.addEventListener('touchstart', function (e) { dragging = true; setPosition(e.touches[0].clientX); }, { passive: true });
    window.addEventListener('touchmove', function (e) { if (dragging) setPosition(e.touches[0].clientX); }, { passive: true });
    window.addEventListener('touchend', function () { dragging = false; });

    el.setAttribute('tabindex', '0');
    el.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { pct = Math.min(100, pct + 2); }
      else if (e.key === 'ArrowLeft') { pct = Math.max(0, pct - 2); }
      else return;
      before.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
      divider.style.left = pct + '%';
    });
  }

  function init() {
    document.querySelectorAll('.ba-slider').forEach(function (el) {
      if (!el.dataset.baInit) {
        el.dataset.baInit = '1';
        initSlider(el);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
