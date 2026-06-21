(()=>{(()=>{if(typeof window=="undefined"||typeof document=="undefined")return;if(window.__dxPollsAppLoaded&&typeof window.__dxPollsQueueBoot=="function"){try{window.__dxPollsQueueBoot()}catch{}return}window.__dxPollsAppLoaded=!0;let z="dx-polls-app-style-v2",N=120,Z=16,J=10,W=12,A="open",Y=new Set(["open","results","archive"]),ee=45e3,o={tab:A,pollId:"",closedPage:1,archiveDrawerOpen:!1,authSnapshot:{auth:null,authenticated:!1,token:null,user:null},collections:{open:{polls:[],page:1,pages:1,total:0},closed:{polls:[],page:1,pages:1,total:0},published:{rows:[],page:1,pages:1,total:0}},detail:null,detailCache:new Map,loading:!1,error:"",busyVote:!1};function r(e){return String(e!=null?e:"").trim()}function i(e){return String(e!=null?e:"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function D(e){let t=String(e||"/").replace(/\/+/g,"/");return t==="/"?"/":t.endsWith("/")?t.slice(0,-1):t}function S(e){let t=r(e).toLowerCase();return Y.has(t)?t:A}function T(e=null){let t=new URLSearchParams(window.location.search||""),l=r(t.get("poll")),a=S(t.get("tab"));if(e instanceof Element){let n=r(e.getAttribute("data-dx-poll-id"));n&&!l&&(l=n,a="open")}let s=D(window.location.pathname||"/");if(s.startsWith("/polls/")){let n=s.slice(7).replace(/\/index\.html$/i,"").replace(/\/$/,"");n&&(l=decodeURIComponent(n),a="open")}return{tab:a,pollId:l}}function y(e,t=""){let l=new URLSearchParams,a=S(e),s=r(t);if(a==="open"&&s)return`/polls/${encodeURIComponent(s)}/`;a!==A&&l.set("tab",a),s&&l.set("poll",s);let n=l.toString();return`/polls/${n?`?${n}`:""}`}function q({tab:e,pollId:t},l=!1){let a=y(e,t),s=a.replace(/\/index\.html$/,"/");`${window.location.pathname}${window.location.search}`!==s&&(l?window.history.replaceState({},"",a):window.history.pushState({},"",a))}function k(e){let t=Date.parse(String(e||""));return Number.isFinite(t)?t:null}function x(e){let t=k(e);if(!t)return"TBD";try{return new Date(t).toLocaleString(void 0,{year:"numeric",month:"short",day:"numeric"})}catch{return new Date(t).toISOString().slice(0,10)}}function L(e){let t=k(e);if(!t)return"Closing date TBD";let l=t-Date.now();if(l<=0)return"Closed";let a=Math.floor(l/36e5),s=Math.floor(a/24),n=a%24;return s>0?`${s}d ${n}h left`:a>0?`${a}h left`:`${Math.max(1,Math.floor(l/6e4))}m left`}function te(e){return Array.isArray(e)?e.map(t=>r(t)).filter(Boolean):typeof e=="string"?e.split("|").map(t=>r(t)).filter(Boolean):[]}function m(e){let t=e&&typeof e=="object"?e:{};return{id:r(t.id),slug:r(t.slug)||null,status:r(t.status)||"draft",question:r(t.question)||"Untitled poll",options:te(t.options),createdAt:r(t.createdAt||t.created_at),closeAt:r(t.closeAt||t.close_at),manualClose:!!(t.manualClose||t.manual_close),visibility:r(t.visibility)==="members"?"members":"public",closed:!!t.closed}}function le(e){let t={};if(!e||typeof e!="object")return t;for(let[l,a]of Object.entries(e)){let s=Number(a);!Number.isFinite(s)||s<0||(t[String(l)]=Math.floor(s))}return t}function oe(e){let t=e&&typeof e=="object"?e:{};return{total:Math.max(0,Number(t.total||0)||0),counts:Array.isArray(t.counts)?t.counts.map(l=>Math.max(0,Number(l)||0)):le(t.counts),viewerVote:Number.isInteger(Number(t.viewerVote))?Number(t.viewerVote):null,closed:!!t.closed,mode:r(t.mode||"live")||"live",publishedSnapshot:t.publishedSnapshot&&typeof t.publishedSnapshot=="object"?t.publishedSnapshot:null}}function R(e,t=1){if(Array.isArray(e))return{polls:e.map(m),page:t,pages:1,total:e.length};let l=e&&typeof e=="object"?e:{},s=[l.polls,l.items,l.data,l.rows].find(n=>Array.isArray(n))||[];return{polls:s.map(m),page:Math.max(1,Number(l.page)||t),pages:Math.max(1,Number(l.pages||l.totalPages)||1),total:Math.max(0,Number(l.total||l.count||s.length)||0)}}function ae(e){let t=e&&typeof e=="object"?e:{},l=Array.isArray(t.items)?t.items:Array.isArray(t.rows)?t.rows:Array.isArray(t.polls)?t.polls:[];return{rows:l.map(a=>{let s=a!=null&&a.poll&&typeof a.poll=="object"?a.poll:a,n=a!=null&&a.publishedSnapshot&&typeof a.publishedSnapshot=="object"?a.publishedSnapshot:a!=null&&a.snapshot&&typeof a.snapshot=="object"?a.snapshot:null;return{poll:m(s),snapshot:n}}),page:Math.max(1,Number(t.page)||1),pages:Math.max(1,Number(t.pages||t.totalPages)||1),total:Math.max(0,Number(t.total||t.count||l.length)||0)}}function se(e){let t=e&&typeof e=="object"?e:{},l=t.trend&&typeof t.trend=="object"?t.trend:t;return(Array.isArray(l.series)?l.series:Array.isArray(l.points)?l.points:[]).map(s=>{var n,d,p;return{t:r(s.t||s.bucket||s.timestamp||s.date||s.label),value:Math.max(0,Number((p=(d=(n=s.value)!=null?n:s.count)!=null?d:s.total)!=null?p:0)||0)}}).filter(s=>s.t)}function B(e=[]){let t="\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588";if(!Array.isArray(e)||e.length===0)return"";let l=e.map(s=>Math.max(0,Number(s.value)||0)),a=Math.max(...l,0);return a<=0?"\u2581".repeat(l.length):l.map(s=>{let n=s/a,d=Math.max(0,Math.min(t.length-1,Math.round(n*(t.length-1))));return t[d]}).join("")}function j(e){if(!e||e.status==="closed"||e.manualClose||e.closed)return!0;let t=k(e.closeAt);return t?t<=Date.now():!1}function ne(){return r(window.DEX_API_BASE_URL||window.DEX_API_ORIGIN||"https://dex-api.spring-fog-8edd.workers.dev").replace(/\/$/,"")}async function U(){let e=window.DEX_AUTH||window.dexAuth||null;if(!e)return{auth:null,authenticated:!1,token:null,user:null};try{typeof e.resolve=="function"?await e.resolve(2400):e.ready&&typeof e.ready.then=="function"&&await e.ready}catch{}let t=!1;try{typeof e.isAuthenticated=="function"&&(t=!!await e.isAuthenticated())}catch{}let l=null;if(t&&typeof e.getAccessToken=="function")try{l=await e.getAccessToken()}catch{l=null}let a=null;try{typeof e.getUser=="function"&&(a=await e.getUser())}catch{}return{auth:e,authenticated:t,token:l,user:a}}async function O(){var e;if(!(!((e=o.authSnapshot)!=null&&e.auth)||typeof o.authSnapshot.auth.signIn!="function"))try{await o.authSnapshot.auth.signIn({returnTo:`${window.location.pathname}${window.location.search}${window.location.hash}`})}catch{}}async function u(e,{method:t="GET",body:l=null,authRequired:a=!1}={}){var p;let s={accept:"application/json"};if(l!=null&&(s["content-type"]="application/json"),(p=o.authSnapshot)!=null&&p.token&&(s.authorization=`Bearer ${o.authSnapshot.token}`),a&&!s.authorization)return{ok:!1,status:401,data:{error:"AUTH_REQUIRED"}};let n=await fetch(`${ne()}${e}`,{method:t,headers:s,body:l==null?void 0:JSON.stringify(l)}),d=null;try{d=await n.json()}catch{d=null}return{ok:n.ok,status:n.status,data:d}}function P(e,t){e.setAttribute("data-dx-fetch-state",t),t==="loading"?e.setAttribute("aria-busy","true"):e.removeAttribute("aria-busy")}function ie(){if(document.getElementById(z))return;let e=document.createElement("style");e.id=z,e.textContent=`
      .dx-polls-shell{
        --dx-polls-gap: clamp(14px,1.6vw,20px);
        --dx-polls-line: rgba(255,255,255,.14);
        --dx-polls-line-strong: rgba(255,255,255,.26);
        --dx-polls-ink:#f3f3f4;
        --dx-polls-muted:rgba(255,255,255,.66);
        --dx-polls-faint:rgba(255,255,255,.42);
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
      .dx-polls-title{margin:0;font-family:var(--font-heading);text-transform:uppercase;font-size:clamp(1.6rem,4vw,2.5rem);letter-spacing:.01em;line-height:1;color:var(--dx-polls-ink)!important}
      .dx-polls-subtitle{margin:8px 0 0 0;font-family:var(--font-body);font-size:.82rem;letter-spacing:.01em;color:var(--dx-polls-muted)}
      .dx-polls-tabs{display:flex;gap:clamp(14px,2vw,26px);flex-wrap:wrap;align-items:center}
      /* Tabs mirror the header nav: gradient underline that wipes in on hover/active. */
      .dx-polls-tab{
        appearance:none;background:none;border:0;cursor:pointer;padding:0 0 7px;position:relative;
        font-family:var(--font-body);font-size:.72rem;text-transform:uppercase;letter-spacing:.16em;
        color:var(--dx-polls-ink);mix-blend-mode:normal;isolation:auto;text-shadow:none;
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
      .dx-polls-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:9px}
      .dx-polls-col{min-height:0}
      .dx-polls-col--detail{
        position:sticky;top:0;align-self:start;
        border-left:1px solid var(--dx-polls-line);
        padding-left:clamp(16px,2vw,32px);
      }

      .dx-polls-section + .dx-polls-section{margin-top:28px}
      .dx-polls-section--current{display:grid;gap:10px}
      .dx-polls-section--current .dx-polls-list{gap:4px}
      .dx-polls-section--current .dx-poll-card{padding-block:clamp(18px,2.1vw,28px)}
      .dx-polls-section--current .dx-poll-question{font-size:clamp(1.22rem,2vw,1.72rem)}
      .dx-polls-archive-drawer{
        margin-top:clamp(20px,2.2vw,28px);
        border-top:1px solid var(--dx-polls-line);
        border-bottom:1px solid var(--dx-polls-line);
      }
      .dx-polls-archive-drawer > summary{
        min-height:48px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        cursor:pointer;
        list-style:none;
        color:var(--dx-polls-ink);
        font-family:var(--font-body);
        font-size:.72rem;
        letter-spacing:.14em;
        text-transform:uppercase;
      }
      .dx-polls-archive-drawer > summary::-webkit-details-marker{display:none}
      .dx-polls-archive-drawer > summary::after{
        content:"+";
        font-family:var(--font-heading);
        font-size:1rem;
        line-height:1;
        color:var(--dx-polls-accent);
      }
      .dx-polls-archive-drawer[open] > summary::after{content:"-"}
      .dx-polls-archive-count{
        color:var(--dx-polls-muted);
        font-family:var(--font-body);
        font-size:.68rem;
        letter-spacing:.08em;
      }
      .dx-polls-archive-panel{padding:0 0 clamp(12px,1.5vw,18px)}
      .dx-polls-section-label{margin:0 0 4px;font-family:var(--font-body);font-size:.66rem;text-transform:uppercase;letter-spacing:.16em;color:var(--dx-polls-muted)}
      .dx-polls-detail > .dx-polls-section-label,
      .dx-polls-detail > .dx-polls-empty{color:var(--dx-polls-muted);mix-blend-mode:normal;isolation:auto;text-shadow:none}

      .dx-polls-list{display:grid;gap:0}
      .dx-poll-card{
        position:relative;isolation:auto;background:transparent;
        display:grid;gap:7px;padding:15px 0;
        border-top:1px solid var(--dx-polls-line);
      }
      .dx-poll-card:first-child{border-top:0}
      .dx-poll-card.is-locked{opacity:.72}
      .dx-poll-card:hover .dx-poll-question{color:var(--dx-polls-accent);mix-blend-mode:normal;isolation:auto}
      .dx-poll-card-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
      .dx-poll-chip{font-family:var(--font-body);font-size:.62rem;text-transform:uppercase;letter-spacing:.14em;color:var(--dx-polls-muted)}
      .dx-poll-chip.is-accent{color:var(--dx-polls-accent)}
      .dx-poll-chip.is-members{color:var(--dx-polls-ink)}
      .dx-poll-question{position:relative;margin:0;font-family:var(--font-heading);font-size:clamp(1rem,1.3vw,1.18rem);line-height:1.16;letter-spacing:.01em;text-transform:uppercase;transition:color .15s ease}
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
    `,document.head.appendChild(e)}function E(){return document.querySelector("[data-dx-polls-app]")||document.getElementById("dx-polls-app")||document.getElementById("dex-console")}function re(e,t){e.innerHTML=`
      <section class="dx-polls-shell">
        <header class="dx-polls-head">
          <h1 class="dx-polls-title">Polls</h1>
        </header>
        <div class="dx-polls-body">
          <p class="dx-polls-error">${i(t||"Unable to load polls right now.")}</p>
        </div>
      </section>
    `}function V(e,{includeTrend:t=!1}={}){let l=j(e),a=e.visibility==="members"&&!o.authSnapshot.authenticated,s=y(o.tab,e.id),n=t&&Array.isArray(e.__trendPoints)&&e.__trendPoints.length?`<p class="dx-poll-trend">90d trend</p><p class="dx-poll-trend-line">${i(B(e.__trendPoints))}</p>`:"";return`
      <article class="dx-poll-card${a?" is-locked":""}" data-dx-poll-id="${i(e.id)}">
        <div class="dx-poll-card-head">
          <span class="dx-poll-chip ${l?"":"is-accent"}">${l?"Closed":"Open"}</span>
          ${e.visibility==="members"?'<span class="dx-poll-chip is-members">Members only</span>':""}
        </div>
        <h3 class="dx-poll-question">${i(e.question)}</h3>
        <p class="dx-poll-meta">${l?`Closed ${i(x(e.closeAt))}`:`Closes ${i(x(e.closeAt))} (${i(L(e.closeAt))})`}</p>
        ${n}
        <div class="dx-poll-actions">
          <a class="dx-poll-link is-primary" href="${i(s)}" data-dx-poll-open="${i(e.id)}" data-dx-soft-nav-skip="true">View Poll</a>
          ${a?'<button class="dx-poll-action" type="button" data-dx-poll-signin="true">Sign in</button>':""}
        </div>
      </article>
    `}function de(e){var p;let t=e.poll||m({}),l=e.snapshot&&typeof e.snapshot=="object"?e.snapshot:null,a=Number((l==null?void 0:l.total)||((p=l==null?void 0:l.totals)==null?void 0:p.total)||0)||0,s=r((l==null?void 0:l.headline)||""),n=r((l==null?void 0:l.summaryMarkdown)||(l==null?void 0:l.summary)||""),d=r((l==null?void 0:l.publishedAt)||(l==null?void 0:l.published_at));return`
      <article class="dx-poll-card" data-dx-poll-id="${i(t.id)}">
        <div class="dx-poll-card-head">
          <span class="dx-poll-chip">Published</span>
          ${t.visibility==="members"?'<span class="dx-poll-chip is-members">Members only</span>':""}
        </div>
        <h3 class="dx-poll-question">${i(s||t.question)}</h3>
        <p class="dx-poll-meta">${d?`Published ${i(x(d))}`:"Official snapshot"} \u2022 ${a} votes</p>
        ${n?`<div class="dx-poll-published">${i(n.slice(0,220))}</div>`:""}
        <div class="dx-poll-actions">
          <a class="dx-poll-link is-primary" href="${i(y("results",t.id))}" data-dx-poll-open="${i(t.id)}" data-dx-soft-nav-skip="true">View snapshot</a>
        </div>
      </article>
    `}function pe(e){if(!e)return`
        <div class="dx-polls-detail">
          <p class="dx-polls-section-label">Detail</p>
          <h2 class="dx-poll-question">Select a poll</h2>
          <p class="dx-polls-empty">Choose a poll to see live results, published snapshots, and vote state.</p>
        </div>
      `;if(e.locked)return`
        <div class="dx-polls-detail">
          <p class="dx-polls-section-label">Members poll</p>
          <h2 class="dx-poll-question">Sign in required</h2>
          <p class="dx-polls-empty">This poll is for members only.</p>
          <div class="dx-poll-actions">
            <button type="button" class="dx-poll-link is-primary" data-dx-poll-signin="true">Sign in to continue \u2192</button>
          </div>
        </div>
      `;let t=e.poll,l=e.results,a=j(t)||!!l.closed,s=Array.isArray(l.counts)?l.counts:t.options.map((b,c)=>{var g,v,C,K;return Number((K=(C=(g=l.counts)==null?void 0:g[String(c)])!=null?C:(v=l.counts)==null?void 0:v[c])!=null?K:0)}),n=t.options.map((b,c)=>{let g=Math.max(0,Number(s[c])||0),v=l.total>0?Math.round(g/l.total*100):0;return`
        <button type="button" class="dx-poll-option${l.viewerVote===c?" is-selected":""}" data-dx-poll-vote="${c}" ${a||o.busyVote?"disabled":""}>
          <span class="dx-poll-option-title">${i(b)}</span>
          <div class="dx-poll-bar"><div class="dx-poll-bar-fill" style="width:${v}%"></div></div>
          <div class="dx-poll-row-foot"><span>${g} votes</span><span>${v}%</span></div>
        </button>
      `}).join(""),d=l.publishedSnapshot&&typeof l.publishedSnapshot=="object"?l.publishedSnapshot:null,p=d?`
          <div class="dx-poll-published">
            <p class="dx-poll-meta">Official snapshot v${i(String(d.version||"1"))}${d.publishedAt?` \u2022 ${i(x(d.publishedAt))}`:""}</p>
            ${d.summaryMarkdown?`<p class="dx-poll-meta">${i(String(d.summaryMarkdown).slice(0,280))}</p>`:""}
          </div>
        `:"",$=Array.isArray(e.trend)&&e.trend.length?`
          <div class="dx-poll-published">
            <p class="dx-poll-meta">Trend (90d / day)</p>
            <p class="dx-poll-trend-line">${i(B(e.trend))}</p>
          </div>
        `:"";return`
      <div class="dx-polls-detail">
        <div class="dx-poll-card-head">
          <span class="dx-poll-chip ${a?"":"is-accent"}">${a?"Closed":"Open"}</span>
          <span class="dx-poll-chip">${i(l.mode||"live")}</span>
          ${t.visibility==="members"?'<span class="dx-poll-chip is-members">Members only</span>':""}
        </div>
        <h2 class="dx-poll-question">${i(t.question)}</h2>
        <p class="dx-poll-meta">${a?`Closed ${i(x(t.closeAt))}`:`Closes ${i(x(t.closeAt))} \xB7 ${i(L(t.closeAt))}`}</p>
        ${o.authSnapshot.authenticated?"":'<p class="dx-polls-empty">Sign in to vote. Results remain visible.</p>'}
        ${p}
        ${$}
        <div class="dx-polls-detail-grid">${n}</div>
        <div class="dx-polls-pager">
          <span class="dx-poll-meta">${l.total} total votes</span>
          <a class="dx-poll-link" href="${i(y(o.tab,""))}" data-dx-poll-clear="true" data-dx-hover-variant="none" data-dx-motion-exclude="true" data-dx-soft-nav-skip="true">\u2190 Back</a>
        </div>
      </div>
    `}function _(e){let t=o.collections.open.polls.length?o.collections.open.polls.map(n=>V(n)).join(""):'<p class="dx-polls-empty">No open polls right now.</p>',l=o.collections.closed.polls.length?o.collections.closed.polls.map(n=>V(n,{includeTrend:!0})).join(""):'<p class="dx-polls-empty">No closed polls in this window.</p>',a=o.collections.published.rows.length?o.collections.published.rows.map(n=>de(n)).join(""):'<p class="dx-polls-empty">No published snapshots yet.</p>',s=o.tab==="open"?`
          <div class="dx-polls-section dx-polls-section--current">
            <p class="dx-polls-section-label">Current polls</p>
            <div class="dx-polls-list">${t}</div>
          </div>
          <details class="dx-polls-archive-drawer" data-dx-polls-archive-drawer="true" ${o.archiveDrawerOpen?"open":""}>
            <summary>
              <span>Past polls</span>
              <span class="dx-polls-archive-count">${o.collections.closed.total} archived</span>
            </summary>
            <div class="dx-polls-archive-panel">
              <div class="dx-polls-list">${l}</div>
              <div class="dx-polls-pager">
                <button type="button" class="dx-poll-action" data-dx-poll-closed-prev="true" ${o.collections.closed.page<=1?"disabled":""}>Previous</button>
                <span class="dx-poll-meta">Page ${o.collections.closed.page} of ${o.collections.closed.pages}</span>
                <button type="button" class="dx-poll-action" data-dx-poll-closed-next="true" ${o.collections.closed.page>=o.collections.closed.pages?"disabled":""}>Next</button>
              </div>
            </div>
          </details>
        `:o.tab==="results"?`
          <div class="dx-polls-section">
            <p class="dx-polls-section-label">Published results</p>
            <div class="dx-polls-list">${a}</div>
          </div>
        `:`
          <div class="dx-polls-section">
            <p class="dx-polls-section-label">Archive &amp; trends</p>
            <div class="dx-polls-list">${l}</div>
            <div class="dx-polls-pager">
              <button type="button" class="dx-poll-action" data-dx-poll-closed-prev="true" ${o.collections.closed.page<=1?"disabled":""}>Previous</button>
              <span class="dx-poll-meta">Page ${o.collections.closed.page} of ${o.collections.closed.pages}</span>
              <button type="button" class="dx-poll-action" data-dx-poll-closed-next="true" ${o.collections.closed.page>=o.collections.closed.pages?"disabled":""}>Next</button>
            </div>
          </div>
        `;e.innerHTML=`
      <section class="dx-polls-shell${o.loading?" dx-polls-loading":""}">
        <header class="dx-polls-head">
          <div>
            <h1 class="dx-polls-title">Polls</h1>
            <p class="dx-polls-subtitle">Open voting, official snapshots, and archive trends.</p>
          </div>
          <nav class="dx-polls-tabs" role="tablist" aria-label="Poll views">
            <button type="button" role="tab" class="dx-polls-tab${o.tab==="open"?" is-active":""}" data-dx-polls-tab="open">Open</button>
            <button type="button" role="tab" class="dx-polls-tab${o.tab==="results"?" is-active":""}" data-dx-polls-tab="results">Results</button>
            <button type="button" role="tab" class="dx-polls-tab${o.tab==="archive"?" is-active":""}" data-dx-polls-tab="archive">Archive</button>
          </nav>
        </header>
        ${o.error?`<p class="dx-polls-error">${i(o.error)}</p>`:""}
        <div class="dx-polls-body">
          <div class="dx-polls-col dx-polls-col--list">${s}</div>
          <aside class="dx-polls-col dx-polls-col--detail">${pe(o.detail)}</aside>
        </div>
      </section>
    `}async function ce(){let[e,t,l]=await Promise.all([u(`/polls?state=open&page=1&pageSize=${Z}`),u(`/polls?state=closed&page=${o.closedPage}&pageSize=${J}`),u(`/polls/published?page=1&pageSize=${W}`)]);if(!e.ok)throw new Error("Unable to load open polls");if(!t.ok)throw new Error("Unable to load closed polls");o.collections.open=R(e.data,1),o.collections.closed=R(t.data,o.closedPage),o.collections.published=l.ok?ae(l.data):{rows:[],page:1,pages:1,total:0},o.closedPage=o.collections.closed.page}async function H(e){try{let t=await u(`/polls/${encodeURIComponent(e)}/trend?bucket=day&window=90d`);return t.ok?se(t.data):[]}catch{return[]}}async function Q(e){var b,c;let t=r(e);if(!t){o.detail=null;return}let l=o.detailCache.get(t);if(l&&Date.now()-l.cachedAt<=ee&&!o.busyVote){o.detail=l.value;return}let a=await u(`/polls/${encodeURIComponent(t)}`);if(a.status===401||a.status===403){o.detail={locked:!0,pollId:t};return}if(!a.ok)throw new Error(`Unable to load poll ${t}`);let s=m(((b=a.data)==null?void 0:b.poll)||a.data),n=await u(`/polls/${encodeURIComponent(t)}/results`);if(!n.ok)throw new Error(`Unable to load poll results (${t})`);let d=oe(((c=n.data)==null?void 0:c.results)||n.data),p=await H(t),$={locked:!1,poll:s,results:d,trend:p};o.detail=$,o.detailCache.set(t,{cachedAt:Date.now(),value:$})}async function ue(e){if(!(!o.detail||o.detail.locked||o.busyVote)&&!(!Number.isInteger(e)||e<0)){if(o.authSnapshot=await U(),!o.authSnapshot.authenticated){await O();return}o.busyVote=!0;try{let t=o.detail.poll.id;if(!(await u(`/polls/${encodeURIComponent(t)}/vote`,{method:"POST",authRequired:!0,body:{optionIndex:e}})).ok)throw new Error("Vote failed");o.detailCache.delete(t),await Q(t)}finally{o.busyVote=!1}}}function I(e){e.querySelectorAll("[data-dx-polls-tab]").forEach(s=>{s.addEventListener("click",async()=>{let n=S(s.getAttribute("data-dx-polls-tab"));n!==o.tab&&(o.tab=n,o.error="",q({tab:o.tab,pollId:o.pollId},!1),await w(e))})}),e.querySelectorAll("[data-dx-poll-signin]").forEach(s=>{s.addEventListener("click",async n=>{n.preventDefault(),await O()})}),e.querySelectorAll("[data-dx-poll-vote]").forEach(s=>{s.addEventListener("click",async()=>{let n=Number(s.getAttribute("data-dx-poll-vote"));await ue(n),_(e),I(e)})});let t=e.querySelector("[data-dx-polls-archive-drawer]");t&&t.addEventListener("toggle",()=>{o.archiveDrawerOpen=!!t.open});let l=e.querySelector("[data-dx-poll-closed-prev]");l&&l.addEventListener("click",async()=>{o.closedPage<=1||(o.closedPage-=1,await w(e))});let a=e.querySelector("[data-dx-poll-closed-next]");a&&a.addEventListener("click",async()=>{o.closedPage+=1,await w(e)})}async function xe(){if(o.tab!=="archive")return;let e=o.collections.closed.polls.slice(0,3);e.length&&await Promise.all(e.map(async t=>{if(!t.id)return;let l=await H(t.id);t.__trendPoints=l}))}async function w(e){o.loading=!0,_(e),I(e);try{await ce(),await xe(),await Q(o.pollId),o.error=""}catch(t){o.error=t instanceof Error?t.message:String(t)}finally{o.loading=!1,_(e),I(e)}}async function F(e){let t=performance.now()-e;t>=N||await new Promise(l=>window.setTimeout(l,N-t))}async function fe(){let e=E();if(!e)return;ie();let t=performance.now();P(e,"loading");let l=T(e);o.tab=l.tab,o.pollId=l.pollId,q({tab:o.tab,pollId:o.pollId},!0);try{o.authSnapshot=await U(),await w(e),await F(t),P(e,"ready")}catch(a){console.error("[dx-polls] boot error",a),re(e,"Unable to load polls right now. Please try again."),await F(t),P(e,"error")}}let f=null,M=!1,X="";function G(){let e=T(E()),t=D(window.location.pathname||"/"),l=r(window.location.search||"");return`${t}?${l}|${e.tab}|${e.pollId}`}async function me(){do M=!1,await fe(),X=G();while(M)}function h(){if(!f){let e=E();if(e&&e.getAttribute("data-dx-fetch-state")==="ready"&&G()===X)return Promise.resolve()}return f?(M=!0,f):(f=me().catch(e=>{console.error("[dx-polls] queue boot error",e)}).finally(()=>{f=null}),f)}window.__dxPollsQueueBoot=h,window.addEventListener("dx:slotready",()=>{h().catch(()=>{})},{once:!0}),window.addEventListener("popstate",()=>{h().catch(()=>{})}),document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{h().catch(()=>{})},{once:!0}):h().catch(()=>{})})();})();
