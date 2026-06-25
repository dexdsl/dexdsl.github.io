import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:2});
await p.goto('http://localhost:8799/',{waitUntil:'networkidle',timeout:20000}).catch(()=>{});
await p.waitForTimeout(4500);
const aside = await p.$('#dexFeaturedSide') || await p.$('.carousel-frame');
if(aside){ const box=await aside.boundingBox(); await p.screenshot({path:'/private/tmp/claude-501/-Users-seb-dexdsl-github-io/0d9d122a-82dd-4c04-ad8b-cb1a312da309/scratchpad/home-feat.png', clip:{x:Math.max(0,box.x-30),y:box.y,width:Math.min(720,box.width+60),height:Math.min(box.height,560)}}); }
await b.close();
