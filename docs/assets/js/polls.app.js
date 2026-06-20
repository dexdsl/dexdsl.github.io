(()=>{(()=>{if(typeof window=="undefined"||typeof document=="undefined")return;if(window.__dxPollsAppLoaded&&typeof window.__dxPollsQueueBoot=="function"){try{window.__dxPollsQueueBoot()}catch{}return}window.__dxPollsAppLoaded=!0;let z="dx-polls-app-style-v2",N=120,W=16,Z=10,J=12,A="open",Y=new Set(["open","results","archive"]),tt=45e3,l={tab:A,pollId:"",closedPage:1,authSnapshot:{auth:null,authenticated:!1,token:null,user:null},collections:{open:{polls:[],page:1,pages:1,total:0},closed:{polls:[],page:1,pages:1,total:0},published:{rows:[],page:1,pages:1,total:0}},detail:null,detailCache:new Map,loading:!1,error:"",busyVote:!1};function r(t){return String(t!=null?t:"").trim()}function i(t){return String(t!=null?t:"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function R(t){let e=String(t||"/").replace(/\/+/g,"/");return e==="/"?"/":e.endsWith("/")?e.slice(0,-1):e}function S(t){let e=r(t).toLowerCase();return Y.has(e)?e:A}function T(t=null){let e=new URLSearchParams(window.location.search||""),o=r(e.get("poll")),a=S(e.get("tab"));if(t instanceof Element){let n=r(t.getAttribute("data-dx-poll-id"));n&&!o&&(o=n,a="open")}let s=R(window.location.pathname||"/");if(s.startsWith("/polls/")){let n=s.slice(7).replace(/\/index\.html$/i,"").replace(/\/$/,"");n&&(o=decodeURIComponent(n),a="open")}return{tab:a,pollId:o}}function v(t,e=""){let o=new URLSearchParams,a=S(t),s=r(e);if(a==="open"&&s)return`/polls/${encodeURIComponent(s)}/`;a!==A&&o.set("tab",a),s&&o.set("poll",s);let n=o.toString();return`/polls/${n?`?${n}`:""}`}function L({tab:t,pollId:e},o=!1){let a=v(t,e),s=a.replace(/\/index\.html$/,"/");`${window.location.pathname}${window.location.search}`!==s&&(o?window.history.replaceState({},"",a):window.history.pushState({},"",a))}function k(t){let e=Date.parse(String(t||""));return Number.isFinite(e)?e:null}function f(t){let e=k(t);if(!e)return"TBD";try{return new Date(e).toLocaleString(void 0,{year:"numeric",month:"short",day:"numeric"})}catch{return new Date(e).toISOString().slice(0,10)}}function q(t){let e=k(t);if(!e)return"Closing date TBD";let o=e-Date.now();if(o<=0)return"Closed";let a=Math.floor(o/36e5),s=Math.floor(a/24),n=a%24;return s>0?`${s}d ${n}h left`:a>0?`${a}h left`:`${Math.max(1,Math.floor(o/6e4))}m left`}function et(t){return Array.isArray(t)?t.map(e=>r(e)).filter(Boolean):typeof t=="string"?t.split("|").map(e=>r(e)).filter(Boolean):[]}function h(t){let e=t&&typeof t=="object"?t:{};return{id:r(e.id),slug:r(e.slug)||null,status:r(e.status)||"draft",question:r(e.question)||"Untitled poll",options:et(e.options),createdAt:r(e.createdAt||e.created_at),closeAt:r(e.closeAt||e.close_at),manualClose:!!(e.manualClose||e.manual_close),visibility:r(e.visibility)==="members"?"members":"public",closed:!!e.closed}}function ot(t){let e={};if(!t||typeof t!="object")return e;for(let[o,a]of Object.entries(t)){let s=Number(a);!Number.isFinite(s)||s<0||(e[String(o)]=Math.floor(s))}return e}function lt(t){let e=t&&typeof t=="object"?t:{};return{total:Math.max(0,Number(e.total||0)||0),counts:Array.isArray(e.counts)?e.counts.map(o=>Math.max(0,Number(o)||0)):ot(e.counts),viewerVote:Number.isInteger(Number(e.viewerVote))?Number(e.viewerVote):null,closed:!!e.closed,mode:r(e.mode||"live")||"live",publishedSnapshot:e.publishedSnapshot&&typeof e.publishedSnapshot=="object"?e.publishedSnapshot:null}}function B(t,e=1){if(Array.isArray(t))return{polls:t.map(h),page:e,pages:1,total:t.length};let o=t&&typeof t=="object"?t:{},s=[o.polls,o.items,o.data,o.rows].find(n=>Array.isArray(n))||[];return{polls:s.map(h),page:Math.max(1,Number(o.page)||e),pages:Math.max(1,Number(o.pages||o.totalPages)||1),total:Math.max(0,Number(o.total||o.count||s.length)||0)}}function at(t){let e=t&&typeof t=="object"?t:{},o=Array.isArray(e.items)?e.items:Array.isArray(e.rows)?e.rows:Array.isArray(e.polls)?e.polls:[];return{rows:o.map(a=>{let s=a!=null&&a.poll&&typeof a.poll=="object"?a.poll:a,n=a!=null&&a.publishedSnapshot&&typeof a.publishedSnapshot=="object"?a.publishedSnapshot:a!=null&&a.snapshot&&typeof a.snapshot=="object"?a.snapshot:null;return{poll:h(s),snapshot:n}}),page:Math.max(1,Number(e.page)||1),pages:Math.max(1,Number(e.pages||e.totalPages)||1),total:Math.max(0,Number(e.total||e.count||o.length)||0)}}function st(t){let e=t&&typeof t=="object"?t:{},o=e.trend&&typeof e.trend=="object"?e.trend:e;return(Array.isArray(o.series)?o.series:Array.isArray(o.points)?o.points:[]).map(s=>{var n,d,p;return{t:r(s.t||s.bucket||s.timestamp||s.date||s.label),value:Math.max(0,Number((p=(d=(n=s.value)!=null?n:s.count)!=null?d:s.total)!=null?p:0)||0)}}).filter(s=>s.t)}function D(t=[]){let e="\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588";if(!Array.isArray(t)||t.length===0)return"";let o=t.map(s=>Math.max(0,Number(s.value)||0)),a=Math.max(...o,0);return a<=0?"\u2581".repeat(o.length):o.map(s=>{let n=s/a,d=Math.max(0,Math.min(e.length-1,Math.round(n*(e.length-1))));return e[d]}).join("")}function j(t){if(!t||t.status==="closed"||t.manualClose||t.closed)return!0;let e=k(t.closeAt);return e?e<=Date.now():!1}function nt(){return r(window.DEX_API_BASE_URL||window.DEX_API_ORIGIN||"https://dex-api.spring-fog-8edd.workers.dev").replace(/\/$/,"")}async function U(){let t=window.DEX_AUTH||window.dexAuth||null;if(!t)return{auth:null,authenticated:!1,token:null,user:null};try{typeof t.resolve=="function"?await t.resolve(2400):t.ready&&typeof t.ready.then=="function"&&await t.ready}catch{}let e=!1;try{typeof t.isAuthenticated=="function"&&(e=!!await t.isAuthenticated())}catch{}let o=null;if(e&&typeof t.getAccessToken=="function")try{o=await t.getAccessToken()}catch{o=null}let a=null;try{typeof t.getUser=="function"&&(a=await t.getUser())}catch{}return{auth:t,authenticated:e,token:o,user:a}}async function O(){var t;if(!(!((t=l.authSnapshot)!=null&&t.auth)||typeof l.authSnapshot.auth.signIn!="function"))try{await l.authSnapshot.auth.signIn({returnTo:`${window.location.pathname}${window.location.search}${window.location.hash}`})}catch{}}async function u(t,{method:e="GET",body:o=null,authRequired:a=!1}={}){var p;let s={accept:"application/json"};if(o!=null&&(s["content-type"]="application/json"),(p=l.authSnapshot)!=null&&p.token&&(s.authorization=`Bearer ${l.authSnapshot.token}`),a&&!s.authorization)return{ok:!1,status:401,data:{error:"AUTH_REQUIRED"}};let n=await fetch(`${nt()}${t}`,{method:e,headers:s,body:o==null?void 0:JSON.stringify(o)}),d=null;try{d=await n.json()}catch{d=null}return{ok:n.ok,status:n.status,data:d}}function P(t,e){t.setAttribute("data-dx-fetch-state",e),e==="loading"?t.setAttribute("aria-busy","true"):t.removeAttribute("aria-busy")}function it(){if(document.getElementById(z))return;let t=document.createElement("style");t.id=z,t.textContent=`
      .dx-polls-shell{
        --dx-polls-gap: clamp(14px,1.6vw,20px);
        --dx-polls-line: rgba(0,0,0,.12);
        --dx-polls-line-strong: rgba(0,0,0,.22);
        --dx-polls-ink:#1a1a1a;
        --dx-polls-muted:#6b6b6b;
        --dx-polls-faint:#9a9a9a;
        --dx-polls-accent:#ff2d13;
        width:var(--dx-header-frame-width);
        max-width:var(--dx-header-frame-width);
        margin:0 auto;
        height:100%;
        min-height:0;
        display:flex;
        flex-direction:column;
        font-family:var(--font-body);
        color:var(--dx-polls-ink);
        overflow:hidden;
      }
      /* Fixed header \u2014 pinned above the scrolling body */
      .dx-polls-head{
        flex:0 0 auto;
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:var(--dx-polls-gap);
        flex-wrap:wrap;
        padding-bottom:var(--dx-polls-gap);
        border-bottom:1px solid var(--dx-polls-line-strong);
      }
      .dx-polls-title{margin:0;font-family:var(--font-heading);text-transform:uppercase;font-size:clamp(1.6rem,4vw,2.5rem);letter-spacing:.01em;line-height:1}
      .dx-polls-subtitle{margin:8px 0 0 0;font-family:var(--font-body);font-size:.82rem;letter-spacing:.01em;color:var(--dx-polls-muted)}
      .dx-polls-tabs{display:flex;gap:clamp(14px,2vw,26px);flex-wrap:wrap;align-items:center}
      /* Tabs mirror the header nav: gradient underline that wipes in on hover/active.
         White text stays legible over the saturated mesh that shows through the flat head. */
      .dx-polls-tab{
        appearance:none;background:none;border:0;cursor:pointer;padding:0 0 7px;position:relative;
        font-family:var(--font-body);font-size:.72rem;text-transform:uppercase;letter-spacing:.16em;
        color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.32);
        transition:transform .2s ease;
      }
      .dx-polls-tab::after{
        content:"";position:absolute;left:0;bottom:0;width:100%;height:2px;
        background:linear-gradient(90deg,var(--dx-accent-grad-start,#ff1910),var(--dx-accent-grad-end,#ff6a00));
        transform:scaleX(0);transform-origin:right;transition:transform .3s ease;
      }
      .dx-polls-tab:hover::after,.dx-polls-tab.is-active::after{transform:scaleX(1);transform-origin:left}

      /* Scrolling body \u2014 the only region that scrolls; ends stay fixed against head/footer */
      .dx-polls-body{
        flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;
        display:grid;grid-template-columns:minmax(0,1fr) minmax(290px,32%);
        gap:clamp(18px,2.4vw,40px);
        padding-top:var(--dx-polls-gap);
        align-items:start;
      }
      .dx-polls-body::-webkit-scrollbar{width:9px}
      .dx-polls-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.16);border-radius:9px}
      .dx-polls-col{min-height:0}
      .dx-polls-col--detail{
        position:sticky;top:0;align-self:start;
        border-left:1px solid var(--dx-polls-line);
        padding-left:clamp(16px,2vw,32px);
      }

      .dx-polls-section + .dx-polls-section{margin-top:28px}
      .dx-polls-section-label{margin:0 0 4px;font-family:var(--font-body);font-size:.66rem;text-transform:uppercase;letter-spacing:.16em;color:var(--dx-polls-muted)}

      .dx-polls-list{display:grid;gap:0}
      .dx-poll-card{
        display:grid;gap:7px;padding:15px 0;
        border-top:1px solid var(--dx-polls-line);
      }
      .dx-poll-card:first-child{border-top:0}
      .dx-poll-card.is-locked{opacity:.72}
      .dx-poll-card:hover .dx-poll-question{color:#fff;mix-blend-mode:difference}
      .dx-poll-card-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
      .dx-poll-chip{font-family:var(--font-body);font-size:.62rem;text-transform:uppercase;letter-spacing:.14em;color:var(--dx-polls-muted)}
      .dx-poll-chip.is-accent{color:var(--dx-polls-accent)}
      .dx-poll-chip.is-members{color:var(--dx-polls-ink)}
      .dx-poll-question{margin:0;font-family:var(--font-heading);font-size:clamp(1rem,1.3vw,1.18rem);line-height:1.16;letter-spacing:.01em;text-transform:uppercase;transition:color .15s ease}
      .dx-poll-meta{margin:0;font-family:var(--font-body);font-size:.76rem;color:var(--dx-polls-muted)}
      .dx-poll-actions{display:flex;gap:18px;flex-wrap:wrap;align-items:center;margin-top:2px}
      .dx-poll-action,
      .dx-poll-link{
        appearance:none;background:none;border:0;cursor:pointer;text-decoration:none;padding:0;
        font-family:var(--font-body);font-size:.68rem;text-transform:uppercase;letter-spacing:.14em;
        color:var(--dx-polls-muted);transition:color .2s ease;
      }
      .dx-poll-link.is-primary{color:var(--dx-polls-ink)}
      .dx-poll-action:hover,.dx-poll-link:hover{color:var(--dx-polls-accent)}
      .dx-poll-action[disabled]{opacity:.4;cursor:default}
      .dx-poll-action[disabled]:hover{color:var(--dx-polls-muted)}
      .dx-polls-pager{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:18px;padding-top:14px;border-top:1px solid var(--dx-polls-line)}
      .dx-polls-empty{margin:14px 0 0;font-family:var(--font-body);font-size:.82rem;color:var(--dx-polls-muted)}
      .dx-polls-error{margin:0 0 6px;padding:10px 0;font-family:var(--font-body);font-size:.82rem;color:#a31410}

      .dx-polls-detail{display:grid;gap:12px;align-content:start}
      .dx-polls-detail .dx-poll-question{font-family:var(--font-heading);font-size:clamp(1.15rem,1.8vw,1.5rem);line-height:1.12}
      .dx-polls-detail-grid{display:grid;gap:0;margin-top:2px}
      .dx-poll-option{
        display:grid;gap:7px;cursor:pointer;text-align:left;border:0;background:none;width:100%;
        padding:13px 0;border-top:1px solid var(--dx-polls-line);
      }
      .dx-poll-option:first-child{border-top:0}
      .dx-poll-option[disabled]{cursor:default}
      .dx-poll-option.is-selected .dx-poll-option-title{color:var(--dx-polls-accent)}
      .dx-poll-option-title{font-family:var(--font-body);font-size:.84rem;letter-spacing:.02em;color:var(--dx-polls-ink)}
      .dx-poll-bar{position:relative;height:2px;background:var(--dx-polls-line);overflow:hidden}
      .dx-poll-bar-fill{height:100%;width:0;background:var(--dx-polls-accent);transition:width .25s var(--dx-motion-ease-standard,cubic-bezier(.22,.8,.24,1))}
      .dx-poll-row-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;font-family:var(--font-body);font-size:.72rem;color:var(--dx-polls-muted)}
      .dx-poll-published{margin-top:2px;padding-top:12px;border-top:1px solid var(--dx-polls-line)}
      .dx-poll-trend{margin:0;font-family:var(--font-body);font-size:.72rem;text-transform:uppercase;letter-spacing:.14em;color:var(--dx-polls-muted)}
      .dx-poll-trend-line{margin:4px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.9rem;letter-spacing:.04em;color:var(--dx-polls-ink)}
      .dx-polls-loading{opacity:.6}
      @media (max-width:980px){
        .dx-polls-shell{height:auto;overflow:visible}
        .dx-polls-body{grid-template-columns:1fr;overflow:visible}
        .dx-polls-col--detail{position:static;border-left:0;border-top:1px solid var(--dx-polls-line);padding-left:0;padding-top:var(--dx-polls-gap)}
      }
    `,document.head.appendChild(t)}function E(){return document.querySelector("[data-dx-polls-app]")||document.getElementById("dx-polls-app")||document.getElementById("dex-console")}function rt(t,e){t.innerHTML=`
      <section class="dx-polls-shell">
        <header class="dx-polls-head">
          <h1 class="dx-polls-title">Polls</h1>
        </header>
        <div class="dx-polls-body">
          <p class="dx-polls-error">${i(e||"Unable to load polls right now.")}</p>
        </div>
      </section>
    `}function V(t,{includeTrend:e=!1}={}){let o=j(t),a=t.visibility==="members"&&!l.authSnapshot.authenticated,s=v(l.tab,t.id),n=e&&Array.isArray(t.__trendPoints)&&t.__trendPoints.length?`<p class="dx-poll-trend">90d trend</p><p class="dx-poll-trend-line">${i(D(t.__trendPoints))}</p>`:"";return`
      <article class="dx-poll-card${a?" is-locked":""}" data-dx-poll-id="${i(t.id)}">
        <div class="dx-poll-card-head">
          <span class="dx-poll-chip ${o?"":"is-accent"}">${o?"Closed":"Open"}</span>
          ${t.visibility==="members"?'<span class="dx-poll-chip is-members">Members only</span>':""}
        </div>
        <h3 class="dx-poll-question">${i(t.question)}</h3>
        <p class="dx-poll-meta">${o?`Closed ${i(f(t.closeAt))}`:`Closes ${i(f(t.closeAt))} (${i(q(t.closeAt))})`}</p>
        ${n}
        <div class="dx-poll-actions">
          <a class="dx-poll-link is-primary" href="${i(s)}" data-dx-poll-open="${i(t.id)}" data-dx-soft-nav-skip="true">View Poll</a>
          ${a?'<button class="dx-poll-action" type="button" data-dx-poll-signin="true">Sign in</button>':""}
        </div>
      </article>
    `}function dt(t){var p;let e=t.poll||h({}),o=t.snapshot&&typeof t.snapshot=="object"?t.snapshot:null,a=Number((o==null?void 0:o.total)||((p=o==null?void 0:o.totals)==null?void 0:p.total)||0)||0,s=r((o==null?void 0:o.headline)||""),n=r((o==null?void 0:o.summaryMarkdown)||(o==null?void 0:o.summary)||""),d=r((o==null?void 0:o.publishedAt)||(o==null?void 0:o.published_at));return`
      <article class="dx-poll-card" data-dx-poll-id="${i(e.id)}">
        <div class="dx-poll-card-head">
          <span class="dx-poll-chip">Published</span>
          ${e.visibility==="members"?'<span class="dx-poll-chip is-members">Members only</span>':""}
        </div>
        <h3 class="dx-poll-question">${i(s||e.question)}</h3>
        <p class="dx-poll-meta">${d?`Published ${i(f(d))}`:"Official snapshot"} \u2022 ${a} votes</p>
        ${n?`<div class="dx-poll-published">${i(n.slice(0,220))}</div>`:""}
        <div class="dx-poll-actions">
          <a class="dx-poll-link is-primary" href="${i(v("results",e.id))}" data-dx-poll-open="${i(e.id)}" data-dx-soft-nav-skip="true">View snapshot</a>
        </div>
      </article>
    `}function pt(t){if(!t)return`
        <div class="dx-polls-detail">
          <p class="dx-polls-section-label">Detail</p>
          <h2 class="dx-poll-question">Select a poll</h2>
          <p class="dx-polls-empty">Choose a poll to see live results, published snapshots, and vote state.</p>
        </div>
      `;if(t.locked)return`
        <div class="dx-polls-detail">
          <p class="dx-polls-section-label">Members poll</p>
          <h2 class="dx-poll-question">Sign in required</h2>
          <p class="dx-polls-empty">This poll is for members only.</p>
          <div class="dx-poll-actions">
            <button type="button" class="dx-poll-link is-primary" data-dx-poll-signin="true">Sign in to continue \u2192</button>
          </div>
        </div>
      `;let e=t.poll,o=t.results,a=j(e)||!!o.closed,s=Array.isArray(o.counts)?o.counts:e.options.map((b,c)=>{var g,y,C,K;return Number((K=(C=(g=o.counts)==null?void 0:g[String(c)])!=null?C:(y=o.counts)==null?void 0:y[c])!=null?K:0)}),n=e.options.map((b,c)=>{let g=Math.max(0,Number(s[c])||0),y=o.total>0?Math.round(g/o.total*100):0;return`
        <button type="button" class="dx-poll-option${o.viewerVote===c?" is-selected":""}" data-dx-poll-vote="${c}" ${a||l.busyVote?"disabled":""}>
          <span class="dx-poll-option-title">${i(b)}</span>
          <div class="dx-poll-bar"><div class="dx-poll-bar-fill" style="width:${y}%"></div></div>
          <div class="dx-poll-row-foot"><span>${g} votes</span><span>${y}%</span></div>
        </button>
      `}).join(""),d=o.publishedSnapshot&&typeof o.publishedSnapshot=="object"?o.publishedSnapshot:null,p=d?`
          <div class="dx-poll-published">
            <p class="dx-poll-meta">Official snapshot v${i(String(d.version||"1"))}${d.publishedAt?` \u2022 ${i(f(d.publishedAt))}`:""}</p>
            ${d.summaryMarkdown?`<p class="dx-poll-meta">${i(String(d.summaryMarkdown).slice(0,280))}</p>`:""}
          </div>
        `:"",$=Array.isArray(t.trend)&&t.trend.length?`
          <div class="dx-poll-published">
            <p class="dx-poll-meta">Trend (90d / day)</p>
            <p class="dx-poll-trend-line">${i(D(t.trend))}</p>
          </div>
        `:"";return`
      <div class="dx-polls-detail">
        <div class="dx-poll-card-head">
          <span class="dx-poll-chip ${a?"":"is-accent"}">${a?"Closed":"Open"}</span>
          <span class="dx-poll-chip">${i(o.mode||"live")}</span>
          ${e.visibility==="members"?'<span class="dx-poll-chip is-members">Members only</span>':""}
        </div>
        <h2 class="dx-poll-question">${i(e.question)}</h2>
        <p class="dx-poll-meta">${a?`Closed ${i(f(e.closeAt))}`:`Closes ${i(f(e.closeAt))} \xB7 ${i(q(e.closeAt))}`}</p>
        ${l.authSnapshot.authenticated?"":'<p class="dx-polls-empty">Sign in to vote. Results remain visible.</p>'}
        ${p}
        ${$}
        <div class="dx-polls-detail-grid">${n}</div>
        <div class="dx-polls-pager">
          <span class="dx-poll-meta">${o.total} total votes</span>
          <a class="dx-poll-link" href="${i(v(l.tab,""))}" data-dx-poll-clear="true" data-dx-hover-variant="none" data-dx-motion-exclude="true" data-dx-soft-nav-skip="true">\u2190 Back</a>
        </div>
      </div>
    `}function _(t){let e=l.collections.open.polls.length?l.collections.open.polls.map(n=>V(n)).join(""):'<p class="dx-polls-empty">No open polls right now.</p>',o=l.collections.closed.polls.length?l.collections.closed.polls.map(n=>V(n,{includeTrend:!0})).join(""):'<p class="dx-polls-empty">No closed polls in this window.</p>',a=l.collections.published.rows.length?l.collections.published.rows.map(n=>dt(n)).join(""):'<p class="dx-polls-empty">No published snapshots yet.</p>',s=l.tab==="open"?`
          <div class="dx-polls-section">
            <p class="dx-polls-section-label">Open</p>
            <div class="dx-polls-list">${e}</div>
          </div>
          <div class="dx-polls-section">
            <p class="dx-polls-section-label">Recently closed</p>
            <div class="dx-polls-list">${o}</div>
          </div>
        `:l.tab==="results"?`
          <div class="dx-polls-section">
            <p class="dx-polls-section-label">Published results</p>
            <div class="dx-polls-list">${a}</div>
          </div>
        `:`
          <div class="dx-polls-section">
            <p class="dx-polls-section-label">Archive &amp; trends</p>
            <div class="dx-polls-list">${o}</div>
            <div class="dx-polls-pager">
              <button type="button" class="dx-poll-action" data-dx-poll-closed-prev="true" ${l.collections.closed.page<=1?"disabled":""}>Previous</button>
              <span class="dx-poll-meta">Page ${l.collections.closed.page} of ${l.collections.closed.pages}</span>
              <button type="button" class="dx-poll-action" data-dx-poll-closed-next="true" ${l.collections.closed.page>=l.collections.closed.pages?"disabled":""}>Next</button>
            </div>
          </div>
        `;t.innerHTML=`
      <section class="dx-polls-shell${l.loading?" dx-polls-loading":""}">
        <header class="dx-polls-head">
          <div>
            <h1 class="dx-polls-title">Polls</h1>
            <p class="dx-polls-subtitle">Open voting, official snapshots, and archive trends.</p>
          </div>
          <nav class="dx-polls-tabs" role="tablist" aria-label="Poll views">
            <button type="button" role="tab" class="dx-polls-tab${l.tab==="open"?" is-active":""}" data-dx-polls-tab="open">Open</button>
            <button type="button" role="tab" class="dx-polls-tab${l.tab==="results"?" is-active":""}" data-dx-polls-tab="results">Results</button>
            <button type="button" role="tab" class="dx-polls-tab${l.tab==="archive"?" is-active":""}" data-dx-polls-tab="archive">Archive</button>
          </nav>
        </header>
        ${l.error?`<p class="dx-polls-error">${i(l.error)}</p>`:""}
        <div class="dx-polls-body">
          <div class="dx-polls-col dx-polls-col--list">${s}</div>
          <aside class="dx-polls-col dx-polls-col--detail">${pt(l.detail)}</aside>
        </div>
      </section>
    `}async function ct(){let[t,e,o]=await Promise.all([u(`/polls?state=open&page=1&pageSize=${W}`),u(`/polls?state=closed&page=${l.closedPage}&pageSize=${Z}`),u(`/polls/published?page=1&pageSize=${J}`)]);if(!t.ok)throw new Error("Unable to load open polls");if(!e.ok)throw new Error("Unable to load closed polls");l.collections.open=B(t.data,1),l.collections.closed=B(e.data,l.closedPage),l.collections.published=o.ok?at(o.data):{rows:[],page:1,pages:1,total:0},l.closedPage=l.collections.closed.page}async function H(t){try{let e=await u(`/polls/${encodeURIComponent(t)}/trend?bucket=day&window=90d`);return e.ok?st(e.data):[]}catch{return[]}}async function Q(t){var b,c;let e=r(t);if(!e){l.detail=null;return}let o=l.detailCache.get(e);if(o&&Date.now()-o.cachedAt<=tt&&!l.busyVote){l.detail=o.value;return}let a=await u(`/polls/${encodeURIComponent(e)}`);if(a.status===401||a.status===403){l.detail={locked:!0,pollId:e};return}if(!a.ok)throw new Error(`Unable to load poll ${e}`);let s=h(((b=a.data)==null?void 0:b.poll)||a.data),n=await u(`/polls/${encodeURIComponent(e)}/results`);if(!n.ok)throw new Error(`Unable to load poll results (${e})`);let d=lt(((c=n.data)==null?void 0:c.results)||n.data),p=await H(e),$={locked:!1,poll:s,results:d,trend:p};l.detail=$,l.detailCache.set(e,{cachedAt:Date.now(),value:$})}async function ut(t){if(!(!l.detail||l.detail.locked||l.busyVote)&&!(!Number.isInteger(t)||t<0)){if(l.authSnapshot=await U(),!l.authSnapshot.authenticated){await O();return}l.busyVote=!0;try{let e=l.detail.poll.id;if(!(await u(`/polls/${encodeURIComponent(e)}/vote`,{method:"POST",authRequired:!0,body:{optionIndex:t}})).ok)throw new Error("Vote failed");l.detailCache.delete(e),await Q(e)}finally{l.busyVote=!1}}}function I(t){t.querySelectorAll("[data-dx-polls-tab]").forEach(a=>{a.addEventListener("click",async()=>{let s=S(a.getAttribute("data-dx-polls-tab"));s!==l.tab&&(l.tab=s,l.error="",L({tab:l.tab,pollId:l.pollId},!1),await w(t))})}),t.querySelectorAll("[data-dx-poll-signin]").forEach(a=>{a.addEventListener("click",async s=>{s.preventDefault(),await O()})}),t.querySelectorAll("[data-dx-poll-vote]").forEach(a=>{a.addEventListener("click",async()=>{let s=Number(a.getAttribute("data-dx-poll-vote"));await ut(s),_(t),I(t)})});let e=t.querySelector("[data-dx-poll-closed-prev]");e&&e.addEventListener("click",async()=>{l.closedPage<=1||(l.closedPage-=1,await w(t))});let o=t.querySelector("[data-dx-poll-closed-next]");o&&o.addEventListener("click",async()=>{l.closedPage+=1,await w(t)})}async function ft(){if(l.tab!=="archive")return;let t=l.collections.closed.polls.slice(0,3);t.length&&await Promise.all(t.map(async e=>{if(!e.id)return;let o=await H(e.id);e.__trendPoints=o}))}async function w(t){l.loading=!0,_(t),I(t);try{await ct(),await ft(),await Q(l.pollId),l.error=""}catch(e){l.error=e instanceof Error?e.message:String(e)}finally{l.loading=!1,_(t),I(t)}}async function F(t){let e=performance.now()-t;e>=N||await new Promise(o=>window.setTimeout(o,N-e))}async function xt(){let t=E();if(!t)return;it();let e=performance.now();P(t,"loading");let o=T(t);l.tab=o.tab,l.pollId=o.pollId,L({tab:l.tab,pollId:l.pollId},!0);try{l.authSnapshot=await U(),await w(t),await F(e),P(t,"ready")}catch(a){console.error("[dx-polls] boot error",a),rt(t,"Unable to load polls right now. Please try again."),await F(e),P(t,"error")}}let x=null,M=!1,X="";function G(){let t=T(E()),e=R(window.location.pathname||"/"),o=r(window.location.search||"");return`${e}?${o}|${t.tab}|${t.pollId}`}async function ht(){do M=!1,await xt(),X=G();while(M)}function m(){if(!x){let t=E();if(t&&t.getAttribute("data-dx-fetch-state")==="ready"&&G()===X)return Promise.resolve()}return x?(M=!0,x):(x=ht().catch(t=>{console.error("[dx-polls] queue boot error",t)}).finally(()=>{x=null}),x)}window.__dxPollsQueueBoot=m,window.addEventListener("dx:slotready",()=>{m().catch(()=>{})},{once:!0}),window.addEventListener("popstate",()=>{m().catch(()=>{})}),document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{m().catch(()=>{})},{once:!0}):m().catch(()=>{})})();})();
