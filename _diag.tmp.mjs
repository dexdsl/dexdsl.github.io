import { chromium } from 'playwright';
const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1280,height:880}})).newPage();
await p.goto('http://localhost:8092/_gatecheck.html',{waitUntil:'networkidle'});await p.waitForTimeout(1500);
const d=await p.evaluate(()=>{const body=document.querySelector('.dx-submit-gate-card .dx-submit-gate-body');const cs=getComputedStyle(body);const copy=body.parentElement;const cc=getComputedStyle(copy);const card=copy.parentElement;
 return {bodyWS:cs.whiteSpace,bodyDisplay:cs.display,bodyW:Math.round(body.getBoundingClientRect().width),bodyScrollW:body.scrollWidth,copyW:Math.round(copy.getBoundingClientRect().width),copyDisplay:cc.display,cardW:Math.round(card.getBoundingClientRect().width),copyWS:cc.whiteSpace};});
console.log(JSON.stringify(d));await b.close();
