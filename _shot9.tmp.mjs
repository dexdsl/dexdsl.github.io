import { chromium } from 'playwright';
const OUT='/private/tmp/claude-501/-Users-seb-dexdsl-github-io/d496c22d-f4fd-461a-aa1c-0964bf55802d/scratchpad';
const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1280,height:880},deviceScaleFactor:1});const p=await ctx.newPage();
await p.goto('http://localhost:8092/_gatecheck.html',{waitUntil:'networkidle'});
await p.waitForTimeout(2500);
const m=await p.evaluate(()=>{const cards=[...document.querySelectorAll('.dx-submit-gate-card')];return cards.map(c=>{const cta=c.querySelector('.dx-submit-gate-cta');const cr=c.getBoundingClientRect();const tr=cta.getBoundingClientRect();const body=c.querySelector('.dx-submit-gate-body');const br=body.getBoundingClientRect();return{cardW:Math.round(cr.width),hClip:c.scrollWidth>c.clientWidth+1,vClip:c.scrollHeight>c.clientHeight+1,ctaInside:tr.bottom<=cr.bottom+1&&tr.right<=cr.right+1,bodyOverflow:Math.round(br.right-cr.right)};});});
console.log('M',JSON.stringify(m));
await p.screenshot({path:`${OUT}/gate-v2.png`});await b.close();
