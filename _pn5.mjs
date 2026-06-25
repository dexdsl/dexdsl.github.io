import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1440,height:980}, deviceScaleFactor:2 });
await p.goto('http://localhost:8799/catalog/',{waitUntil:'networkidle',timeout:20000}).catch(()=>{});
await p.waitForTimeout(2600);
const nav = await p.$('.dx-catalog-index-season-pips');
if (nav) await nav.screenshot({ path:'/private/tmp/claude-501/-Users-seb-dexdsl-github-io/0d9d122a-82dd-4c04-ad8b-cb1a312da309/scratchpad/pips-clean.png' });
await b.close();
