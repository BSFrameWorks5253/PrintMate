/**
 * Generates realistic sample images for immediate testing:
 * 1. An ID card placed diagonally on a desk surface with background clutter
 * 2. An ID card Back side with magnetic stripe and barcode
 * 3. A folded paper document with text on a contrasting background
 */

function safeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number | number[]
) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  const r = typeof radius === 'number' ? radius : (radius[0] || 0);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

export function createSampleIdCard(side: 'front' | 'back' = 'front'): string {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 650;
  const ctx = canvas.getContext('2d')!;

  // 1. Draw desk/table background with subtle texture
  const deskGrad = ctx.createLinearGradient(0, 0, 900, 650);
  deskGrad.addColorStop(0, '#2d3748');
  deskGrad.addColorStop(0.5, '#1a202c');
  deskGrad.addColorStop(1, '#171923');
  ctx.fillStyle = deskGrad;
  ctx.fillRect(0, 0, 900, 650);

  // Subtle background grid/texture
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 900; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 650);
    ctx.stroke();
  }
  for (let y = 0; y < 650; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(900, y);
    ctx.stroke();
  }

  // A pen or notepad edge in background to simulate real clutter
  ctx.fillStyle = '#4a5568';
  ctx.fillRect(40, 50, 16, 280);

  // 2. Draw ID Card with perspective / slight rotation
  ctx.save();
  ctx.translate(450, 330);
  ctx.rotate(-7.5 * (Math.PI / 180)); // 7.5 degree tilt on table!

  // Cast shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetX = 14;
  ctx.shadowOffsetY = 20;

  const cardW = 540;
  const cardH = 340;
  const cardRadius = 18;

  // Card background (gradient)
  const cardGrad = ctx.createLinearGradient(-cardW / 2, -cardH / 2, cardW / 2, cardH / 2);
  if (side === 'front') {
    cardGrad.addColorStop(0, '#ffffff');
    cardGrad.addColorStop(0.4, '#eef2ff');
    cardGrad.addColorStop(1, '#e0e7ff');
  } else {
    cardGrad.addColorStop(0, '#f8fafc');
    cardGrad.addColorStop(1, '#f1f5f9');
  }

  ctx.fillStyle = cardGrad;
  ctx.beginPath();
  safeRoundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, cardRadius);
  ctx.fill();

  // Reset shadow for card interior contents
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Thin outer border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  safeRoundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, cardRadius);
  ctx.stroke();

  if (side === 'front') {
    // Header banner
    const bannerGrad = ctx.createLinearGradient(-cardW / 2, -cardH / 2, cardW / 2, -cardH / 2);
    bannerGrad.addColorStop(0, '#1e3a8a');
    bannerGrad.addColorStop(0.6, '#2563eb');
    bannerGrad.addColorStop(1, '#0284c7');
    ctx.fillStyle = bannerGrad;
    ctx.beginPath();
    safeRoundRect(ctx, -cardW / 2, -cardH / 2, cardW, 64, cardRadius);
    ctx.fill();

    // Emblem circle
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(-cardW / 2 + 40, -cardH / 2 + 32, 16, 0, Math.PI * 2);
    ctx.fill();

    // Header text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText('GOVERNMENT IDENTITY CARD', -cardW / 2 + 70, -cardH / 2 + 30);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#bfdbfe';
    ctx.fillText('CITIZEN CARD / CR80 FORMAT', -cardW / 2 + 70, -cardH / 2 + 48);

    // ID Photo Box
    const photoX = -cardW / 2 + 36;
    const photoY = -cardH / 2 + 90;
    const photoW = 120;
    const photoH = 145;

    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(photoX, photoY, photoW, photoH);
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(photoX, photoY, photoW, photoH);

    // Silhouette head
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(photoX + photoW / 2, photoY + 50, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(photoX + photoW / 2, photoY + 115, 42, 35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Gold Smart Chip
    const chipX = photoX + photoW + 28;
    const chipY = photoY + 10;
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    safeRoundRect(ctx, chipX, chipY, 48, 38, 4);
    ctx.fill();
    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 1;
    ctx.strokeRect(chipX + 8, chipY + 6, 32, 26);

    // Identity Fields
    const textX = chipX;
    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';
    ctx.fillText('FULL NAME', textX, photoY + 70);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('ALEXANDER R. MORGAN', textX, photoY + 88);

    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';
    ctx.fillText('ID NUMBER', textX, photoY + 112);
    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('USA-9842-7710-X', textX, photoY + 128);

    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';
    ctx.fillText('DATE OF BIRTH: 14/08/1992', textX, photoY + 150);
    ctx.fillText('VALID THRU: 10/2032', textX + 170, photoY + 150);

    // Hologram strip
    const holoGrad = ctx.createLinearGradient(-cardW / 2, 85, cardW / 2, 85);
    holoGrad.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
    holoGrad.addColorStop(0.5, 'rgba(232, 121, 249, 0.4)');
    holoGrad.addColorStop(1, 'rgba(52, 211, 153, 0.4)');
    ctx.fillStyle = holoGrad;
    ctx.fillRect(-cardW / 2 + 10, 85, cardW - 20, 16);

    // Bottom Barcode / MRZ
    ctx.fillStyle = '#1e293b';
    for (let b = 0; b < cardW - 60; b += 7) {
      const bw = (b % 14 === 0) ? 4 : 2;
      ctx.fillRect(-cardW / 2 + 30 + b, 115, bw, 28);
    }
  } else {
    // BACK SIDE OF CARD
    // Magnetic stripe
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-cardW / 2, -cardH / 2 + 30, cardW, 55);

    // Signature strip
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.fillRect(-cardW / 2 + 30, -cardH / 2 + 110, 340, 42);
    ctx.strokeRect(-cardW / 2 + 30, -cardH / 2 + 110, 340, 42);

    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'italic 16px cursive';
    ctx.fillText('Alex Morgan', -cardW / 2 + 45, -cardH / 2 + 138);

    // Security code
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('CVV 782', -cardW / 2 + 390, -cardH / 2 + 136);

    // Official text & terms
    ctx.fillStyle = '#475569';
    ctx.font = '10px sans-serif';
    ctx.fillText('THIS CARD IS PROPERTY OF THE ISSUING AUTHORITY.', -cardW / 2 + 30, -cardH / 2 + 180);
    ctx.fillText('IF FOUND, PLEASE DROP IN ANY POST MAILBOX OR RETURN TO:', -cardW / 2 + 30, -cardH / 2 + 196);
    ctx.fillText('CENTRAL REGISTRAR OFFICE, NATIONAL ARCHIVES BLVD, SUITE 400', -cardW / 2 + 30, -cardH / 2 + 212);
    ctx.fillText('EMERGENCY HOTLINE: 1-800-555-0199 | ID REG: #98427710-B', -cardW / 2 + 30, -cardH / 2 + 228);

    // QR Code square
    ctx.fillStyle = '#000000';
    const qrX = cardW / 2 - 110;
    const qrY = -cardH / 2 + 175;
    ctx.fillRect(qrX, qrY, 75, 75);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qrX + 6, qrY + 6, 63, 63);
    ctx.fillStyle = '#000000';
    ctx.fillRect(qrX + 12, qrY + 12, 18, 18);
    ctx.fillRect(qrX + 45, qrY + 12, 18, 18);
    ctx.fillRect(qrX + 12, qrY + 45, 18, 18);
    ctx.fillRect(qrX + 36, qrY + 36, 12, 12);
  }

  ctx.restore();
  return canvas.toDataURL('image/jpeg', 0.92);
}

