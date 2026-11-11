// Localization. UI strings live in src/data/i18n/{en,ar}.json; data entries carry their own en/ar text.
import en from '../data/i18n/en.json';
import ar from '../data/i18n/ar.json';
import type { Lang } from './types';

const TABLES: Record<Lang, Record<string, string>> = { en: en as any, ar: ar as any };
let lang: Lang = 'en';
const listeners: (() => void)[] = [];

export function getLang(): Lang { return lang; }
export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem('whot_lang', l); } catch {}
  if (typeof document !== 'undefined') {
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  }
  listeners.forEach((f) => f());
}
export function onLang(f: () => void) { listeners.push(f); }
export function initLang() {
  let l: Lang = 'en';
  try { const s = localStorage.getItem('whot_lang'); if (s === 'ar' || s === 'en') l = s; else if (typeof navigator !== 'undefined' && navigator.language?.startsWith('ar')) l = 'ar'; } catch {}
  setLang(l);
}

/** Translate a UI key. Params replace {name} placeholders. Missing keys show the key so tests catch them. */
export function t(key: string, params?: Record<string, string | number>): string {
  let s = TABLES[lang][key] ?? TABLES.en[key] ?? key;
  if (params) for (const k in params) s = s.split('{' + k + '}').join(String(params[k]));
  return s;
}
/** Pick the right language from a data entry: [en, ar] tuple or {en, ar} object. */
export function L(x: any, params?: Record<string, string | number>): string {
  if (x == null) return '';
  let s: string = Array.isArray(x) ? (lang === 'ar' ? x[1] : x[0]) : typeof x === 'object' ? (lang === 'ar' ? x.ar : x.en) : String(x);
  if (params) for (const k in params) s = s.split('{' + k + '}').join(String(params[k]));
  return s;
}
const nf = () => new Intl.NumberFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { maximumFractionDigits: 0 });
export function num(n: number) { return nf().format(Math.round(n)); }
export function money(n: number) {
  const s = '$' + nf().format(Math.abs(Math.round(n)));
  return n < 0 ? '-' + s : s;
}
export function shortMoney(n: number) {
  const a = Math.abs(n); const sign = n < 0 ? '-' : '';
  if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1) + t('unit.m');
  if (a >= 1e4) return sign + '$' + Math.round(a / 1e3) + t('unit.k');
  return money(n);
}
export function TABLE(l: Lang) { return TABLES[l]; }
