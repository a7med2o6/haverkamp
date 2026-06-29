(function () {
  var burger = document.getElementById('nav-burger');
  var drawer = document.getElementById('nav-drawer');
  if (!burger || !drawer) return;

  // Clone nav links into the drawer
  var navLinks = document.querySelector('.nav-links');
  if (navLinks) {
    Array.from(navLinks.querySelectorAll('a')).forEach(function (a) {
      drawer.appendChild(a.cloneNode(true));
    });
  }

  // Add CTA button to drawer
  var navCta = document.querySelector('.nav-cta');
  if (navCta) {
    var sep = document.createElement('div');
    sep.className = 'drawer-sep';
    drawer.appendChild(sep);
    var ctaClone = navCta.cloneNode(true);
    ctaClone.classList.add('drawer-cta-link');
    drawer.appendChild(ctaClone);
  }

  function openDrawer() {
    drawer.classList.add('open');
    burger.classList.add('open');
    burger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = '';
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    burger.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  }

  burger.addEventListener('click', function (e) {
    e.stopPropagation();
    drawer.classList.contains('open') ? closeDrawer() : openDrawer();
  });

  // Close when a link inside the drawer is tapped
  drawer.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') closeDrawer();
  });

  // Close on outside click
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav-wrap')) closeDrawer();
  });

  // Close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDrawer();
  });
})();
