import { chromium } from 'playwright';
const OUT = '/private/tmp/claude-501/-Users-seb-dexdsl-github-io/dd139c6a-fa1d-46ff-8d5d-76a99e4f4a6f/scratchpad';
const base = 'http://localhost:8087';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
// open the mobile menu via JS dispatch on burger
await page.evaluate(() => {
  const b = document.querySelector('.header-display-mobile .header-burger-btn') || document.querySelector('.header-burger-btn');
  if (b) b.click();
});
await page.waitForTimeout(900);
const info = await page.evaluate(() => {
  const header = document.querySelector('.header-announcement-bar-wrapper');
  const sheet = document.querySelector('.dx-mobile-menu-sheet');
  const menu = document.querySelector('.dx-mobile-menu');
  const r = el => el ? el.getBoundingClientRect() : null;
  const z = el => el ? getComputedStyle(el).zIndex : null;
  return {
    headerRect: r(header), headerZ: z(header),
    sheetRect: r(sheet), sheetZ: z(sheet),
    menuZ: z(menu), menuOpen: document.body.className.includes('mobile-menu-open'),
  };
});
console.log(JSON.stringify(info, null, 1));
await page.screenshot({ path: `${OUT}/home-menu.png` });
await browser.close();
