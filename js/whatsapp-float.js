(function () {
  const style = document.createElement('style');
  style.textContent = `
    .wa-float {
      position: fixed;
      bottom: 28px;
      left: 28px;
      z-index: 900;
      width: 58px;
      height: 58px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      color: #25D366;
      /* Liquid Glass */
      background: var(--glass-tint-strong, rgba(255,255,255,0.10));
      backdrop-filter: blur(var(--blur, 32px)) saturate(220%) brightness(1.05);
      -webkit-backdrop-filter: blur(var(--blur, 32px)) saturate(220%) brightness(1.05);
      border: 1.5px solid rgba(37,211,102,0.40);
      box-shadow:
        0 1px 0 rgba(255,255,255,0.18) inset,
        0 -1px 0 rgba(255,255,255,0.06) inset,
        0 10px 36px -6px rgba(0,0,0,0.45),
        0 4px 12px -4px rgba(0,0,0,0.25);
      transition: transform 0.25s cubic-bezier(0.2,0.7,0.3,1), box-shadow 0.25s;
    }
    /* Refractive edge highlight */
    .wa-float::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 50%;
      padding: 1.5px;
      background: linear-gradient(160deg,
        rgba(255,255,255,0.65) 0%,
        rgba(255,255,255,0.10) 35%,
        rgba(255,255,255,0) 55%,
        rgba(255,255,255,0.12) 100%);
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }
    /* Pulse ring */
    .wa-float::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid rgba(37,211,102,0.55);
      animation: wa-ring 3.2s ease-out infinite;
      pointer-events: none;
    }
    @keyframes wa-ring {
      0%   { transform: scale(1);   opacity: 0.55; }
      65%  { transform: scale(1.7); opacity: 0;    }
      100% { transform: scale(1.7); opacity: 0;    }
    }
    .wa-float:hover {
      transform: translateY(-4px);
      box-shadow:
        0 1px 0 rgba(255,255,255,0.22) inset,
        0 -1px 0 rgba(255,255,255,0.06) inset,
        0 20px 48px -6px rgba(0,0,0,0.50),
        0 0 28px rgba(37,211,102,0.22);
    }
    .wa-float:hover::after { animation: none; opacity: 0; }
    @media (max-width: 640px) {
      .wa-float { bottom: 20px; left: 20px; width: 52px; height: 52px; }
      .wa-float svg { width: 24px; height: 24px; }
    }
  `;
  document.head.appendChild(style);

  const btn = document.createElement('a');
  btn.href = 'https://wa.me/96551111154';
  btn.target = '_blank';
  btn.rel = 'noopener noreferrer';
  btn.className = 'wa-float';
  btn.setAttribute('aria-label', 'تواصل عبر واتساب');
  btn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>`;

  document.body.appendChild(btn);
})();
