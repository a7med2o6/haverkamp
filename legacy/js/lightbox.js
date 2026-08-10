function openLb(item) {
  const img = item.querySelector('img');
  document.getElementById('lb-img').src = img.src;
  document.getElementById('lb-img').alt = img.alt;
  document.getElementById('lb').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLb(e) {
  if (e && e.target !== document.getElementById('lb') && !e.target.closest('.lb-close')) return;
  document.getElementById('lb').classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLb(); });
