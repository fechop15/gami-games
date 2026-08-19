// ── Dibujo del mundo: fondo, plataformas, personajes, entidades ────────────────
import type { Coin, Enemy, Fireball, GS, Platform, Projectile, Spike, StarCoin, Theme } from '../types';
import { SKINS, rainbow, PW, PH } from '../config';
import { rrect, drawCloud } from './primitives';
import { drawParticles } from '../particles';

// ── Fondo por tema ─────────────────────────────────────────────────────────────
export function drawBackground(ctx: CanvasRenderingContext2D, cw: number, ch: number, theme: Theme, camX: number, t: number) {
  if (theme === 'green') {
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#0d47a1');
    grad.addColorStop(0.45, '#1976d2');
    grad.addColorStop(0.75, '#64b5f6');
    grad.addColorStop(1, '#bbdefb');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    const sunX = cw * 0.82, sunY = ch * 0.14;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 55);
    sunGrad.addColorStop(0, '#fff9c4');
    sunGrad.addColorStop(0.4, '#ffee58');
    sunGrad.addColorStop(1, 'rgba(255,238,88,0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath(); ctx.arc(sunX, sunY, 55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff9c4';
    ctx.beginPath(); ctx.arc(sunX, sunY, 22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,238,88,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + t * 0.3;
      ctx.beginPath();
      ctx.moveTo(sunX + Math.cos(a) * 26, sunY + Math.sin(a) * 26);
      ctx.lineTo(sunX + Math.cos(a) * 44, sunY + Math.sin(a) * 44);
      ctx.stroke();
    }
    ctx.lineWidth = 1;

    const h1Off = -(camX * 0.15) % (cw + 600);
    ctx.fillStyle = '#1b5e20';
    for (let i = -1; i <= 2; i++) {
      const hx = h1Off + i * (cw + 600);
      ctx.beginPath();
      ctx.moveTo(hx, ch * 0.80);
      ctx.bezierCurveTo(hx + 150, ch * 0.60, hx + 300, ch * 0.62, hx + 450, ch * 0.78);
      ctx.bezierCurveTo(hx + 600, ch * 0.55, hx + 750, ch * 0.58, hx + 900, ch * 0.78);
      ctx.lineTo(hx + cw + 600, ch * 0.80);
      ctx.lineTo(hx + cw + 600, ch); ctx.lineTo(hx, ch);
      ctx.closePath(); ctx.fill();
    }
    const h2Off = -(camX * 0.25) % (cw + 500);
    ctx.fillStyle = '#2e7d32';
    for (let i = -1; i <= 2; i++) {
      const hx = h2Off + i * (cw + 500);
      ctx.beginPath();
      ctx.moveTo(hx, ch * 0.82);
      ctx.bezierCurveTo(hx + 120, ch * 0.65, hx + 240, ch * 0.67, hx + 380, ch * 0.82);
      ctx.bezierCurveTo(hx + 500, ch * 0.62, hx + 640, ch * 0.65, hx + 780, ch * 0.82);
      ctx.lineTo(hx + cw + 500, ch * 0.82);
      ctx.lineTo(hx + cw + 500, ch); ctx.lineTo(hx, ch);
      ctx.closePath(); ctx.fill();
    }

    const cloudDefs = [80, 300, 550, 820, 1100, 1380, 1660, 1940, 2230, 2530];
    cloudDefs.forEach((cx, i) => {
      const r = 30 + (i % 3) * 13;
      const cy = 38 + (i % 4) * 24;
      const screenX = ((cx - camX * 0.3) % (cw + 300) + cw + 300) % (cw + 300) - 150;
      ctx.fillStyle = 'rgba(120,170,220,0.3)';
      drawCloud(ctx, screenX + 5, cy + 6, r * 0.9);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      drawCloud(ctx, screenX, cy, r);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.arc(screenX - r * 0.3, cy - r * 0.3, r * 0.3, 0, Math.PI * 2); ctx.fill();
    });

  } else if (theme === 'cave') {
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#0d0208');
    grad.addColorStop(0.5, '#1a0a10');
    grad.addColorStop(1, '#2d1510');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    const crystalDefs = [100, 350, 600, 850, 1100, 1400, 1700, 2000];
    crystalDefs.forEach((cx, i) => {
      const screenX = ((cx - camX * 0.15) % (cw + 400) + cw + 400) % (cw + 400) - 200;
      const h2 = 30 + (i % 3) * 15;
      const alpha = 0.12 + (i % 3) * 0.06;
      ctx.fillStyle = `rgba(100,60,180,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(screenX - 8, ch * 0.72); ctx.lineTo(screenX, ch * 0.72 - h2); ctx.lineTo(screenX + 8, ch * 0.72);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(screenX + 3, ch * 0.72); ctx.lineTo(screenX + 12, ch * 0.72 - h2 * 0.7); ctx.lineTo(screenX + 18, ch * 0.72);
      ctx.closePath(); ctx.fill();
    });

    const sOff = -(camX * 0.25);
    const stalDefs = [60, 170, 290, 430, 560, 700, 840, 990, 1130, 1270, 1420, 1570];
    stalDefs.forEach((sx2, i) => {
      const sw = 20 + (i % 3) * 10;
      const sh = 55 + (i % 4) * 28;
      const screenX = ((sx2 + sOff) % (cw + 300) + cw + 300) % (cw + 300) - 150;
      const stalGrad = ctx.createLinearGradient(screenX - sw / 2, 0, screenX + sw / 2, sh);
      stalGrad.addColorStop(0, '#3d2010'); stalGrad.addColorStop(0.5, '#5d3020'); stalGrad.addColorStop(1, '#3d2010');
      ctx.fillStyle = stalGrad;
      ctx.beginPath();
      ctx.moveTo(screenX - sw / 2, 0); ctx.lineTo(screenX + sw / 2, 0);
      ctx.lineTo(screenX + 2, sh); ctx.lineTo(screenX - 2, sh);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,180,120,0.15)';
      ctx.fillRect(screenX - 2, 0, 4, sh * 0.6);
    });

    const torchDefs = [200, 550, 900, 1250, 1600, 1950, 2300];
    torchDefs.forEach((tx) => {
      const screenX = tx - camX * 0.5;
      if (screenX < -150 || screenX > cw + 150) return;
      const flicker = 1 + Math.sin(t * 9 + tx * 0.01) * 0.22;
      const gr1 = ctx.createRadialGradient(screenX, ch * 0.60, 0, screenX, ch * 0.60, 120 * flicker);
      gr1.addColorStop(0, 'rgba(255,120,20,0.22)'); gr1.addColorStop(0.5, 'rgba(255,60,0,0.10)'); gr1.addColorStop(1, 'rgba(255,20,0,0)');
      ctx.fillStyle = gr1; ctx.fillRect(screenX - 130, ch * 0.30, 260, 260);
      const gr2 = ctx.createRadialGradient(screenX, ch * 0.62, 0, screenX, ch * 0.62, 20);
      gr2.addColorStop(0, 'rgba(255,220,80,0.7)'); gr2.addColorStop(1, 'rgba(255,120,0,0)');
      ctx.fillStyle = gr2; ctx.fillRect(screenX - 25, ch * 0.52, 50, 50);
      ctx.fillStyle = '#5d4037'; ctx.fillRect(screenX - 4, ch * 0.62, 8, 16);
      ctx.fillStyle = '#ffa000';
      const fH = 10 + Math.sin(t * 12 + tx) * 3;
      ctx.beginPath();
      ctx.moveTo(screenX - 5, ch * 0.62); ctx.lineTo(screenX + 5, ch * 0.62); ctx.lineTo(screenX, ch * 0.62 - fH);
      ctx.closePath(); ctx.fill();
    });

  } else if (theme === 'sky') {
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#4fc3f7');
    grad.addColorStop(0.35, '#b3e5fc');
    grad.addColorStop(0.7, '#e1f5fe');
    grad.addColorStop(1, '#fff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    const starDefs = [50,130,210,310,420,530,660,770,880,980,1100,1220,1350,1490,1640,1810];
    starDefs.forEach((sx2, i) => {
      const screenX = ((sx2 - camX * 0.05) % (cw + 100) + cw + 100) % (cw + 100) - 50;
      const sy = 20 + (i % 6) * 18;
      ctx.globalAlpha = (0.3 + Math.abs(Math.sin(t * 2 + i * 1.3)) * 0.7) * 0.6;
      ctx.fillStyle = '#fff'; ctx.fillRect(screenX, sy, 2, 2);
      ctx.globalAlpha = 1;
    });

    const islandDefs = [200, 700, 1300, 1900, 2600, 3300, 4000];
    islandDefs.forEach((ix, i) => {
      const screenX = ((ix - camX * 0.2) % (cw + 500) + cw + 500) % (cw + 500) - 250;
      const iy = ch * (0.30 + (i % 3) * 0.07);
      const iw = 110 + i * 8;
      ctx.fillStyle = 'rgba(50,100,50,0.2)';
      ctx.beginPath(); ctx.ellipse(screenX + 6, iy + 8, iw / 2 - 5, 14, 0, 0, Math.PI * 2); ctx.fill();
      const isGrad = ctx.createLinearGradient(screenX - iw/2, iy - 18, screenX + iw/2, iy + 18);
      isGrad.addColorStop(0, 'rgba(76,175,80,0.50)'); isGrad.addColorStop(1, 'rgba(33,150,83,0.35)');
      ctx.fillStyle = isGrad;
      ctx.beginPath(); ctx.ellipse(screenX, iy, iw / 2, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(129,199,132,0.40)';
      ctx.beginPath(); ctx.ellipse(screenX, iy - 8, iw / 2 - 12, 10, 0, 0, Math.PI * 2); ctx.fill();
    });

    const cloudDefs = [60, 280, 520, 780, 1060, 1360, 1680, 2020];
    cloudDefs.forEach((cx, i) => {
      const r = 38 + (i % 3) * 16;
      const cy = ch * 0.12 + (i % 4) * 30;
      const screenX = ((cx - camX * 0.4) % (cw + 400) + cw + 400) % (cw + 400) - 200;
      ctx.fillStyle = 'rgba(200,230,255,0.35)';
      drawCloud(ctx, screenX + 6, cy + 8, r * 0.85);
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      drawCloud(ctx, screenX, cy, r);
    });

  } else if (theme === 'sea') {
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#006064');
    grad.addColorStop(0.4, '#00838f');
    grad.addColorStop(0.8, '#00acc1');
    grad.addColorStop(1, '#b2ebf2');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const rx = (cw * 0.1 + i * cw * 0.16 - (camX * 0.1) % cw + cw * 2) % (cw * 1.5) - cw * 0.25;
      const rayGrad = ctx.createLinearGradient(rx, 0, rx + 40, ch * 0.7);
      rayGrad.addColorStop(0, 'rgba(178,235,242,0.22)');
      rayGrad.addColorStop(1, 'rgba(178,235,242,0)');
      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(rx - 20, 0); ctx.lineTo(rx + 60, 0);
      ctx.lineTo(rx + 80 + Math.sin(t * 0.5 + i) * 20, ch * 0.7);
      ctx.lineTo(rx - 40 + Math.sin(t * 0.5 + i) * 20, ch * 0.7);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    const bubbleDefs = [80,180,290,420,560,700,860,1020,1200,1380,1570,1770,1990];
    bubbleDefs.forEach((bx2, i) => {
      const screenX = ((bx2 - camX * 0.4) % (cw + 200) + cw + 200) % (cw + 200) - 100;
      const by2 = ((ch * 0.9 - (t * (25 + i % 4 * 8) + i * 60)) % ch + ch) % ch;
      const br = 3 + (i % 3) * 2;
      ctx.strokeStyle = `rgba(178,235,242,${0.3 + (i % 3) * 0.15})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(screenX, by2, br, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(224,247,250,0.12)`; ctx.fill();
    });
    ctx.lineWidth = 1;
    const coralDefs = [60,180,320,480,640,820,1010,1220,1450,1700];
    coralDefs.forEach((cx2, i) => {
      const screenX = ((cx2 - camX * 0.5) % (cw + 400) + cw + 400) % (cw + 400) - 200;
      const ch2 = 30 + (i % 4) * 18;
      const col = i % 3 === 0 ? 'rgba(244,81,30,0.45)' : i % 3 === 1 ? 'rgba(156,39,176,0.40)' : 'rgba(255,152,0,0.40)';
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(screenX, ch * 0.88); ctx.lineTo(screenX - 4, ch * 0.88 - ch2); ctx.lineTo(screenX + 4, ch * 0.88 - ch2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(screenX - 6, ch * 0.88 - ch2 * 0.5); ctx.lineTo(screenX - 14, ch * 0.88 - ch2 * 0.8); ctx.lineTo(screenX - 8, ch * 0.88 - ch2 * 0.8); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(screenX + 6, ch * 0.88 - ch2 * 0.4); ctx.lineTo(screenX + 14, ch * 0.88 - ch2 * 0.75); ctx.lineTo(screenX + 8, ch * 0.88 - ch2 * 0.75); ctx.closePath(); ctx.fill();
    });
    const fishDefs = [200,500,900,1400,1900,2500];
    fishDefs.forEach((fx, i) => {
      const screenX = ((fx - camX * 0.3) % (cw + 300) + cw + 300) % (cw + 300) - 150;
      const fy = ch * 0.25 + (i % 4) * ch * 0.12;
      const fSwim = Math.sin(t * 2 + i) * 8;
      ctx.fillStyle = `rgba(0,96,100,0.25)`;
      ctx.beginPath(); ctx.ellipse(screenX + fSwim, fy, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(screenX + fSwim - 18, fy); ctx.lineTo(screenX + fSwim - 28, fy - 8); ctx.lineTo(screenX + fSwim - 28, fy + 8); ctx.closePath(); ctx.fill();
    });

  } else if (theme === 'lava') {
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#0d0000'); grad.addColorStop(0.4, '#1a0000');
    grad.addColorStop(0.8, '#3d0000'); grad.addColorStop(1, '#6d1c00');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, cw, ch);
    const lavaDefs = [150, 450, 780, 1120, 1480, 1860, 2260];
    lavaDefs.forEach((lx, i) => {
      const screenX = ((lx - camX * 0.2) % (cw + 400) + cw + 400) % (cw + 400) - 200;
      const flicker = 1 + Math.sin(t * 4 + i * 1.3) * 0.25;
      const lg = ctx.createRadialGradient(screenX, ch * 0.82, 0, screenX, ch * 0.82, 80 * flicker);
      lg.addColorStop(0, 'rgba(255,87,34,0.45)'); lg.addColorStop(0.5, 'rgba(244,67,54,0.20)'); lg.addColorStop(1, 'rgba(183,28,28,0)');
      ctx.fillStyle = lg; ctx.fillRect(screenX - 90, ch * 0.55, 180, ch * 0.5);
    });
    const smokeDefs = [100, 350, 620, 900, 1200, 1550, 1930];
    smokeDefs.forEach((sx2, i) => {
      const screenX = ((sx2 - camX * 0.35) % (cw + 300) + cw + 300) % (cw + 300) - 150;
      for (let s = 0; s < 4; s++) {
        const sy = ch * 0.78 - ((t * 30 + s * 55 + i * 80) % (ch * 0.75));
        const alpha = Math.max(0, 0.12 - s * 0.025);
        ctx.fillStyle = `rgba(80,60,60,${alpha})`;
        ctx.beginPath(); ctx.arc(screenX + Math.sin(t * 0.8 + s) * 10, sy, 12 + s * 8, 0, Math.PI * 2); ctx.fill();
      }
    });
    for (let i = 0; i < 18; i++) {
      const ex = (((i * 137 + camX * 0.6) % (cw + 100) + cw + 100)) % (cw + 100) - 50;
      const ey2 = ((t * (20 + i % 5 * 12) + i * 80) % (ch * 0.85));
      const alpha = 0.4 + Math.sin(t * 5 + i) * 0.3;
      ctx.fillStyle = i % 2 === 0 ? `rgba(255,160,0,${alpha})` : `rgba(255,87,34,${alpha})`;
      ctx.beginPath(); ctx.arc(ex, ey2, 1.5 + (i % 3), 0, Math.PI * 2); ctx.fill();
    }
    const crackGrad = ctx.createLinearGradient(0, ch * 0.82, 0, ch);
    crackGrad.addColorStop(0, 'rgba(255,87,34,0.35)'); crackGrad.addColorStop(0.4, 'rgba(244,67,54,0.20)'); crackGrad.addColorStop(1, 'rgba(183,28,28,0.10)');
    ctx.fillStyle = crackGrad; ctx.fillRect(0, ch * 0.82, cw, ch * 0.18);

  } else if (theme === 'jungle') {
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#0a1f0a'); grad.addColorStop(0.3, '#1b3a1b');
    grad.addColorStop(0.7, '#2d5a2d'); grad.addColorStop(1, '#1a3d1a');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, cw, ch);
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const bx2 = cw * 0.08 + i * cw * 0.22 - (camX * 0.15) % (cw * 1.2);
      const beamG = ctx.createLinearGradient(bx2, 0, bx2 + 30, ch * 0.65);
      beamG.addColorStop(0, 'rgba(255,235,180,0.10)'); beamG.addColorStop(1, 'rgba(255,235,180,0)');
      ctx.fillStyle = beamG;
      ctx.beginPath(); ctx.moveTo(bx2 - 10, 0); ctx.lineTo(bx2 + 40, 0); ctx.lineTo(bx2 + 70, ch * 0.65); ctx.lineTo(bx2 - 30, ch * 0.65); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    const treeDefs = [80, 240, 420, 620, 840, 1100, 1400, 1740, 2120, 2550];
    treeDefs.forEach((tx, i) => {
      const screenX = ((tx - camX * 0.15) % (cw + 500) + cw + 500) % (cw + 500) - 250;
      const tw = 18 + (i % 3) * 8;
      const th2 = ch * 0.5 + (i % 4) * ch * 0.06;
      ctx.fillStyle = 'rgba(30,15,8,0.6)';
      ctx.fillRect(screenX - tw / 4, ch * 0.5, tw / 2, ch * 0.5);
      ctx.fillStyle = `rgba(${20 + i % 3 * 10},${60 + i % 4 * 15},${20 + i % 3 * 8},0.55)`;
      ctx.beginPath(); ctx.ellipse(screenX, ch * 0.5 - th2 * 0.1, tw * 1.8, th2 * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(screenX - tw * 0.8, ch * 0.5 - th2 * 0.05, tw * 1.2, th2 * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(screenX + tw * 0.9, ch * 0.5 - th2 * 0.05, tw * 1.3, th2 * 0.28, 0, 0, Math.PI * 2); ctx.fill();
    });
    const vineDefs = [100, 280, 480, 700, 950, 1240, 1570, 1950, 2380];
    vineDefs.forEach((vx, i) => {
      const screenX = ((vx - camX * 0.4) % (cw + 300) + cw + 300) % (cw + 300) - 150;
      const vl = 60 + (i % 4) * 40;
      const sway = Math.sin(t * 1.2 + i * 0.9) * 8;
      ctx.strokeStyle = 'rgba(56,142,60,0.45)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(screenX, 0);
      ctx.bezierCurveTo(screenX + sway * 0.5, vl * 0.3, screenX + sway, vl * 0.7, screenX + sway * 0.8, vl);
      ctx.stroke();
      [0.25, 0.55, 0.85].forEach(pos => {
        ctx.fillStyle = 'rgba(76,175,80,0.4)';
        ctx.beginPath(); ctx.ellipse(screenX + sway * pos + Math.sin(pos * 5) * 6, vl * pos, 8, 4, pos * Math.PI, 0, Math.PI * 2); ctx.fill();
      });
      ctx.lineWidth = 1;
    });
    const mistG = ctx.createLinearGradient(0, ch * 0.72, 0, ch * 0.88);
    mistG.addColorStop(0, 'rgba(200,230,200,0)'); mistG.addColorStop(0.5, 'rgba(200,230,200,0.06)'); mistG.addColorStop(1, 'rgba(200,230,200,0)');
    ctx.fillStyle = mistG; ctx.fillRect(0, ch * 0.72, cw, ch * 0.16);
  } else if (theme === 'cloud') {
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#1565c0'); grad.addColorStop(0.35, '#42a5f5');
    grad.addColorStop(0.65, '#b3e5fc'); grad.addColorStop(1, '#e1f5fe');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, cw, ch);
    const starDefs2 = [40,100,175,265,375,490,620,760,920,1100,1300,1520,1760,2020,2310];
    starDefs2.forEach((sx2, i) => {
      const screenX = ((sx2 - camX * 0.04) % (cw + 100) + cw + 100) % (cw + 100) - 50;
      const sy2 = 12 + (i % 5) * 16;
      const blink = 0.2 + Math.abs(Math.sin(t * 2.5 + i * 1.7)) * 0.6;
      ctx.globalAlpha = blink; ctx.fillStyle = '#fff'; ctx.fillRect(screenX, sy2, 2, 2); ctx.globalAlpha = 1;
    });
    const bankOff = -(camX * 0.15);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = -1; i <= 2; i++) {
      const bx2 = bankOff + i * (cw + 300);
      ctx.beginPath();
      for (let bxi = 0; bxi < cw + 320; bxi += 48) {
        const bby = ch * 0.72 - Math.sin((bxi + t * 15) * 0.025) * 14;
        ctx.arc(bx2 + bxi, bby, 28, Math.PI, 0);
      }
      ctx.lineTo(bx2 + cw + 320, ch); ctx.lineTo(bx2, ch); ctx.closePath(); ctx.fill();
    }
    const midClouds = [60, 250, 480, 740, 1040, 1380, 1760, 2200];
    midClouds.forEach((cx2, i) => {
      const r = 32 + (i % 3) * 12;
      const cy2 = ch * 0.18 + (i % 4) * 30;
      const screenX = ((cx2 - camX * 0.35) % (cw + 400) + cw + 400) % (cw + 400) - 200;
      ctx.fillStyle = 'rgba(220,240,255,0.40)'; drawCloud(ctx, screenX + 5, cy2 + 5, r * 0.85);
      ctx.fillStyle = 'rgba(255,255,255,0.80)'; drawCloud(ctx, screenX, cy2, r);
    });
    if (Math.sin(t * 0.7) > 0.97) {
      ctx.fillStyle = 'rgba(200,220,255,0.12)'; ctx.fillRect(0, 0, cw, ch);
      const lx = cw * 0.5 + Math.sin(t * 100) * cw * 0.3;
      ctx.strokeStyle = 'rgba(200,220,255,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(lx, ch * 0.1); ctx.lineTo(lx - 10, ch * 0.35); ctx.lineTo(lx + 5, ch * 0.35); ctx.lineTo(lx - 15, ch * 0.6); ctx.stroke();
      ctx.lineWidth = 1;
    }
  }
}

// ── Plataformas ────────────────────────────────────────────────────────────────
function drawPlatform(ctx: CanvasRenderingContext2D, p: Platform, camX: number, theme: Theme) {
  const sx = p.x - camX;
  if (sx + p.w < -10 || sx > ctx.canvas.width + 10) return;
  const isMoving = p.spd > 0;

  if (theme === 'green') {
    const dGrad = ctx.createLinearGradient(sx, p.y, sx, p.y + p.h);
    dGrad.addColorStop(0, '#8d6e63'); dGrad.addColorStop(0.3, '#795548'); dGrad.addColorStop(1, '#4e342e');
    ctx.fillStyle = dGrad; ctx.fillRect(sx, p.y, p.w, p.h);
    const gGrad = ctx.createLinearGradient(sx, p.y, sx, p.y + 10);
    gGrad.addColorStop(0, '#81c784'); gGrad.addColorStop(0.5, '#4caf50'); gGrad.addColorStop(1, '#388e3c');
    ctx.fillStyle = gGrad; ctx.fillRect(sx, p.y, p.w, 8);
    ctx.fillStyle = '#a5d6a7';
    for (let i = 4; i < p.w - 4; i += 16) ctx.fillRect(sx + i, p.y, 4, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(sx, p.y + 8, 3, p.h - 8); ctx.fillRect(sx + p.w - 3, p.y + 8, 3, p.h - 8);
    ctx.fillStyle = 'rgba(100,60,40,0.4)';
    for (let i = 0; i < Math.floor(p.w / 30); i++) ctx.fillRect(sx + 10 + i * 28, p.y + 14, 4, 3);
  } else if (theme === 'cave') {
    const sGrad = ctx.createLinearGradient(sx, p.y, sx, p.y + p.h);
    sGrad.addColorStop(0, '#607d8b'); sGrad.addColorStop(0.4, '#546e7a'); sGrad.addColorStop(1, '#37474f');
    ctx.fillStyle = sGrad; ctx.fillRect(sx, p.y, p.w, p.h);
    const tGrad = ctx.createLinearGradient(sx, p.y, sx, p.y + 6);
    tGrad.addColorStop(0, '#78909c'); tGrad.addColorStop(1, '#546e7a');
    ctx.fillStyle = tGrad; ctx.fillRect(sx, p.y, p.w, 6);
    ctx.strokeStyle = 'rgba(38,50,56,0.6)'; ctx.lineWidth = 1;
    const brickH = 14;
    for (let row = 0; row * brickH < p.h; row++) {
      const by = p.y + row * brickH;
      ctx.beginPath(); ctx.moveTo(sx, by); ctx.lineTo(sx + p.w, by); ctx.stroke();
      const offset = (row % 2) * 20;
      for (let bx = offset; bx < p.w; bx += 40) {
        ctx.beginPath(); ctx.moveTo(sx + bx, by); ctx.lineTo(sx + bx, by + brickH); ctx.stroke();
      }
    }
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(56,142,60,0.35)';
    for (let i = 0; i < Math.floor(p.w / 40); i++) {
      ctx.beginPath(); ctx.ellipse(sx + 8 + i * 38, p.y + 2, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(sx, p.y, 2, p.h);
  } else if (theme === 'sky') {
    const cGrad = ctx.createLinearGradient(sx, p.y, sx, p.y + p.h);
    cGrad.addColorStop(0, '#fff'); cGrad.addColorStop(0.4, '#e3f2fd'); cGrad.addColorStop(1, '#bbdefb');
    ctx.fillStyle = cGrad; ctx.fillRect(sx, p.y, p.w, p.h);
    ctx.fillStyle = '#fff';
    const puffStep = 24;
    for (let px2 = 0; px2 < p.w; px2 += puffStep) {
      ctx.beginPath(); ctx.arc(sx + px2 + puffStep / 2, p.y - 2, puffStep * 0.45, Math.PI, 0); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(sx + 2, p.y, p.w - 4, 3);
    ctx.fillStyle = 'rgba(100,160,200,0.25)'; ctx.fillRect(sx, p.y + p.h - 4, p.w, 4);
  } else if (theme === 'sea') {
    const seaGrad = ctx.createLinearGradient(sx, p.y, sx, p.y + p.h);
    seaGrad.addColorStop(0, '#00838f'); seaGrad.addColorStop(0.3, '#006064'); seaGrad.addColorStop(1, '#004d40');
    ctx.fillStyle = seaGrad; ctx.fillRect(sx, p.y, p.w, p.h);
    const topG = ctx.createLinearGradient(sx, p.y, sx, p.y + 8);
    topG.addColorStop(0, '#f48fb1'); topG.addColorStop(0.5, '#e91e63'); topG.addColorStop(1, '#ad1457');
    ctx.fillStyle = topG; ctx.fillRect(sx, p.y, p.w, 7);
    ctx.fillStyle = '#f48fb1';
    for (let i = 6; i < p.w - 4; i += 14) { ctx.beginPath(); ctx.arc(sx + i, p.y, 4, Math.PI, 0); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(sx, p.y + 8, 3, p.h - 8);
    ctx.strokeStyle = 'rgba(0,188,212,0.35)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < Math.floor(p.w / 35); i++) {
      const wx = sx + 10 + i * 32;
      ctx.beginPath(); ctx.moveTo(wx, p.y + p.h); ctx.quadraticCurveTo(wx + 5, p.y + p.h * 0.5, wx, p.y + 8); ctx.stroke();
    }
    ctx.lineWidth = 1;
  } else if (theme === 'lava') {
    const lavaRockGrad = ctx.createLinearGradient(sx, p.y, sx, p.y + p.h);
    lavaRockGrad.addColorStop(0, '#4e342e'); lavaRockGrad.addColorStop(0.35, '#3e2723'); lavaRockGrad.addColorStop(1, '#1a0000');
    ctx.fillStyle = lavaRockGrad; ctx.fillRect(sx, p.y, p.w, p.h);
    const lavaTopG = ctx.createLinearGradient(sx, p.y, sx, p.y + 6);
    lavaTopG.addColorStop(0, '#ff5722'); lavaTopG.addColorStop(0.6, '#bf360c'); lavaTopG.addColorStop(1, '#3e2723');
    ctx.fillStyle = lavaTopG; ctx.fillRect(sx, p.y, p.w, 6);
    ctx.fillStyle = 'rgba(255,152,0,0.5)';
    for (let i = 8; i < p.w - 4; i += 22) { ctx.fillRect(sx + i, p.y + 1, 6, 2); }
    ctx.strokeStyle = 'rgba(255,87,34,0.30)'; ctx.lineWidth = 0.8;
    for (let i = 1; i < Math.floor(p.w / 30); i++) {
      const cx2 = sx + i * 28;
      ctx.beginPath(); ctx.moveTo(cx2, p.y + 6); ctx.lineTo(cx2 + 4, p.y + 18); ctx.stroke();
    }
    ctx.lineWidth = 1;
    const edgeG = ctx.createLinearGradient(sx, p.y, sx + 3, p.y);
    edgeG.addColorStop(0, 'rgba(255,87,34,0.25)'); edgeG.addColorStop(1, 'rgba(255,87,34,0)');
    ctx.fillStyle = edgeG; ctx.fillRect(sx, p.y + 6, 3, p.h - 6);
    const edgeG2 = ctx.createLinearGradient(sx + p.w - 3, p.y, sx + p.w, p.y);
    edgeG2.addColorStop(0, 'rgba(255,87,34,0)'); edgeG2.addColorStop(1, 'rgba(255,87,34,0.25)');
    ctx.fillStyle = edgeG2; ctx.fillRect(sx + p.w - 3, p.y + 6, 3, p.h - 6);
  } else if (theme === 'jungle') {
    const barkGrad = ctx.createLinearGradient(sx, p.y, sx + p.w, p.y + p.h);
    barkGrad.addColorStop(0, '#6d4c41'); barkGrad.addColorStop(0.4, '#5d4037'); barkGrad.addColorStop(1, '#4e342e');
    ctx.fillStyle = barkGrad; ctx.fillRect(sx, p.y, p.w, p.h);
    const mossG = ctx.createLinearGradient(sx, p.y, sx, p.y + 9);
    mossG.addColorStop(0, '#81c784'); mossG.addColorStop(0.5, '#4caf50'); mossG.addColorStop(1, '#2e7d32');
    ctx.fillStyle = mossG; ctx.fillRect(sx, p.y, p.w, 8);
    ctx.fillStyle = '#a5d6a7';
    for (let i = 3; i < p.w - 3; i += 11) { ctx.beginPath(); ctx.arc(sx + i + 3, p.y, 4, Math.PI, 0); ctx.fill(); }
    ctx.strokeStyle = 'rgba(60,30,10,0.3)'; ctx.lineWidth = 0.8;
    for (let i = 1; i < Math.floor(p.w / 24); i++) {
      const lx = sx + i * 22;
      ctx.beginPath(); ctx.moveTo(lx, p.y + 8); ctx.lineTo(lx + 2, p.y + p.h); ctx.stroke();
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(76,175,80,0.50)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sx + 8, p.y + p.h); ctx.quadraticCurveTo(sx + 4, p.y + p.h + 16, sx + 10, p.y + p.h + 30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx + p.w - 8, p.y + p.h); ctx.quadraticCurveTo(sx + p.w - 4, p.y + p.h + 12, sx + p.w - 12, p.y + p.h + 26); ctx.stroke();
    ctx.lineWidth = 1;
  } else if (theme === 'cloud') {
    const cloudPlatGrad = ctx.createLinearGradient(sx, p.y, sx, p.y + p.h);
    cloudPlatGrad.addColorStop(0, '#ffffff'); cloudPlatGrad.addColorStop(0.3, '#e3f2fd'); cloudPlatGrad.addColorStop(1, '#bbdefb');
    ctx.fillStyle = cloudPlatGrad; ctx.fillRect(sx, p.y, p.w, p.h);
    ctx.fillStyle = '#fff';
    const puffStep2 = 28;
    for (let px2 = 0; px2 < p.w + puffStep2; px2 += puffStep2) {
      ctx.beginPath(); ctx.arc(sx + px2, p.y - 3, puffStep2 * 0.52, Math.PI, 0); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let px2 = puffStep2 / 2; px2 < p.w; px2 += puffStep2) {
      ctx.beginPath(); ctx.arc(sx + px2, p.y + 2, puffStep2 * 0.32, Math.PI, 0); ctx.fill();
    }
    ctx.fillStyle = 'rgba(100,160,255,0.15)'; ctx.fillRect(sx, p.y + p.h - 3, p.w, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillRect(sx + 2, p.y, p.w - 4, 2);
  }

  if (isMoving) {
    ctx.strokeStyle = 'rgba(255,152,0,0.65)';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 1, p.y + 1, p.w - 2, p.h - 2);
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255,200,60,0.80)';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('◄ ►', sx + p.w / 2, p.y + p.h * 0.62);
    ctx.textAlign = 'left';
  }
}

// ── Jugador ────────────────────────────────────────────────────────────────────
function drawPlayer(ctx: CanvasRenderingContext2D, gs: GS, camX: number) {
  if (gs.invT > 0 && Math.floor(gs.elapsed * 8) % 2 === 0) return;

  const cx = gs.px - camX + PW / 2;
  const by = gs.py + PH;
  const fr = gs.afr;
  const ps = gs.ps;

  const sk = SKINS[gs.skin] ?? SKINS[0];
  const rb = gs.starPowerT > 0;
  const rc = (o: number) => rainbow(gs.elapsed * 1.5 + o);
  const cBody = rb ? rc(0) : sk.body, cBodyMid = rb ? rc(0.08) : sk.bodyMid, cBodyDk = rb ? rc(0.16) : sk.bodyDk;
  const cHat = rb ? rc(0.3) : sk.hat, cHatMid = rb ? rc(0.36) : sk.hatMid, cHatDk = rb ? rc(0.42) : sk.hatDk;
  const cCollar = rb ? rc(0.5) : sk.collar, cCollarDk = rb ? rc(0.56) : sk.collarDk;

  const legSwing = ps === 'run' ? (fr === 0 ? 3 : -3) : 0;
  const armY = ps === 'run' ? (fr === 0 ? 3 : -3) : (ps === 'jump' ? -6 : 0);

  let sqX = 1, sqY = 1;
  if (gs.sqT > 0) {
    const t = gs.sqT / 0.14;
    if (gs.sqDir === -1) { sqX = 1 + 0.38 * t; sqY = 1 - 0.30 * t; }
    else                 { sqX = 1 - 0.22 * t; sqY = 1 + 0.38 * t; }
  }

  ctx.save();
  ctx.translate(cx, by - 3);

  if (rb) {
    const glowR = 30 + Math.sin(gs.elapsed * 10) * 4;
    const g = ctx.createRadialGradient(0, -22, 0, 0, -22, glowR);
    g.addColorStop(0, `hsla(${(gs.elapsed * 180) % 360},90%,60%,0.5)`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, -22, glowR, 0, Math.PI * 2); ctx.fill();
  }

  ctx.scale(gs.fR ? sqX : -sqX, sqY);

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(0, 5, 14, 4, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#3e2723';
  rrect(ctx, -15, -5 + legSwing, 15, 7, 3);
  rrect(ctx, 0,  -5 - legSwing, 15, 7, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(-13, -4 + legSwing, 5, 2); ctx.fillRect(2, -4 - legSwing, 5, 2);

  const legGrad = ctx.createLinearGradient(-13, 0, 13, 0);
  legGrad.addColorStop(0, cBodyMid); legGrad.addColorStop(1, cBodyDk);
  ctx.fillStyle = legGrad;
  rrect(ctx, -13, -13 + legSwing, 12, 9, 2);
  rrect(ctx, 1, -13 - legSwing, 12, 9, 2);

  const armGradB = ctx.createLinearGradient(11, 0, 19, 0);
  armGradB.addColorStop(0, '#ffcc80'); armGradB.addColorStop(1, '#ffb74d');
  ctx.fillStyle = armGradB;
  rrect(ctx, 11, -22 - armY, 7, 12, 3);

  const bodyGrad = ctx.createLinearGradient(-14, -22, 14, -10);
  bodyGrad.addColorStop(0, cBody); bodyGrad.addColorStop(0.5, cBodyMid); bodyGrad.addColorStop(1, cBodyDk);
  ctx.fillStyle = bodyGrad;
  rrect(ctx, -14, -22, 28, 14, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-12, -22, 24, 3);
  ctx.fillStyle = cCollarDk; ctx.fillRect(-4, -22, 3, 4); ctx.fillRect(2, -22, 3, 4);

  const colGrad = ctx.createLinearGradient(-9, -24, 9, -20);
  colGrad.addColorStop(0, cCollar); colGrad.addColorStop(1, cCollarDk);
  ctx.fillStyle = colGrad;
  rrect(ctx, -9, -24, 18, 5, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-7, -24, 14, 2);

  const armGradF = ctx.createLinearGradient(-19, 0, -11, 0);
  armGradF.addColorStop(0, '#ffb74d'); armGradF.addColorStop(1, '#ffcc80');
  ctx.fillStyle = armGradF;
  rrect(ctx, -18, -22 + armY, 7, 12, 3);

  const faceGrad = ctx.createLinearGradient(-11, -37, 11, -20);
  faceGrad.addColorStop(0, '#ffd180'); faceGrad.addColorStop(0.6, '#ffcc80'); faceGrad.addColorStop(1, '#ffb74d');
  ctx.fillStyle = faceGrad;
  rrect(ctx, -11, -37, 22, 15, 4);
  ctx.fillStyle = 'rgba(255,100,100,0.22)';
  ctx.beginPath(); ctx.ellipse(-5, -25, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffb74d';
  ctx.beginPath(); ctx.ellipse(-11, -29, 3, 4, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#fff'; rrect(ctx, 2, -35, 9, 7, 2);
  ctx.fillStyle = 'rgba(100,60,30,0.25)'; ctx.fillRect(2, -35, 9, 2);
  ctx.fillStyle = '#1565c0'; ctx.beginPath(); ctx.arc(6, -31, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(6, -31, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(7.2, -32, 0.9, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#5d4037'; rrect(ctx, 1, -37, 10, 2, 1);

  ctx.fillStyle = '#e8a87c'; ctx.beginPath(); ctx.arc(2, -27, 2.2, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#4e342e';
  rrect(ctx, -3, -26, 7, 5, 2); rrect(ctx, 5, -26, 7, 5, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(-3, -26, 12, 2);

  const brimGrad = ctx.createLinearGradient(-16, -40, -16, -33);
  brimGrad.addColorStop(0, cHat); brimGrad.addColorStop(0.5, cHatMid); brimGrad.addColorStop(1, cHatDk);
  ctx.fillStyle = brimGrad; rrect(ctx, -16, -40, 32, 6, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-14, -40, 22, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(-14, -35, 28, 2);

  const hatGrad = ctx.createLinearGradient(-9, -55, 9, -40);
  hatGrad.addColorStop(0, cHat); hatGrad.addColorStop(0.4, cHatMid); hatGrad.addColorStop(1, cHatDk);
  ctx.fillStyle = hatGrad; rrect(ctx, -9, -55, 18, 16, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath(); ctx.ellipse(-2, -51, 5, 3, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(5, -55, 4, 16);

  ctx.fillStyle = cCollarDk; ctx.fillRect(-9, -41, 18, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(-9, -41, 18, 1);

  ctx.restore();
}

// ── Enemigos ───────────────────────────────────────────────────────────────────
function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, camX: number, elapsed: number) {
  const sx = e.x - camX;
  if (sx + e.w < -40 || sx > ctx.canvas.width + 40) return;
  const cx2 = sx + e.w / 2;
  const ey = e.y;

  if (!e.alive) {
    if (e.stompT <= 0) return;
    ctx.globalAlpha = Math.min(1, e.stompT * 2);
    ctx.fillStyle = '#8d6e63';
    ctx.beginPath();
    ctx.ellipse(cx2, ey + e.h * 0.9, e.w * 0.5, e.h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }

  if (e.type === 'worm') {
    ctx.save();
    if (e.vx > 0) {
      ctx.translate(sx + e.w / 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(sx + e.w / 2), 0);
    }
    const seg = 4;
    const segW = e.w / seg;
    const legT = e.fr === 0 ? 2 : -2;
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth = 2;
    for (let i = 0; i < seg; i++) {
      const bx = sx + i * segW + segW / 2;
      ctx.beginPath(); ctx.moveTo(bx - 4, ey + e.h); ctx.lineTo(bx - 6, ey + e.h + 4 + legT); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + 4, ey + e.h); ctx.lineTo(bx + 6, ey + e.h + 4 - legT); ctx.stroke();
    }
    ctx.lineWidth = 1;
    const segCols = ['#81c784','#66bb6a','#4caf50','#388e3c'];
    for (let i = seg - 1; i >= 0; i--) {
      const bx = sx + i * segW + segW / 2;
      const yOff = Math.sin(elapsed * 4 + i * 0.9) * 3;
      const sGrad = ctx.createRadialGradient(bx - 3, ey + e.h / 2 + yOff - 3, 1, bx, ey + e.h / 2 + yOff, segW * 0.55);
      sGrad.addColorStop(0, '#a5d6a7'); sGrad.addColorStop(1, segCols[i % 4]);
      ctx.fillStyle = sGrad;
      ctx.beginPath(); ctx.ellipse(bx, ey + e.h / 2 + yOff, segW * 0.52, e.h * 0.50, 0, 0, Math.PI * 2); ctx.fill();
      if (i < seg - 1) {
        ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(sx + (i + 1) * segW, ey + 3); ctx.lineTo(sx + (i + 1) * segW, ey + e.h - 3); ctx.stroke();
      }
    }
    const hx = sx + segW * 0.5;
    const hy = ey + e.h / 2 + Math.sin(elapsed * 4) * 3;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(hx - 4, hy - 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + 4, hy - 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(hx - 3, hy - 3, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + 5, hy - 3, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(hx - 2.5, hy - 4, 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + 5.5, hy - 4, 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(hx, hy + 1, 4, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.restore();
  } else if (e.type === 'spider') {
    ctx.save();
    if (e.vx > 0) { ctx.translate(sx + e.w / 2, 0); ctx.scale(-1, 1); ctx.translate(-(sx + e.w / 2), 0); }
    const bx = sx + e.w / 2;
    const abdY = ey + e.h * 0.60;
    const headY = ey + e.h * 0.28;
    ctx.strokeStyle = 'rgba(200,200,200,0.5)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(bx, ey - 20); ctx.lineTo(bx, ey + 4); ctx.stroke();
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 4; i++) {
      const legWave = Math.sin(elapsed * 6 + i * 1.5 + e.fr * Math.PI) * 5;
      const spread = 6 + i * 4;
      const midY = abdY - 4 + i * 2;
      ctx.strokeStyle = i % 2 === 0 ? '#263238' : '#37474f';
      ctx.beginPath(); ctx.moveTo(bx - 5, abdY - 2); ctx.quadraticCurveTo(bx - spread, midY + legWave, bx - spread - 8, abdY + 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + 5, abdY - 2); ctx.quadraticCurveTo(bx + spread, midY + legWave, bx + spread + 8, abdY + 4); ctx.stroke();
    }
    ctx.lineWidth = 1;
    const abdGrad = ctx.createRadialGradient(bx - 3, abdY - 3, 1, bx, abdY, 10);
    abdGrad.addColorStop(0, '#546e7a'); abdGrad.addColorStop(0.6, '#263238'); abdGrad.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = abdGrad;
    ctx.beginPath(); ctx.ellipse(bx, abdY, 11, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d32f2f';
    ctx.beginPath(); ctx.ellipse(bx, abdY - 3, 3, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(bx, abdY + 3, 3, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b71c1c'; ctx.fillRect(bx - 1, abdY - 2.5, 2, 6);
    const hGrad = ctx.createRadialGradient(bx - 2, headY - 2, 1, bx, headY, 7);
    hGrad.addColorStop(0, '#455a64'); hGrad.addColorStop(1, '#1c313a');
    ctx.fillStyle = hGrad;
    ctx.beginPath(); ctx.ellipse(bx, headY, 7.5, 7, 0, 0, Math.PI * 2); ctx.fill();
    const eyeRow = [[bx-5,bx-1,bx+3],[bx-4,bx,bx+4]];
    const eyeYs = [headY - 3, headY + 1];
    ctx.fillStyle = '#fff';
    eyeRow.forEach((row, ri) => { row.forEach(ex2 => { ctx.beginPath(); ctx.arc(ex2, eyeYs[ri], 1.5, 0, Math.PI * 2); ctx.fill(); }); });
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(bx - 5, headY - 3, 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e0e0e0';
    ctx.beginPath(); ctx.moveTo(bx - 3, headY + 5); ctx.lineTo(bx - 5, headY + 10); ctx.lineTo(bx - 1, headY + 6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx + 1, headY + 5); ctx.lineTo(bx + 3, headY + 10); ctx.lineTo(bx + 5, headY + 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#76ff03';
    ctx.beginPath(); ctx.arc(bx - 4, headY + 9.5, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (e.type === 'monkey') {
    ctx.save();
    if (e.vx > 0) { ctx.translate(sx + e.w / 2, 0); ctx.scale(-1, 1); ctx.translate(-(sx + e.w / 2), 0); }
    const bx = sx + e.w / 2;
    const footY = ey + e.h;
    const legSwing = e.fr === 0 ? 5 : -5;
    ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx + 8, ey + e.h * 0.45);
    ctx.bezierCurveTo(bx + 22, ey + e.h * 0.35, bx + 24, ey + e.h * 0.15, bx + 16, ey + e.h * 0.05);
    ctx.stroke();
    ctx.lineWidth = 1; ctx.lineCap = 'butt';
    ctx.fillStyle = '#795548';
    rrect(ctx, sx + 3, footY - 14 + legSwing, 9, 14, 3);
    rrect(ctx, sx + e.w - 12, footY - 14 - legSwing, 9, 14, 3);
    ctx.fillStyle = '#5d4037';
    rrect(ctx, sx + 1, footY - 5 + legSwing, 12, 6, 3);
    rrect(ctx, sx + e.w - 13, footY - 5 - legSwing, 12, 6, 3);
    const bodyGrad = ctx.createLinearGradient(sx, ey + e.h * 0.35, sx + e.w, ey + e.h * 0.65);
    bodyGrad.addColorStop(0, '#a1887f'); bodyGrad.addColorStop(0.5, '#8d6e63'); bodyGrad.addColorStop(1, '#795548');
    ctx.fillStyle = bodyGrad;
    rrect(ctx, sx + 2, ey + e.h * 0.38, e.w - 4, e.h * 0.40, 6);
    const armSw = -legSwing * 0.7;
    ctx.fillStyle = '#8d6e63';
    rrect(ctx, sx - 4, ey + e.h * 0.38 + armSw, 8, 12, 3);
    rrect(ctx, sx + e.w - 4, ey + e.h * 0.38 - armSw, 8, 12, 3);
    ctx.fillStyle = '#ffcc80';
    ctx.beginPath(); ctx.ellipse(sx - 1, ey + e.h * 0.38 + armSw + 12, 4, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx + e.w - 1, ey + e.h * 0.38 - armSw + 12, 4, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    const headGrad = ctx.createRadialGradient(bx - 3, ey + e.h * 0.16, 2, bx, ey + e.h * 0.20, 12);
    headGrad.addColorStop(0, '#bcaaa4'); headGrad.addColorStop(1, '#8d6e63');
    ctx.fillStyle = headGrad;
    ctx.beginPath(); ctx.ellipse(bx, ey + e.h * 0.22, 12, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#795548';
    ctx.beginPath(); ctx.ellipse(bx - 11, ey + e.h * 0.20, 5, 6, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(bx + 11, ey + e.h * 0.20, 5, 6, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffcc80';
    ctx.beginPath(); ctx.ellipse(bx - 11, ey + e.h * 0.22, 3, 4, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(bx + 11, ey + e.h * 0.22, 3, 4, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d7ccc8';
    ctx.beginPath(); ctx.ellipse(bx + 1, ey + e.h * 0.28, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#795548';
    ctx.beginPath(); ctx.arc(bx - 2, ey + e.h * 0.28, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 4, ey + e.h * 0.28, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    rrect(ctx, bx - 9, ey + e.h * 0.15, 7, 6, 2); rrect(ctx, bx + 2, ey + e.h * 0.15, 7, 6, 2);
    ctx.fillStyle = '#4e342e';
    ctx.beginPath(); ctx.arc(bx - 5.5, ey + e.h * 0.17, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 5.5, ey + e.h * 0.17, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(bx - 4.5, ey + e.h * 0.15, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 6.5, ey + e.h * 0.15, 0.9, 0, Math.PI * 2); ctx.fill();
    const mouthOpen = 2 + Math.sin(elapsed * 3) * 1;
    ctx.fillStyle = '#5d4037';
    ctx.beginPath(); ctx.arc(bx + 1, ey + e.h * 0.30 + mouthOpen, 5, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx - 3, ey + e.h * 0.30, 3, 2); ctx.fillRect(bx + 1, ey + e.h * 0.30, 3, 2);
    ctx.restore();
  } else if (e.type === 'plant') {
    const bx = sx + e.w / 2;
    const mouthOpen = Math.max(0, Math.sin(elapsed * 2.5)) * 14;
    const sway = Math.sin(elapsed * 1.5) * 4;
    const potGrad = ctx.createLinearGradient(sx + 2, ey + e.h - 14, sx + e.w - 2, ey + e.h);
    potGrad.addColorStop(0, '#a1887f'); potGrad.addColorStop(1, '#6d4c41');
    ctx.fillStyle = potGrad; rrect(ctx, sx + 2, ey + e.h - 14, e.w - 4, 14, 3);
    ctx.fillStyle = '#8d6e63'; ctx.fillRect(sx, ey + e.h - 14, e.w, 4);
    ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx, ey + e.h - 14);
    ctx.bezierCurveTo(bx + sway * 0.5, ey + e.h - 24, bx + sway, ey + 24, bx + sway, ey + 22);
    ctx.stroke();
    ctx.lineWidth = 1; ctx.lineCap = 'butt';
    ctx.fillStyle = '#388e3c';
    ctx.save(); ctx.translate(bx - 4 + sway * 0.5, ey + e.h * 0.55); ctx.rotate(-0.6 + sway * 0.05);
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(bx + 4 + sway * 0.5, ey + e.h * 0.48); ctx.rotate(0.7 + sway * 0.05);
    ctx.fillStyle = '#43a047';
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    const headCY = ey + 16 + sway * 0.3;
    const headGrad2 = ctx.createRadialGradient(bx - 3, headCY - 4, 2, bx, headCY, 12);
    headGrad2.addColorStop(0, '#66bb6a'); headGrad2.addColorStop(0.6, '#43a047'); headGrad2.addColorStop(1, '#2e7d32');
    ctx.fillStyle = headGrad2;
    ctx.beginPath(); ctx.ellipse(bx + sway * 0.3, headCY, 12, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a5d6a7';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px2 = (bx + sway * 0.3) + Math.cos(a) * 13;
      const py2 = headCY + Math.sin(a) * 12;
      ctx.beginPath(); ctx.ellipse(px2, py2, 4, 3, a, 0, Math.PI * 2); ctx.fill();
    }
    const mouthY = headCY + 3;
    const upperGrad = ctx.createLinearGradient(bx - 10, mouthY - mouthOpen, bx + 10, mouthY);
    upperGrad.addColorStop(0, '#e53935'); upperGrad.addColorStop(1, '#b71c1c');
    ctx.fillStyle = upperGrad;
    ctx.beginPath(); ctx.arc(bx + sway * 0.3, mouthY - mouthOpen / 2, 10, Math.PI, 0); ctx.fill();
    const lowerGrad = ctx.createLinearGradient(bx - 10, mouthY, bx + 10, mouthY + mouthOpen);
    lowerGrad.addColorStop(0, '#c62828'); lowerGrad.addColorStop(1, '#e53935');
    ctx.fillStyle = lowerGrad;
    ctx.beginPath(); ctx.arc(bx + sway * 0.3, mouthY + mouthOpen / 2, 10, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#fffde7';
    for (let t2 = -6; t2 <= 6; t2 += 4) {
      ctx.beginPath(); ctx.moveTo(bx + sway * 0.3 + t2 - 2, mouthY - mouthOpen / 2); ctx.lineTo(bx + sway * 0.3 + t2, mouthY - mouthOpen / 2 + 5); ctx.lineTo(bx + sway * 0.3 + t2 + 2, mouthY - mouthOpen / 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx + sway * 0.3 + t2 - 2, mouthY + mouthOpen / 2); ctx.lineTo(bx + sway * 0.3 + t2, mouthY + mouthOpen / 2 - 5); ctx.lineTo(bx + sway * 0.3 + t2 + 2, mouthY + mouthOpen / 2); ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(bx - 5 + sway * 0.3, headCY - 5, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 5 + sway * 0.3, headCY - 5, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e53935';
    ctx.beginPath(); ctx.arc(bx - 5 + sway * 0.3, headCY - 5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 5 + sway * 0.3, headCY - 5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1b5e20';
    ctx.save(); ctx.translate(bx - 5 + sway * 0.3, headCY - 10); ctx.rotate(-0.4); ctx.fillRect(-5, 0, 10, 2); ctx.restore();
    ctx.save(); ctx.translate(bx + 5 + sway * 0.3, headCY - 10); ctx.rotate(0.4); ctx.fillRect(-5, 0, 10, 2); ctx.restore();
  } else {
    ctx.save();
    if (e.vx > 0) { ctx.translate(sx + e.w / 2, 0); ctx.scale(-1, 1); ctx.translate(-(sx + e.w / 2), 0); }
    const bx = sx + e.w / 2;
    const footY = ey + e.h;
    const legSw = e.fr === 0 ? 3 : -3;
    const bodyC = ey + e.h * 0.60;
    const headCX = bx - 7;
    const headCY = ey + e.h * 0.30;
    const spRoot = { x: bx + 3, y: bodyC - 6 };

    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(bx, footY + 2, 14, 4, 0, 0, Math.PI * 2); ctx.fill();

    const quills = [
      { a:-1.35,l:9 },{ a:-1.1,l:13 },{ a:-0.85,l:15 },{ a:-0.60,l:16 },
      { a:-0.35,l:16 },{ a:-0.10,l:15 },{ a: 0.15,l:14 },{ a: 0.40,l:13 },
      { a: 0.65,l:11 },{ a: 0.90,l: 9 },{ a: 1.15,l: 7 },
    ];
    ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    quills.forEach(({ a, l }) => {
      ctx.strokeStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.moveTo(spRoot.x + 1, spRoot.y + 1);
      ctx.lineTo(spRoot.x + 1 + Math.cos(a) * l, spRoot.y + 1 + Math.sin(a) * l);
      ctx.stroke();
    });
    ctx.lineWidth = 1.8;
    quills.forEach(({ a, l }) => {
      const tx = spRoot.x + Math.cos(a) * l, ty = spRoot.y + Math.sin(a) * l;
      const qG = ctx.createLinearGradient(spRoot.x, spRoot.y, tx, ty);
      qG.addColorStop(0, '#3e2723'); qG.addColorStop(0.55, '#795548'); qG.addColorStop(1, '#f5f5f5');
      ctx.strokeStyle = qG;
      ctx.beginPath(); ctx.moveTo(spRoot.x, spRoot.y); ctx.lineTo(tx, ty); ctx.stroke();
    });
    ctx.lineWidth = 1; ctx.lineCap = 'butt';

    ctx.fillStyle = '#4e342e';
    rrect(ctx, sx + 2, footY - 7 + legSw, 10, 7, 3);
    rrect(ctx, sx + e.w - 12, footY - 7 - legSw, 10, 7, 3);
    ctx.fillStyle = '#3e2723';
    [2, 5, 8].forEach(ox => ctx.fillRect(sx + ox, footY - 1 + legSw, 2, 2));
    [sx + e.w - 12, sx + e.w - 9, sx + e.w - 6].forEach(ox => ctx.fillRect(ox, footY - 1 - legSw, 2, 2));

    const bellyG = ctx.createRadialGradient(bx - 3, bodyC - 2, 2, bx, bodyC, 13);
    bellyG.addColorStop(0, '#d7ccc8'); bellyG.addColorStop(0.5, '#a1887f'); bellyG.addColorStop(1, '#6d4c41');
    ctx.fillStyle = bellyG;
    ctx.beginPath(); ctx.ellipse(bx, bodyC, 13, 10, 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(80,40,20,0.12)'; ctx.lineWidth = 0.8;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(bx + i * 3, bodyC - 8); ctx.lineTo(bx + i * 3, bodyC + 8); ctx.stroke();
    }
    ctx.lineWidth = 1;

    const hG = ctx.createRadialGradient(headCX - 3, headCY - 3, 1, headCX, headCY, 11);
    hG.addColorStop(0, '#efebe9'); hG.addColorStop(0.5, '#d7ccc8'); hG.addColorStop(1, '#8d6e63');
    ctx.fillStyle = hG;
    ctx.beginPath(); ctx.ellipse(headCX, headCY, 11, 10, -0.1, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#a1887f';
    ctx.beginPath(); ctx.ellipse(headCX + 5, headCY - 9, 4.5, 5.5, 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fce4ec';
    ctx.beginPath(); ctx.ellipse(headCX + 5, headCY - 8, 2.2, 3.2, 0.25, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#efebe9';
    ctx.beginPath(); ctx.ellipse(headCX - 10, headCY + 3, 6, 4.5, -0.15, 0, Math.PI * 2); ctx.fill();
    const nG = ctx.createRadialGradient(headCX - 15, headCY + 1.5, 0, headCX - 15, headCY + 2, 3.5);
    nG.addColorStop(0, '#f48fb1'); nG.addColorStop(1, '#e91e63');
    ctx.fillStyle = nG;
    ctx.beginPath(); ctx.arc(headCX - 15, headCY + 2, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.arc(headCX - 16, headCY + 1, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(headCX - 14, headCY + 1, 1, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = 'rgba(200,200,200,0.75)'; ctx.lineWidth = 0.7; ctx.lineCap = 'round';
    [[-0.25,-7],[-0.05,-6],[0.05,-6],[0.25,-7]].forEach(([ang, len]) => {
      ctx.beginPath();
      ctx.moveTo(headCX - 10, headCY + 2);
      ctx.lineTo(headCX - 10 + Math.cos(Math.PI + ang) * len, headCY + 2 + Math.sin(Math.PI + ang) * len);
      ctx.stroke();
    });
    ctx.lineWidth = 1; ctx.lineCap = 'butt';

    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(headCX - 1, headCY - 4, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a237e';
    ctx.beginPath(); ctx.arc(headCX - 1, headCY - 4, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(headCX - 1, headCY - 4, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(headCX + 0.5, headCY - 5.5, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(headCX - 2.5, headCY - 2.5, 0.6, 0, Math.PI * 2); ctx.fill();

    const pulse = 0.6 + Math.abs(Math.sin(elapsed * 5)) * 0.4;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#d32f2f';
    ctx.beginPath(); ctx.arc(bx + 5, ey - 13, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffcdd2';
    ctx.beginPath(); ctx.arc(bx + 5, ey - 13, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d32f2f'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx + 2, ey - 16); ctx.lineTo(bx + 8, ey - 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx + 8, ey - 16); ctx.lineTo(bx + 2, ey - 10); ctx.stroke();
    ctx.lineCap = 'butt'; ctx.lineWidth = 1; ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// ── Monedas y pinchos ──────────────────────────────────────────────────────────
function drawCoin(ctx: CanvasRenderingContext2D, c: Coin, camX: number, elapsed: number) {
  if (c.got) return;
  const sx = c.x - camX;
  if (sx < -24 || sx > ctx.canvas.width + 24) return;
  const bob = Math.sin(elapsed * 3 + c.x * 0.01) * 4;
  const cy = c.y + bob;
  const spinW = Math.abs(Math.cos(elapsed * 4 + c.x * 0.005));
  const rX = 10 * (0.2 + spinW * 0.8);
  const rY = 10;

  const glow = ctx.createRadialGradient(sx, cy, 0, sx, cy, 18);
  glow.addColorStop(0, 'rgba(255,215,0,0.35)'); glow.addColorStop(1, 'rgba(255,215,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(sx - 20, cy - 20, 40, 40);

  ctx.fillStyle = '#e65100';
  ctx.beginPath(); ctx.ellipse(sx + 1, cy + 1, rX, rY, 0, 0, Math.PI * 2); ctx.fill();

  const cGrad = ctx.createLinearGradient(sx - rX, cy - rY, sx + rX, cy + rY);
  cGrad.addColorStop(0, '#ffe57f'); cGrad.addColorStop(0.4, '#ffd700'); cGrad.addColorStop(1, '#ffa000');
  ctx.fillStyle = cGrad;
  ctx.beginPath(); ctx.ellipse(sx, cy, rX, rY, 0, 0, Math.PI * 2); ctx.fill();

  if (rX > 4) {
    ctx.strokeStyle = '#e65100'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(sx, cy, rX * 0.65, rY * 0.65, 0, 0, Math.PI * 2); ctx.stroke();
  }
  if (rX > 5) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(sx - rX * 0.2, cy - rY * 0.3, rX * 0.3, rY * 0.25, -0.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineWidth = 1;
}

function drawSpike(ctx: CanvasRenderingContext2D, sp: Spike, camX: number, theme: Theme) {
  const sx = sp.x - camX;
  if (sx + sp.w < -10 || sx > ctx.canvas.width + 10) return;
  const count = Math.max(1, Math.floor(sp.w / 12));
  const col = theme === 'cave' ? '#90a4ae' : '#ce93d8';
  const colDark = theme === 'cave' ? '#546e7a' : '#7b1fa2';
  for (let i = 0; i < count; i++) {
    const tx = sx + i * 12, tipX = tx + 6, tipY = sp.y - 18;
    ctx.fillStyle = colDark;
    ctx.beginPath(); ctx.moveTo(tx + 1, sp.y); ctx.lineTo(tx + 11, sp.y); ctx.lineTo(tipX + 1, tipY + 3); ctx.closePath(); ctx.fill();
    const spGrad = ctx.createLinearGradient(tx, sp.y, tipX, tipY);
    spGrad.addColorStop(0, colDark); spGrad.addColorStop(0.5, col); spGrad.addColorStop(1, '#fff');
    ctx.fillStyle = spGrad;
    ctx.beginPath(); ctx.moveTo(tx, sp.y); ctx.lineTo(tx + 12, sp.y); ctx.lineTo(tipX, tipY); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(tipX - 1, tipY + 2); ctx.lineTo(tx + 3, sp.y - 1); ctx.stroke();
  }
  ctx.lineWidth = 1;
}

// ── Meta (bandera) ─────────────────────────────────────────────────────────────
function drawGoal(ctx: CanvasRenderingContext2D, gX: number, gY: number, camX: number, elapsed: number) {
  const sx = gX - camX;
  if (sx < -80 || sx > ctx.canvas.width + 80) return;
  const wave = Math.sin(elapsed * 4) * 7;

  const poleGrad = ctx.createLinearGradient(sx - 3, gY - 90, sx + 3, gY);
  poleGrad.addColorStop(0, '#bdbdbd'); poleGrad.addColorStop(0.5, '#9e9e9e'); poleGrad.addColorStop(1, '#616161');
  ctx.fillStyle = poleGrad; ctx.fillRect(sx - 3, gY - 90, 6, 90);
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(sx - 1, gY - 90, 2, 90);

  const ballGrad = ctx.createRadialGradient(sx - 2, gY - 94, 1, sx, gY - 92, 6);
  ballGrad.addColorStop(0, '#fff9c4'); ballGrad.addColorStop(1, '#f9a825');
  ctx.fillStyle = ballGrad;
  ctx.beginPath(); ctx.arc(sx, gY - 92, 6, 0, Math.PI * 2); ctx.fill();

  const flagW = 48, flagH = 28;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(sx + 3, gY - 88);
  ctx.bezierCurveTo(sx + 20 + wave, gY - 84, sx + 40 + wave * 0.7, gY - 80, sx + flagW + wave * 0.5, gY - 74);
  ctx.bezierCurveTo(sx + 40 + wave * 0.7, gY - 72, sx + 20 + wave, gY - 68, sx + 3, gY - 62);
  ctx.closePath();
  ctx.clip();
  const cols = 4, rows = 2;
  const cw2 = flagW / cols, ch2 = flagH / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#fff' : '#212121';
      ctx.fillRect(sx + 3 + c * cw2 + wave * 0.15, gY - 88 + r * ch2, cw2 + 2, ch2 + 1);
    }
  }
  ctx.restore();

  const baseGrad = ctx.createLinearGradient(sx - 14, gY - 8, sx + 14, gY);
  baseGrad.addColorStop(0, '#9e9e9e'); baseGrad.addColorStop(1, '#616161');
  ctx.fillStyle = baseGrad;
  rrect(ctx, sx - 14, gY - 8, 28, 8, 4);

  const baseGlow = ctx.createRadialGradient(sx, gY, 0, sx, gY, 30);
  baseGlow.addColorStop(0, 'rgba(100,255,100,0.25)'); baseGlow.addColorStop(1, 'rgba(100,255,100,0)');
  ctx.fillStyle = baseGlow; ctx.fillRect(sx - 35, gY - 35, 70, 40);
}

// ── Checkpoint ─────────────────────────────────────────────────────────────────
function drawCheckpoint(ctx: CanvasRenderingContext2D, x: number, gY: number, camX: number, activated: boolean, t: number) {
  const sx = x - camX;
  if (sx < -70 || sx > ctx.canvas.width + 70) return;

  const col   = activated ? '#00e676' : '#ffeb3b';
  const colDk = activated ? '#00796b' : '#f57f17';
  const pulse = 1 + Math.sin(t * (activated ? 4 : 2)) * (activated ? 0.18 : 0.07);

  const aura = ctx.createRadialGradient(sx, gY - 88, 0, sx, gY - 88, 28 * pulse);
  aura.addColorStop(0, activated ? 'rgba(0,230,118,0.45)' : 'rgba(255,235,59,0.30)');
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = aura;
  ctx.fillRect(sx - 32, gY - 118, 64, 64);

  const pGrad = ctx.createLinearGradient(sx - 4, gY - 80, sx + 4, gY);
  pGrad.addColorStop(0, col);
  pGrad.addColorStop(0.4, colDk);
  pGrad.addColorStop(1, '#4e342e');
  ctx.fillStyle = pGrad;
  rrect(ctx, sx - 3, gY - 80, 6, 80, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(sx - 1, gY - 78, 2, 75);

  const baseGrad = ctx.createLinearGradient(sx - 14, gY - 10, sx + 14, gY);
  baseGrad.addColorStop(0, colDk);
  baseGrad.addColorStop(1, '#3e2723');
  ctx.fillStyle = baseGrad;
  rrect(ctx, sx - 14, gY - 10, 28, 10, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(sx - 12, gY - 10, 20, 3);

  ctx.save();
  ctx.translate(sx, gY - 90);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI / 5) - Math.PI / 2;
    const r = i % 2 === 0 ? 13 : 5.5;
    i === 0 ? ctx.moveTo(Math.cos(a)*r+1, Math.sin(a)*r+1) : ctx.lineTo(Math.cos(a)*r+1, Math.sin(a)*r+1);
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI / 5) - Math.PI / 2;
    const r = i % 2 === 0 ? 13 : 5.5;
    i === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = colDk; ctx.lineWidth = 1.8; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath(); ctx.arc(-2, -4, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.fillStyle = activated ? '#00695c' : '#795548';
  ctx.font = `bold ${activated ? 10 : 9}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(activated ? '✓ OK' : 'CK', sx, gY - 14);
  ctx.textAlign = 'left';
}

// ── Proyectiles y bolas de fuego ───────────────────────────────────────────────
function drawProjectiles(ctx: CanvasRenderingContext2D, projs: Projectile[], camX: number) {
  for (const p of projs) {
    const sx = p.x - camX;
    if (sx < -20 || sx > ctx.canvas.width + 20) continue;
    const alpha = Math.min(1, p.life * 1.5);
    ctx.globalAlpha = alpha;

    const trailLen = Math.min(18, Math.abs(p.vx) * 0.06);
    const trailGrad = ctx.createLinearGradient(sx - Math.sign(p.vx) * trailLen, p.y, sx, p.y);
    trailGrad.addColorStop(0, 'rgba(100,200,80,0)');
    trailGrad.addColorStop(1, 'rgba(100,200,80,0.5)');
    ctx.fillStyle = trailGrad;
    ctx.beginPath();
    ctx.ellipse(sx - Math.sign(p.vx) * trailLen / 2, p.y, trailLen / 2 + 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const glow = ctx.createRadialGradient(sx - 1, p.y - 1, 0, sx, p.y, 8);
    glow.addColorStop(0, '#c5e1a5');
    glow.addColorStop(0.5, '#8bc34a');
    glow.addColorStop(1, '#33691e');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, p.y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(sx - 2, p.y - 2, 2, 0, Math.PI * 2);
    ctx.fill();

    const angle = p.x * 0.1 + p.y * 0.05;
    ctx.strokeStyle = '#33691e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(angle) * 3, p.y + Math.sin(angle) * 3);
    ctx.lineTo(sx - Math.cos(angle) * 3, p.y - Math.sin(angle) * 3);
    ctx.stroke();
    ctx.lineWidth = 1;
  }
  ctx.globalAlpha = 1;
}

function drawFireballs(ctx: CanvasRenderingContext2D, fbs: Fireball[], camX: number) {
  const t = performance.now() / 1000;
  for (const fb of fbs) {
    const sx = fb.x - camX;
    if (sx < -20 || sx > ctx.canvas.width + 20) continue;
    const alpha = Math.min(1, fb.life * 1.8);
    ctx.globalAlpha = alpha;
    const wob = Math.sin(t * 20 + fb.x * 0.1) * 1.5;
    ctx.save();
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#ff6f00';
    const g = ctx.createRadialGradient(sx + fb.vx * -0.03, fb.y + wob, 1, sx, fb.y + wob, 9);
    g.addColorStop(0, '#fff59d');
    g.addColorStop(0.4, '#ff7043');
    g.addColorStop(1, '#d84315');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, fb.y + wob, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(sx - 2, fb.y + wob - 2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawStarCoin(ctx: CanvasRenderingContext2D, sc: StarCoin, camX: number, t: number) {
  if (sc.got) return;
  const sx = sc.x - camX;
  if (sx < -30 || sx > ctx.canvas.width + 30) return;
  const cy = sc.y + Math.sin(t * 3) * 4;
  const glow = ctx.createRadialGradient(sx, cy, 0, sx, cy, 26);
  glow.addColorStop(0, `hsla(${(t * 200) % 360},90%,62%,0.55)`);
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(sx - 28, cy - 28, 56, 56);
  ctx.save();
  ctx.translate(sx, cy);
  ctx.rotate(t * 2);
  const pulse = 1 + Math.sin(t * 8) * 0.1;
  ctx.scale(pulse, pulse);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI / 5) - Math.PI / 2;
    const r = i % 2 === 0 ? 12 : 5;
    i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  const sg = ctx.createLinearGradient(-12, -12, 12, 12);
  sg.addColorStop(0, '#fff59d'); sg.addColorStop(0.5, '#ffd700'); sg.addColorStop(1, '#ff6f00');
  ctx.fillStyle = sg; ctx.fill();
  ctx.strokeStyle = '#e65100'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.arc(-3, -3, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.lineWidth = 1;
}

// ── Mensaje flotante sobre el jugador ──────────────────────────────────────────
function drawMessage(ctx: CanvasRenderingContext2D, gs: GS, camX: number) {
  if (gs.msgT <= 0) return;
  const alpha = Math.min(1, gs.msgT * 3);
  const yOff = (1 - gs.msgT / 0.8) * 35;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffeb3b';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(gs.msg, gs.px - camX + PW / 2, gs.py - 10 - yOff);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// ── Orquestación del mundo ─────────────────────────────────────────────────────
export function drawWorld(ctx: CanvasRenderingContext2D, gs: GS, cw: number, ch: number) {
  const camX = gs.camX;
  drawBackground(ctx, cw, ch, gs.theme, camX, gs.elapsed);
  for (const p of gs.plats) drawPlatform(ctx, p, camX, gs.theme);
  for (const sp of gs.sps) drawSpike(ctx, sp, camX, gs.theme);
  for (let i = 0; i < gs.ckList.length; i++) drawCheckpoint(ctx, gs.ckList[i], gs.gY, camX, i < gs.nextCk, gs.elapsed);
  drawGoal(ctx, gs.gX, gs.gY, camX, gs.elapsed);
  for (const c of gs.cns) drawCoin(ctx, c, camX, gs.elapsed);
  if (gs.starCoin) drawStarCoin(ctx, gs.starCoin, camX, gs.elapsed);
  for (const e of gs.ens) drawEnemy(ctx, e, camX, gs.elapsed);
  if (gs.phase !== 'dead' || gs.phT > 0) drawPlayer(ctx, gs, camX);
  drawProjectiles(ctx, gs.projs, camX);
  drawFireballs(ctx, gs.fbs, camX);
  drawParticles(ctx, gs.parts, camX);
  drawMessage(ctx, gs, camX);
}
