import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({viewport:{width:1440,height:1000}});
await p.goto('http://localhost:8799/',{waitUntil:'networkidle',timeout:20000}).catch(()=>{});
await p.waitForTimeout(3500);
const r = await p.evaluate(()=>{
  const out=[];
  document.querySelectorAll('[class*="arrow" i],[class*="carousel-nav" i],[class*="chevron" i],[id*="carousel"]').forEach(el=>{
    if (out.length<12) out.push({ tag: el.tagName, cls: el.className.toString().slice(0,80), id: el.id, html: el.innerHTML.slice(0,40) });
  });
  const ind = document.querySelector('[class*="indicator" i], [class*="carousel-dot" i], [class*="pip" i]');
  return { found: out, indicator: ind?ind.className.toString().slice(0,80):null };
});
console.log(JSON.stringify(r,null,1));
await b.close();
