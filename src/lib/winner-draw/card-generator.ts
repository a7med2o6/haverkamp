/**
 * Generates a high-resolution branded luxury winner certificate card PNG
 * perfectly matching the celebration display card for Instagram & WhatsApp.
 */
export function generateWinnerCardImage(
  winnerName: string,
  contestTitle: string,
  prizeTitle: string,
  isPrizeMode: boolean
) {
  if (typeof window === 'undefined' || !winnerName) return;

  const cardCanvas = document.createElement('canvas');
  cardCanvas.width = 1200;
  cardCanvas.height = 1400;
  const ctx = cardCanvas.getContext('2d');
  if (!ctx) return;

  const renderAndDownload = (trophyImg?: HTMLImageElement | null) => {
    const W = 1200;
    const H = 1400;

    // 1. Dark Luxury Navy Background with Radial Lighting
    const bgGradient = ctx.createRadialGradient(W / 2, 450, 100, W / 2, H / 2, 900);
    bgGradient.addColorStop(0, '#101a2e');
    bgGradient.addColorStop(0.5, '#080e1d');
    bgGradient.addColorStop(1, '#040710');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, W, H);

    // Subtle ambient gold glow behind trophy
    const goldGlow = ctx.createRadialGradient(W / 2, 340, 30, W / 2, 340, 350);
    goldGlow.addColorStop(0, 'rgba(251, 191, 36, 0.22)');
    goldGlow.addColorStop(0.6, 'rgba(251, 191, 36, 0.04)');
    goldGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = goldGlow;
    ctx.fillRect(0, 0, W, H);

    // 2. Luxury Rounded Golden Border (Matching Reference Design)
    ctx.save();
    const borderPadding = 48;
    const borderRadius = 56;
    const boxW = W - borderPadding * 2;
    const boxH = H - borderPadding * 2;

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#b8860b';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(borderPadding, borderPadding, boxW, boxH, borderRadius);
    } else {
      ctx.rect(borderPadding, borderPadding, boxW, boxH);
    }
    ctx.stroke();

    // Inner subtle gold border
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(borderPadding + 10, borderPadding + 10, boxW - 20, boxH - 20, borderRadius - 8);
    } else {
      ctx.rect(borderPadding + 10, borderPadding + 10, boxW - 20, boxH - 20);
    }
    ctx.stroke();
    ctx.restore();

    // 3. Official Haverkamp Emblem at Top Center
    ctx.save();
    ctx.translate(W / 2 - 28, 95);
    const emblemScale = 56 / 2048;
    ctx.scale(emblemScale, emblemScale);
    ctx.fillStyle = '#FFFFFF';
    const emblemPath = new Path2D(
      'M335 168 H1713 V1546 H335 Z M612 445 V1269 H1436 V445 Z'
    );
    ctx.fill(emblemPath, 'evenodd');
    ctx.fillRect(726, 559, 596, 596);
    ctx.fillRect(833, 1546, 383, 334);
    ctx.restore();

    // Haverkamp brand header
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 20px "Tajawal", "Readex Pro", sans-serif';
    ctx.fillText('هافركامب الكويت • HAVERKAMP KUWAIT', W / 2, 185);

    // 4. 3D Golden Trophy
    if (trophyImg && trophyImg.complete && trophyImg.naturalWidth > 0) {
      const trophyW = 200;
      const trophyH = (trophyW * trophyImg.naturalHeight) / trophyImg.naturalWidth;
      const trophyX = (W - trophyW) / 2;
      const trophyY = 220;

      ctx.save();
      ctx.shadowColor = 'rgba(251, 191, 36, 0.45)';
      ctx.shadowBlur = 40;
      ctx.drawImage(trophyImg, trophyX, trophyY, trophyW, trophyH);
      ctx.restore();
    }

    // 5. Title
    const titleY = 560;
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 38px "Tajawal", "Readex Pro", sans-serif';
    const displayTitle = isPrizeMode
      ? contestTitle
        ? `مبارك الجائزة بـ ${contestTitle}!`
        : 'مبارك الجائزة بـ عجلة الجوائز الفورية!'
      : contestTitle
      ? `مبارك الفائز بـ ${contestTitle}!`
      : 'مبارك الفائز بـ عجلة الجوائز الفورية!';
    ctx.fillText(displayTitle, W / 2, titleY);

    // 6. Confetti Emoji
    ctx.font = '40px sans-serif';
    ctx.fillText('🎉', W / 2, titleY + 55);

    // 7. Hero Winner / Prize Name (Massive, Radiant Gold Typography)
    const nameY = titleY + 160;
    ctx.save();
    ctx.shadowColor = 'rgba(250, 204, 21, 0.65)';
    ctx.shadowBlur = 35;
    ctx.fillStyle = '#FACC15';
    ctx.font = '900 78px "Tajawal", "Readex Pro", sans-serif';
    ctx.fillText(winnerName, W / 2, nameY);
    ctx.restore();

    // 8. Luxury Prize Pill Badge
    const pillY = nameY + 50;
    const pillH = 72;
    const pillW = 680;
    const pillX = (W - pillW) / 2;

    ctx.save();
    // Pill dark bronze background
    ctx.fillStyle = '#20180f';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(pillX, pillY, pillW, pillH, 36);
    } else {
      ctx.rect(pillX, pillY, pillW, pillH);
    }
    ctx.fill();

    // Pill gold border
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(184, 134, 11, 0.8)';
    ctx.stroke();

    // Pill text
    ctx.fillStyle = '#FBBF24';
    ctx.font = 'bold 30px "Tajawal", "Readex Pro", sans-serif';
    const pillText = isPrizeMode
      ? '🎁 جائزة فورية معتمدة من هافركامب'
      : `🎁 الجائزة: ${prizeTitle || 'جائزة هافركامب'}`;
    ctx.fillText(pillText, W / 2, pillY + 48);
    ctx.restore();

    // 9. Decorative Verification Stamp Box
    const stampY = pillY + 140;
    ctx.save();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
    ctx.lineWidth = 1.5;
    const stampW = 540;
    const stampH = 55;
    const stampX = (W - stampW) / 2;
    ctx.strokeRect(stampX, stampY, stampW, stampH);

    ctx.fillStyle = '#FBBF24';
    ctx.font = 'bold 20px "Tajawal", "Readex Pro", sans-serif';
    ctx.fillText('★ سحب معتمد رسمياً — هافركامب الكويت ★', W / 2, stampY + 36);
    ctx.restore();

    // 10. Date & Official Verification Footer
    const dateStr = new Date().toLocaleDateString('ar-KW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Separator line
    ctx.beginPath();
    ctx.moveTo(250, 1180);
    ctx.lineTo(950, 1180);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 22px "Tajawal", sans-serif';
    ctx.fillText(`تاريخ إجراء السحب: ${dateStr}`, W / 2, 1225);

    ctx.fillStyle = '#38BDF8';
    ctx.font = '600 20px "Readex Pro", "Tajawal", sans-serif';
    ctx.fillText(
      'instagram.com/haverkampkw  •  haverkampkw.com  •  +965 51111154',
      W / 2,
      1265
    );

    // Trigger image download
    const imgData = cardCanvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.href = imgData;
    downloadLink.download = `بطاقة-فوز-هافركامب-${winnerName}.png`;
    downloadLink.click();
  };

  // Attempt to load 3D trophy image from cache / assets
  const trophy = new Image();
  trophy.crossOrigin = 'anonymous';
  trophy.onload = () => renderAndDownload(trophy);
  trophy.onerror = () => renderAndDownload(null);
  trophy.src = '/assets/trophy-3d.png';

  // Safety fallback if image takes too long
  setTimeout(() => {
    if (!trophy.complete) {
      renderAndDownload(null);
    }
  }, 1500);
}
