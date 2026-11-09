const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const SITE = path.resolve(__dirname, '..');
const PJ = path.resolve(__dirname, '../node_modules/pdfjs-dist/build');
(async () => {
  const b = await chromium.launch();
  const out = process.argv[3] || 'tests/shot';
  for (const [w, h, scheme] of [[1280, 900, 'light'], [400, 860, 'dark']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, colorScheme: scheme });
    const errs = [];
    p.on('pageerror', (e) => errs.push(String(e)));
    p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    await p.route('**/*', (r) => {
      const u = new URL(r.request().url());
      if (u.hostname === 'cdnjs.cloudflare.com') return r.fulfill({ path: path.join(PJ, path.basename(u.pathname)), contentType: 'application/javascript' });
      if (u.hostname === 'site.local') { const f = path.join(SITE, u.pathname === '/' ? 'index.html' : u.pathname);
        if (u.pathname === '/') return r.fulfill({ path: f, contentType: 'text/html' });
        return r.fulfill({ path: f }); }
      return r.abort();
    });
    await p.goto('http://site.local/');
    await p.waitForTimeout(800);
    if (process.argv[2] && w > 500) {
      await p.setInputFiles('#file', process.argv[2]);
      await p.waitForTimeout(1500);
      console.log('status:', await p.textContent('#status'));
      await p.click('#list button.row');
      await p.waitForTimeout(200);
    }
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    console.log(w, scheme, 'scrollWidth', sw, 'errors', errs);
    await p.screenshot({ path: `${out}-${w}.png`, fullPage: w > 500 ? false : false });
    if (w > 500) { await p.evaluate(() => window.scrollTo(0, 560)); await p.screenshot({ path: `${out}-${w}-b.png` }); }
  }
  await b.close();
})();
