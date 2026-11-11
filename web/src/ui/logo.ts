// The game logo rebuilt as a clean vector (stays sharp at every size): gold rings, royal-blue plaque with a
// gold frame, chunky cream-and-gold title, pink ribbon. English and Arabic versions.
import { getLang } from '../core/i18n';

export function logoSVG(lang = getLang()): string {
  const ar = lang === 'ar';
  const l1 = ar ? 'قاعة الأفراح' : 'WEDDING HALL'; const l2 = ar ? 'المالك' : 'OWNER'; const l3 = ar ? 'قطب الأعمال' : 'TYCOON';
  const f = ar ? "'Lalezar', 'Lilita One', sans-serif" : "'Lilita One', 'Lalezar', sans-serif";
  return `<svg viewBox="0 0 600 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${l1} ${l2} ${l3}">
  <defs>
    <linearGradient id="lgGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2b0"/><stop offset=".45" stop-color="#f2c94c"/><stop offset="1" stop-color="#b9821c"/></linearGradient>
    <linearGradient id="lgBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f7fe8"/><stop offset=".55" stop-color="#1d4fb5"/><stop offset="1" stop-color="#112f7a"/></linearGradient>
    <linearGradient id="lgCream" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#fff3d6"/><stop offset="1" stop-color="#f1d79a"/></linearGradient>
    <linearGradient id="lgPink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6f8f"/><stop offset="1" stop-color="#d81b4a"/></linearGradient>
    <filter id="lgShadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="5" stdDeviation="2" flood-color="#0a1a4a" flood-opacity=".55"/></filter>
  </defs>
  <g transform="translate(300 52)">
    <circle cx="-22" cy="0" r="30" fill="none" stroke="url(#lgGold)" stroke-width="13"/><circle cx="22" cy="0" r="30" fill="none" stroke="url(#lgGold)" stroke-width="13"/>
    <circle cx="-22" cy="0" r="30" fill="none" stroke="#fff6cf" stroke-width="3" opacity=".7"/><path d="M-6 -24 l8 -14 8 14z" fill="#e8f4ff" stroke="#fff" stroke-width="2"/>
  </g>
  <path d="M40 110 Q300 70 560 110 L540 250 Q300 225 60 250 Z" fill="url(#lgBlue)" stroke="url(#lgGold)" stroke-width="12" filter="url(#lgShadow)"/>
  <path d="M58 122 Q300 86 542 122" fill="none" stroke="#7fb0ff" stroke-width="4" opacity=".6"/>
  <text x="300" y="${ar ? 175 : 172}" text-anchor="middle" font-family="${f}" font-size="${ar ? 66 : 64}" fill="url(#lgCream)" stroke="#7a4b0a" stroke-width="4" paint-order="stroke" filter="url(#lgShadow)">${l1}</text>
  <text x="300" y="${ar ? 228 : 226}" text-anchor="middle" font-family="${f}" font-size="${ar ? 52 : 50}" fill="url(#lgGold)" stroke="#5a3200" stroke-width="4" paint-order="stroke">${l2}</text>
  <path d="M30 262 L90 248 L80 280 L95 312 L30 300 L48 282 Z" fill="#a8123a"/><path d="M570 262 L510 248 L520 280 L505 312 L570 300 L552 282 Z" fill="#a8123a"/>
  <path d="M80 245 Q300 220 520 245 L512 318 Q300 296 88 318 Z" fill="url(#lgPink)" stroke="url(#lgGold)" stroke-width="7" filter="url(#lgShadow)"/>
  <text x="300" y="${ar ? 300 : 302}" text-anchor="middle" font-family="${f}" font-size="${ar ? 54 : 62}" fill="#ffffff" stroke="#7a0d2c" stroke-width="5" paint-order="stroke">${l3}</text>
  <g transform="translate(300 332)"><circle cx="-12" cy="0" r="13" fill="none" stroke="url(#lgGold)" stroke-width="6"/><circle cx="12" cy="0" r="13" fill="none" stroke="url(#lgGold)" stroke-width="6"/></g>
</svg>`;
}
/** App icon: the gold rings on the royal-blue plaque (used for launcher icons). */
export function iconSVG(): string {
  return `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><defs>
  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2b0"/><stop offset=".45" stop-color="#f2c94c"/><stop offset="1" stop-color="#b9821c"/></linearGradient>
  <linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a8cf2"/><stop offset="1" stop-color="#112f7a"/></linearGradient></defs>
  <rect width="512" height="512" rx="110" fill="url(#b)"/><rect x="22" y="22" width="468" height="468" rx="92" fill="none" stroke="url(#g)" stroke-width="20"/>
  <circle cx="206" cy="270" r="96" fill="none" stroke="url(#g)" stroke-width="40"/><circle cx="306" cy="270" r="96" fill="none" stroke="url(#g)" stroke-width="40"/>
  <path d="M240 150 l16 -40 16 40 -16 18z" fill="#e8f4ff" stroke="#fff" stroke-width="6"/></svg>`;
}
