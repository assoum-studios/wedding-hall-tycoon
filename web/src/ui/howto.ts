// A short animated "how to play" intro: five swipeable cards. Shown on a new game and from Settings.
import { t } from '../core/i18n';
import { h, btn, modal } from './dom';
import { sfx } from '../audio/audio';

const SLIDES = [['💌', 'book'], ['🎨', 'plan'], ['💒', 'night'], ['💰', 'grow'], ['👑', 'legend']];
export function showHowTo(onDone?: () => void) {
  let i = 0; const m = modal(t('howto.title'), [], { cls: 'narrow', onClose: () => onDone?.() });
  let sx = 0;
  m.body.addEventListener('pointerdown', (e) => { sx = e.clientX; });
  m.body.addEventListener('pointerup', (e) => { const dx = e.clientX - sx; if (Math.abs(dx) > 50) { const dir = (document.documentElement.dir === 'rtl' ? -1 : 1) * (dx < 0 ? 1 : -1); go(i + dir); } });
  const go = (n: number) => { if (n < 0 || n >= SLIDES.length) return; i = n; sfx('tap'); render(); };
  const render = () => {
    const [icon, id] = SLIDES[i]; const last = i === SLIDES.length - 1;
    m.setBody([h('div', { class: 'howto' },
      h('div', { class: 'hp-slide' }, h('div', { class: 'hp-icon' }, icon), h('div', { class: 'hp-title' }, t('howto.' + id + '.t')), h('div', { class: 'hp-text' }, t('howto.' + id + '.d'))),
      h('div', { class: 'hp-dots' }, ...SLIDES.map((_, k) => h('i', { class: k === i ? 'on' : '' }))),
      h('div', { class: 'row', style: { justifyContent: 'space-between' } },
        i > 0 ? btn(t('howto.back'), () => go(i - 1), 'ghost') : btn(t('howto.skip'), () => m.close(), 'ghost', { id: 'howto-skip' }),
        last ? btn(t('howto.start'), () => m.close(), 'green big', { id: 'howto-start' }) : btn(t('howto.next'), () => go(i + 1), 'green', { id: 'howto-next' })))]);
  };
  render(); return m;
}
