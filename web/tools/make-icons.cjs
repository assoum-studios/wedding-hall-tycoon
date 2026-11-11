// Renders the vector icon/logo into Android launcher icons and Play Store graphics.
// Usage: node tools/make-icons.cjs   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
(async () => {
  const root = path.resolve(__dirname, '..', '..');
  const icon = fs.readFileSync(path.join(__dirname, '..', 'public', 'icon.svg'), 'utf8');
  const logo = fs.readFileSync(path.join(__dirname, '..', 'public', 'logo-en.svg'), 'utf8');
  const font = (pkg, file) => fs.readFileSync(path.join(__dirname, '..', 'node_modules', '@fontsource', pkg, 'files', file)).toString('base64');
  const fontCss = `<style>@font-face{font-family:'Lilita One';src:url(data:font/woff2;base64,${font('lilita-one', 'lilita-one-latin-400-normal.woff2')}) format('woff2')}@font-face{font-family:'Lalezar';src:url(data:font/woff2;base64,${font('lalezar', 'lalezar-arabic-400-normal.woff2')}) format('woff2')}</style>`;
  const b = await chromium.launch(); const p = await b.newPage();
  const render = async (html, w, h, out) => { await p.setViewportSize({ width: w, height: h }); await p.setContent(`<html><head>${fontCss}</head><body style="margin:0;background:transparent">${html}</body></html>`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400); fs.mkdirSync(path.dirname(out), { recursive: true }); await p.screenshot({ path: out, omitBackground: true }); };
  const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [d, s] of Object.entries(sizes)) {
    const svg = icon.replace('<svg ', `<svg width="${s}" height="${s}" `);
    await render(svg, s, s, path.join(root, `android/app/src/main/res/mipmap-${d}/ic_launcher.png`));
    await render(`<div style="width:${s}px;height:${s}px;border-radius:50%;overflow:hidden">${svg}</div>`, s, s, path.join(root, `android/app/src/main/res/mipmap-${d}/ic_launcher_round.png`));
  }
  await render(icon.replace('<svg ', '<svg width="512" height="512" '), 512, 512, path.join(root, 'store/play-icon-512.png'));
  // Feature graphic 1024x500: sky, palace silhouette, logo
  await render(`<div style="width:1024px;height:500px;background:linear-gradient(#3f8fe0,#cfe9ff);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">
    <div style="position:absolute;bottom:0;left:0;right:0;height:120px;background:linear-gradient(#f4e6cc,#e2cfa6)"></div>
    <div style="position:absolute;bottom:60px;left:50%;transform:translateX(-50%);width:760px;height:260px;background:#fbf3e3;border-radius:30px 30px 0 0;box-shadow:0 0 0 8px #e2b84f"></div>
    <div style="position:relative;width:640px">${logo.replace('<svg ', '<svg width="640" ')}</div></div>`, 1024, 500, path.join(root, 'store/feature-graphic-1024x500.png'));
  await b.close(); console.log('icons written');
})();
