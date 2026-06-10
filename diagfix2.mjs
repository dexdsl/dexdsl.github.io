import { chromium } from 'playwright';
import fs from 'node:fs';
const patched = fs.readFileSync('assets/js/header-slot.js','utf8');
const browser=await chromium.launch();
const ctx=await browser.newContext({viewport:{width:1400,height:900}});
await ctx.route('**/assets/js/header-slot.js', r=>r.fulfill({status:200,contentType:'application/javascript',body:patched}));
const page=await ctx.newPage();
const grab=()=>page.evaluate(()=>({
  url:location.pathname,
  title:(document.querySelector('.dex-entry-page-title')?.textContent||'').trim().slice(0,34),
  lookup:(document.querySelector('.dex-overview .overview-lookup')?.textContent||'').trim(),
  rendered:document.documentElement.dataset.dexSidebarRendered||'-',
  layoutState:document.querySelector('[data-dx-entry-fetch-target="layout"]')?.getAttribute('data-dx-fetch-state')||'-',
  collFilled:(document.querySelector('.dex-collections')?.innerHTML||'').trim().length,
  routeStyleCount:document.querySelectorAll('style[data-dx-route-style="true"]').length,
}));
await page.goto('https://dexdsl.github.io/entry/bassoon-and-electronics/',{waitUntil:'load'});
await page.waitForTimeout(3500);
console.log('ENTRY1 (real load):',JSON.stringify(await grab()));
// soft-nav entry1 -> entry2
await page.evaluate(()=>window.dxNavigate('/entry/multiperc/',{pushHistory:true}));
await page.waitForTimeout(4000);
console.log('ENTRY2 (soft-nav):',JSON.stringify(await grab()));
// soft-nav entry2 -> entry3
await page.evaluate(()=>window.dxNavigate('/entry/jakob-heinemann/',{pushHistory:true}));
await page.waitForTimeout(4000);
console.log('ENTRY3 (soft-nav):',JSON.stringify(await grab()));
await browser.close();
