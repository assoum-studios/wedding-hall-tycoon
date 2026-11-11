// Entry point: fonts, language, the 3D world and the title screen.
import '@fontsource/lilita-one/400.css';
import '@fontsource/lalezar/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import '@fontsource/cairo/700.css';
import './ui/style.css';
import { initLang } from './core/i18n';
import { App } from './ui/app';
import { showTitle } from './ui/title';
import { suspend } from './audio/audio';

async function boot() {
  initLang();
  try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]); } catch {}
  const app = new App(document.getElementById('game') as HTMLCanvasElement);
  (window as any).__app = app; // used by automated tests
  showTitle(app);
  document.getElementById('boot')?.remove();
  document.addEventListener('visibilitychange', () => suspend(document.hidden));
}
boot();

// Android back button: close the top menu if one is open (returns true when handled).
import { closeTop } from './ui/dom';
(window as any).__androidBack = () => closeTop();
