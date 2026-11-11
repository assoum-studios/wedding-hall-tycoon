// End-to-end playthrough in a real browser (Playwright + Chromium).
// Usage: node tests/e2e.cjs <url> <outDir> [lang]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [url = 'http://localhost:5173/', out = '.', lang = 'en', vw = '1280', vh = '720'] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: +vw, height: +vh } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const shot = async (name) => { await page.screenshot({ path: path.join(out, `${lang}-${vw}x${vh}-${name}.png`) }); console.log('shot', name); };
  const click = async (sel, t = 8000) => { await page.waitForSelector(sel, { timeout: t }); await page.click(sel, { force: true }); await page.waitForTimeout(350); };
  await page.addInitScript((l) => { localStorage.clear(); localStorage.setItem('whot_lang', l); localStorage.setItem('whot_quality', 'smooth'); }, lang);
  await page.goto(url); await page.waitForTimeout(5000); await shot('01-title');
  await click('#slot-new-0'); await shot('02-difficulty');
  await click('#diff-normal'); await page.waitForTimeout(1500); await shot('03-story1');
  for (let i = 0; i < 3; i++) { await click('#story-next'); await page.waitForTimeout(1200); if (i === 1) await shot('04-story-letter'); }
  await click('#story-next'); await page.waitForTimeout(4000); await shot('05-customize');
  // pick the female owner and a different outfit to exercise the panel
  const opts = await page.$$('.custom-panel .opt'); if (opts.length > 1) { await opts[1].click(); await page.waitForTimeout(1500); }
  await shot('06-customize-female');
  if (opts.length) { await (await page.$$('.custom-panel .opt'))[0].click(); await page.waitForTimeout(1200); }
  await click('#btn-start-empire'); await page.waitForTimeout(4000); await shot('07-day');
  // Bookings -> meet the tutorial couple
  await click('#btn-bookings'); await page.waitForTimeout(600); await shot('08-bookings');
  await click('[data-req]'); await page.waitForTimeout(2500); await shot('09-meeting');
  for (let i = 0; i < 6; i++) { const n = await page.$('#meet-next'); if (!n) break; await n.click(); await page.waitForTimeout(300); }
  await click('#meet-invoice'); await page.waitForTimeout(600); await shot('10-invoice');
  await page.$eval('#price-level', (el) => { el.value = '110'; el.dispatchEvent(new Event('input')); });
  await click('#inv-send'); await page.waitForTimeout(800);
  const counter = await page.$('#inv-accept-counter'); if (counter) await counter.click();
  await page.waitForTimeout(2500); await shot('11-booked');
  // Plan it
  await click('#btn-bookings'); await page.click('.tab:nth-child(2)'); await page.waitForTimeout(400);
  const planBtn = await page.$('[data-plan]'); if (planBtn) { await planBtn.click(); await page.waitForTimeout(800); await shot('12-planning'); await click('#plan-confirm'); }
  await page.waitForTimeout(500); const close = await page.$('.modal .close'); if (close) await close.click(); await page.waitForTimeout(500);
  // Advance days until the wedding
  for (let i = 0; i < 6; i++) {
    const news = await page.$('[data-choice="0"]'); if (news) { await news.click(); await page.waitForTimeout(400); }
    const label = await page.$eval('#btn-main', (b) => b.className);
    if (label.includes('green')) break;
    await click('#btn-main'); await page.waitForTimeout(1200);
  }
  const news2 = await page.$('[data-choice="0"]'); if (news2) { await news2.click(); await page.waitForTimeout(400); }
  await shot('13-wedding-day');
  await click('#btn-main'); await page.waitForTimeout(800); await shot('14-pre-night');
  await page.evaluate(() => { window.__app.g.s.settings.weddingLength = 'short'; });
  await click('#btn-begin'); await page.waitForTimeout(4000); await shot('15-night-arrive');
  // speed up and tap problems/moments as they appear
  let shots = 0; const t0 = Date.now();
  while (Date.now() - t0 < 140000) {
    const prob = await page.$('.problem'); if (prob) { try { await prob.click({ timeout: 1000 }); } catch {} }
    const mom = await page.$('.moment .ringbtn'); if (mom) { try { await mom.click({ timeout: 1000 }); } catch {} }
    const phase = await page.evaluate(() => window.__app.night?.sim.phase ?? 'done');
    if (phase === 'dinner' && shots === 0) { await shot('16-night-dinner'); shots++; }
    if (phase === 'dancing' && shots === 1) { await page.waitForTimeout(3000); await shot('17-night-dancing'); shots++; }
    if (phase === 'farewell' && shots === 2) { await page.waitForTimeout(3500); await shot('18-night-farewell'); shots++; }
    if (await page.$('#btn-report-ok')) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1500); await shot('19-report');
  const ok = await page.$('#btn-report-ok'); if (ok) await ok.click(); await page.waitForTimeout(2000); await shot('20-after');
  // Office + Goals + Phone
  const off = await page.$('#btn-office'); if (off) { await off.click(); await page.waitForTimeout(900); await shot('21-office'); await page.click('.modal .close'); await page.waitForTimeout(400); }
  const gl = await page.$('#btn-goals'); if (gl) { await gl.click(); await page.waitForTimeout(900); await shot('22-goals'); await page.click('.modal .close'); await page.waitForTimeout(400); }
  await click('#btn-phone'); await page.waitForTimeout(600); await shot('23-phone');
  // Save -> reload -> continue restores the same state
  const before = await page.evaluate(() => { window.__app.persist(); const s = window.__app.g.s; return JSON.stringify({ day: s.day, money: s.money, staff: s.staff.length, hist: s.history.length, bookings: s.bookings.length }); });
  await page.goto(url); await page.waitForTimeout(5000);
  await click('#slot-continue-0'); await page.waitForTimeout(3000);
  const after = await page.evaluate(() => { const s = window.__app.g.s; return JSON.stringify({ day: s.day, money: s.money, staff: s.staff.length, hist: s.history.length, bookings: s.bookings.length }); });
  console.log('save before', before, 'after', after, before === after ? 'MATCH' : 'MISMATCH');
  if (before !== after) errors.push('save/reload mismatch');
  await shot('24-reloaded');
  const fps = await page.evaluate(() => window.__app.world.stage.fps); console.log('fps (software GL, not representative):', fps.toFixed(1));
  console.log('ERRORS:', errors.length ? errors.join('\n---\n') : 'none');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
