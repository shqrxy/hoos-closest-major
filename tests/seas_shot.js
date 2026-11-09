const { chromium } = require('playwright'); const path=require('path');
const SITE=path.resolve(__dirname,'..'),PJ=path.resolve(__dirname,'../node_modules/pdfjs-dist/build');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:900}});
p.on('pageerror',e=>console.log('ERR',e));
await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname==='cdnjs.cloudflare.com')return r.fulfill({path:path.join(PJ,path.basename(u.pathname)),contentType:'application/javascript'});
if(u.hostname==='site.local')return r.fulfill({path:path.join(SITE,u.pathname==='/'?'index.html':u.pathname)});return r.abort();});
await p.goto('http://site.local/#engineering');await p.waitForTimeout(800);
if(process.argv[2]){await p.setInputFiles('#file',process.argv[2]);await p.waitForTimeout(1500);}
await p.locator('.school-tabs').scrollIntoViewIfNeeded();await p.evaluate(()=>window.scrollBy(0,-20));
await p.click('#list button.row');await p.waitForTimeout(200);
await p.screenshot({path:path.join(__dirname,'seas.png')});await b.close();})();