export function createSamplePaperDocument(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 850;
  canvas.height = 950;
  const ctx = canvas.getContext('2d')!;

  // Dark desktop surface background
  ctx.fillStyle = '#1e1b2e';
  ctx.fillRect(0, 0, 850, 950);

  // Slightly rotated paper sheet on desk
  ctx.save();
  ctx.translate(425, 475);
  ctx.rotate(4.5 * (Math.PI / 180));

  // Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 35;
  ctx.shadowOffsetX = 12;
  ctx.shadowOffsetY = 16;

  const docW = 540;
  const docH = 760;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-docW / 2, -docH / 2, docW, docH);

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Paper content
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px serif';
  ctx.fillText('CERTIFICATE OF VERIFICATION', -docW / 2 + 60, -docH / 2 + 80);

  ctx.fillStyle = '#64748b';
  ctx.font = '12px sans-serif';
  ctx.fillText('DOCUMENT REF: PM-2026-X992', -docW / 2 + 60, -docH / 2 + 105);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-docW / 2 + 60, -docH / 2 + 120);
  ctx.lineTo(docW / 2 - 60, -docH / 2 + 120);
  ctx.stroke();

  // Simulated paragraph lines
  ctx.fillStyle = '#334155';
  ctx.font = '13px sans-serif';
  const sampleLines = [
    'This document hereby certifies that the submitted identification record has been',
    'scanned, processed, and validated in compliance with the Document Authentication',
    'Standard ISO/IEC 18013 and digital archival guidelines.',
    '',
    'Holder: Alexander R. Morgan',
    'Status: Verified & Active',
    'Registration District: Central Province',
    'Issue Date: 24th October 2026',
    '',
    'Notice: Any alteration, defacement or unauthorized reproduction of this page',
    'invalidates this certificate. For verification inquiries, present the original',
    'CR80 card alongside this sheet.',
  ];

  sampleLines.forEach((line, idx) => {
    ctx.fillText(line, -docW / 2 + 60, -docH / 2 + 160 + idx * 24);
  });

  // Stamp circle
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(docW / 2 - 130, docH / 2 - 140, 48, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#dc2626';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('OFFICIAL STAMP', docW / 2 - 180, docH / 2 - 144);
  ctx.fillText('APPROVED', docW / 2 - 165, docH / 2 - 126);

  ctx.restore();
  return canvas.toDataURL('image/jpeg', 0.92);
}
