// Typed access to the editable JSON data files in src/data.
import config from '../data/config.json';
import demandsJ from '../data/demands.json';
import problemsJ from '../data/problems.json';
import newsJ from '../data/news.json';
import hallsJ from '../data/halls.json';
import staffJ from '../data/staff.json';
import businessJ from '../data/business.json';
import progressJ from '../data/progress.json';
import contentJ from '../data/content.json';

export interface Demand { id: string; en: string; ar: string; cost: number; price: number; perGuest?: boolean; req?: { staff?: string; plot?: string; rep?: number; upgrade?: { id: string; level: number } }; tags: string[]; }
export interface Problem { id: string; en: string; ar: string; role: string; upgrade: string | null; fixCost: number; miss: number; gain: number; time: number; phases: string[]; outdoorOnly?: boolean; needsPool?: boolean; }
export interface Effects { money?: number; rep?: number; followers?: number; morale?: number; mods?: { key: string; value: number; days: number }[]; special?: string; }
export interface NewsChoice { en: string; ar: string; effects: Effects; risk?: { p: number; fail: Effects }; }
export interface NewsEvent { id: string; en: [string, string]; ar: [string, string]; choices: NewsChoice[]; minDay?: number; minRep?: number; months?: number[]; needsBooking?: boolean; needsDebt?: boolean; }

export const CFG = config as any;
export const DEMANDS = (demandsJ as any).demands as Demand[];
export const DEMAND_BY_ID: Record<string, Demand> = Object.fromEntries(DEMANDS.map((d) => [d.id, d]));
export const PROBLEMS = (problemsJ as any).problems as Problem[];
export const PROBLEM_BY_ID: Record<string, Problem> = Object.fromEntries(PROBLEMS.map((d) => [d.id, d]));
export const NEWS = (newsJ as any).events as NewsEvent[];
export const SABOTAGE = (newsJ as any).sabotage as NewsEvent[];
export const HALLS = hallsJ as any;
export const STAFF = staffJ as any;
export const BIZ = businessJ as any;
export const PROG = progressJ as any;
export const CONTENT = contentJ as any;
export const ROLE_BY_ID: Record<string, any> = Object.fromEntries(STAFF.roles.map((r: any) => [r.id, r]));
export const UPGRADE_BY_ID: Record<string, any> = Object.fromEntries(HALLS.upgrades.map((r: any) => [r.id, r]));
export const PLOT_BY_ID: Record<string, any> = Object.fromEntries(BIZ.plots.map((r: any) => [r.id, r]));
export const ITEM_BY_ID: Record<string, any> = Object.fromEntries(HALLS.items.map((r: any) => [r.id, r]));
export const THEME_IDS = Object.keys(CFG.themes) as any[];
