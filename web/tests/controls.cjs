// Control checks in a real browser: two-finger twist rotates the same way as the fingers,
// menus never close from the tap that opened them, and every main screen opens in Arabic without English.
const { chromium } = require('playwright');
(async () => {
  const [url = 'http://localhost:4173/', out = '.'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 900, height: 600 }, hasTouch: true });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => { if (!sessionStorage.getItem('init')) { localStorage.clear(); localStorage.setItem('whot_quality', 'smooth'); sessionStorage.setItem('init', '1'); } });
  await page.goto(url); await page.waitForTimeout(4000);
  await page.evaluate(() => window.__app.quickStart('normal')); await page.waitForTimeout(3000);
  let fails = 0; const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };

  // --- Two-finger twist: turn the fingers clockwise, a world point must also turn clockwise around the screen centre.
  const res = await page.evaluate(async () => {
    const app = window.__app; const rig = app.world.rig; rig.flyTo(rig.goal.target.clone(), 40, 0.9, 0); rig.snap();
    const THREE = window.__app.constructor && null; // not needed
    const P = { x: rig.goal.target.x + 6, y: 0, z: rig.goal.target.z };
    const proj = () => { const v = app.world.stage.camera.position.clone(); const p = new v.constructor(P.x, P.y, P.z).project(app.world.stage.camera); return { x: (p.x + 1) * 450, y: (1 - p.y) * 300 }; };
    const before = proj(); const c = { x: 450, y: 300 };
    const el = app.world.stage.canvas; const fire = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: id === 1 }));
    const R = 120; let a = 0; fire('pointerdown', 1, c.x - R, c.y); fire('pointerdown', 2, c.x + R, c.y);
    for (let i = 1; i <= 10; i++) { a = (i / 10) * 0.6; fire('pointermove', 1, c.x - R * Math.cos(a), c.y - R * Math.sin(a)); fire('pointermove', 2, c.x + R * Math.cos(a), c.y + R * Math.sin(a)); }
    fire('pointerup', 1, c.x - R * Math.cos(a), c.y - R * Math.sin(a)); fire('pointerup', 2, c.x + R * Math.cos(a), c.y + R * Math.sin(a));
    rig.snap(); const after = proj();
    const ang = (p) => Math.atan2(p.y - c.y, p.x - c.x); let d = ang(after) - ang(before); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
    return { d, before, after };
  });
  // Fingers turned clockwise on screen (positive angle with y pointing down); the world point must too.
  check(res.d > 0.2, `two-finger twist follows the fingers (world turned ${res.d.toFixed(2)} rad clockwise)`);

  // --- A menu opened by a tap must not close from that same tap.
  await page.click('#btn-bookings', { force: true }); await page.waitForTimeout(50);
  await page.mouse.click(20, 580); await page.waitForTimeout(100);
  check(!!(await page.$('.modal')), 'menu stays open when the opening tap lands on the backdrop');
  await page.waitForTimeout(600); await page.mouse.click(20, 580); await page.waitForTimeout(300);
  check(!(await page.$('.modal')), 'a later deliberate tap on the backdrop closes it');

  // --- Arabic: open every main screen and look for leftover English letters in visible text.
  await page.evaluate(() => { localStorage.setItem('whot_lang', 'ar'); }); await page.reload(); await page.waitForTimeout(4000);
  await page.evaluate(() => window.__app.quickStart('normal')); await page.waitForTimeout(2500);
  const latin = async (where) => { const bad = await page.evaluate(() => { const out = []; const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) { const t = c.textContent.replace(/\$|[\d.,:%+\-×/·()\s]|ع|EN/g, ''); if (/[A-Za-z]{2,}/.test(t)) out.push(t.trim()); } else if (c.nodeType === 1 && getComputedStyle(c).display !== 'none') walk(c); } }; walk(document.getElementById('ui')); return out; }); check(bad.length === 0, `Arabic ${where}: no English text${bad.length ? ' -> ' + bad.slice(0, 5).join(' | ') : ''}`); };
  const dir = await page.evaluate(() => document.documentElement.dir); check(dir === 'rtl', 'Arabic layout is right-to-left');
  await latin('HUD');
  for (const [btn, name] of [['#btn-bookings', 'bookings'], ['#btn-office', 'office'], ['#btn-goals', 'goals'], ['#btn-phone', 'phone']]) {
    await page.click(btn, { force: true }); await page.waitForTimeout(900); await page.screenshot({ path: `${out}/ar-${name}.png` }); await latin(name);
    if (name === 'office') for (let i = 2; i <= 7; i++) { await page.click(`.tab:nth-child(${i})`, { force: true }); await page.waitForTimeout(500); await latin('office tab ' + i); }
    if (name === 'goals') for (let i = 2; i <= 5; i++) { await page.click(`.tab:nth-child(${i})`, { force: true }); await page.waitForTimeout(400); await latin('goals tab ' + i); }
    await page.evaluate(() => window.__androidBack()); await page.waitForTimeout(400);
  }
  // --- Save, quit and reload restores everything exactly.
  const before = await page.evaluate(() => { window.__app.g.s.money += 12345; window.__app.persist(); return JSON.stringify(window.__app.g.s); });
  await page.reload(); await page.waitForTimeout(4000);
  await page.click('#slot-continue-0', { force: true }); await page.waitForFunction(() => window.__app.g.s.slot === 0, null, { timeout: 60000 }); await page.waitForTimeout(1500);
  const after = await page.evaluate(() => { const s = JSON.parse(JSON.stringify(window.__app.g.s)); return s; });
  const pre = JSON.parse(before); delete pre.savedAt; delete after.savedAt; delete pre.dailyGift; delete after.dailyGift;
  check(JSON.stringify(pre) === JSON.stringify(after), 'save -> reload -> continue restores the exact same game');
    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close(); console.log(fails ? `${fails} control check(s) failed` : 'All control checks passed.'); process.exit(fails ? 1 : 0);
})();
