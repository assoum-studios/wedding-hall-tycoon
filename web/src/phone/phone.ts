// Phone apps logic: Vowly posts and boosts, message replies with consequences, wedding photo album.
import type { Game } from '../core/game';
import type { WeddingRecord, Message } from '../core/types';
import { CFG, CONTENT } from '../core/data';
import { raise } from '../staff/staff';

export function addPhoto(g: Game, rec: WeddingRecord, data: string) {
  g.s.photos.push({ id: g.uid('p'), day: g.s.day, data, names: rec.names, happiness: rec.happiness });
  if (g.s.photos.length > 30) g.s.photos.shift();
  rec.photo = data;
}
/** Post a wedding to Vowly. Followers gained depend on how happy the night was. */
export function postWedding(g: Game, rec: WeddingRecord) {
  if (g.s.posts.some((p) => p.id === 'post_' + rec.id)) return null;
  const gain = Math.round(rec.guests * CFG.followers.perWeddingPost * (0.3 + rec.happiness / 100) * (1 + g.s.reputation / 100) + 40);
  g.addFollowers(gain);
  const comments: number[] = []; const nc = Math.min(4, 1 + Math.floor(rec.happiness / 30)); for (let i = 0; i < nc; i++) comments.push(g.rng.int(0, CONTENT.vowlyComments.length - 1));
  const post = { id: 'post_' + rec.id, day: g.s.day, photo: rec.photo, caption: [rec.names[0][0] + ' & ' + rec.names[1][0], rec.names[0][1] + ' و ' + rec.names[1][1]] as [string, string], likes: Math.round(gain * g.rng.range(1.5, 3)), comments };
  g.s.posts.unshift(post); if (g.s.posts.length > 40) g.s.posts.pop();
  g.stat('posts'); g.emit('vowly', gain); return gain;
}
export function boostPost(g: Game, id: string) {
  const p = g.s.posts.find((x) => x.id === id); if (!p || p.boosted || g.s.money < CFG.followers.boostCost) return false;
  g.addMoney(-CFG.followers.boostCost); p.boosted = true; p.likes += 900; g.addFollowers(CFG.followers.boostFollowers); g.emit('vowly'); return true;
}
/** A hired social media manager posts for you every 2 days. */
export function socialManager(g: Game) {
  const smm = g.s.staff.filter((e) => e.role === 'social');
  if (!smm.length || g.s.day % CFG.followers.smmPostEveryDays !== 0) return;
  const rec = [...g.s.history].reverse().find((r) => !g.s.posts.some((p) => p.id === 'post_' + r.id));
  const skill = Math.max(...smm.map((e) => e.skill));
  if (rec) postWedding(g, rec); else g.addFollowers(60 + skill * 40);
  g.addFollowers(skill * 25);
}
export function answerMessage(g: Game, m: Message, i: number) {
  if (m.answered != null || !m.choices) return; m.answered = i; const c = m.choices[i];
  switch (c.action) {
    case 'raise': { const e = g.s.staff.find((x) => x.id === c.arg); if (e) raise(g, e); break; }
    case 'noraise': { const e = g.s.staff.find((x) => x.id === c.arg); if (e) e.morale = Math.max(0, e.morale - 10); break; }
    case 'refund': g.addMoney(-c.arg); g.addRep(2); break;
    case 'norefund': g.addRep(-2); break;
    case 'supplier': g.addMoney(-c.arg); g.s.mods.push({ key: 'flowerCostMult', value: 0.8, until: g.s.day + 10 }); break;
    case 'victorReply': g.addFollowers(100); break;
  }
  g.emit('messages');
}
export function unreadCount(g: Game) { return g.s.messages.filter((m) => !m.read).length; }
