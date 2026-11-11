// Entry point: fonts, language, the 3D world and the title screen.
import '@fontsource/lilita-one/400.css';
import '@fontsource/lalezar/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import '@fontsource/cairo/700.css';
import './ui/style.css';
import { initLang, t, getLang } from './core/i18n';
import { App } from './ui/app';
import { book, invoiceLines } from './weddings/clients';
import { logoSVG } from './ui/logo';
import { showTitle } from './ui/title';
import { suspend } from './audio/audio';

async function boot() {
  initLang();
  // Loading screen: logo in the right language, a progress bar and a tip.
  const tipEl = document.getElementById('boot-tip'); const bar = document.getElementById('boot-bar') as HTMLElement | null; const logo = document.getElementById('boot-logo') as HTMLImageElement | null;
  // inline vector logo so it uses the game's chunky font once it loads
  if (logo) { const d = document.createElement('div'); d.style.width = 'min(380px,82vw)'; d.style.filter = 'drop-shadow(0 10px 16px rgba(0,0,0,.4))'; d.innerHTML = logoSVG(getLang()); logo.replaceWith(d); }
  if (tipEl) tipEl.textContent = t('tips.' + (1 + Math.floor(Math.random() * 10)));
  if (bar) bar.style.width = '45%';
  try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]); } catch {}
  const app = new App(document.getElementById('game') as HTMLCanvasElement);
  if (bar) bar.style.width = '100%';
  await new Promise((r) => setTimeout(r, 350));
  (window as any).__app = app; // used by automated tests
  (window as any).__dev = { book, invoiceLines };
  showTitle(app);
  document.getElementById('boot')?.remove();
  document.addEventListener('visibilitychange', () => suspend(document.hidden));
}
boot();

// Android back button: close the top menu if one is open (returns true when handled).
import { closeTop } from './ui/dom';
(window as any).__androidBack = () => { if (closeTop()) return true; const bc = (window as any).__buildClose; if (bc) { bc(); return true; } return false; };
