(()=>{(()=>{if(typeof window=="undefined"||typeof document=="undefined")return;if(window.__dxPollsAppLoaded&&typeof window.__dxPollsQueueBoot=="function"){try{window.__dxPollsQueueBoot()}catch{}return}window.__dxPollsAppLoaded=!0;let j="dx-polls-app-style-v2",O=120,re=16,ie=10,de=12,_="open",pe=new Set(["open","results","archive"]),U=45e3,a={tab:_,pollId:"",closedPage:1,archiveDrawerOpen:!1,authSnapshot:{auth:null,authenticated:!1,token:null,user:null},collections:{open:{polls:[],page:1,pages:1,total:0},closed:{polls:[],page:1,pages:1,total:0},published:{rows:[],page:1,pages:1,total:0}},detail:null,detailCache:new Map,loading:!1,error:"",busyVote:!1};function d(e){return String(e!=null?e:"").trim()}function i(e){return String(e!=null?e:"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function H(e){let t=String(e||"/").replace(/\/+/g,"/");return t==="/"?"/":t.endsWith("/")?t.slice(0,-1):t}function z(e){let t=d(e).toLowerCase();return pe.has(t)?t:_}function C(e=null){let t=new URLSearchParams(window.location.search||""),o=d(t.get("poll")),l=z(t.get("tab"));if(e instanceof Element){let n=d(e.getAttribute("data-dx-poll-id"));n&&!o&&(o=n,l="open")}let s=H(window.location.pathname||"/");if(s.startsWith("/polls/")){let n=s.slice(7).replace(/\/index\.html$/i,"").replace(/\/$/,"");n&&(o=decodeURIComponent(n),l="open")}return{tab:l,pollId:o}}function L(e,t=""){let o=new URLSearchParams,l=z(e),s=d(t);if(l==="open"&&s)return`/polls/${encodeURIComponent(s)}/`;l!==_&&o.set("tab",l),s&&o.set("poll",s);let n=o.toString();return`/polls/${n?`?${n}`:""}`}function $({tab:e,pollId:t},o=!1){let l=L(e,t),s=l.replace(/\/index\.html$/,"/");`${window.location.pathname}${window.location.search}`!==s&&(o?window.history.replaceState({},"",l):window.history.pushState({},"",l))}function T(e){let t=Date.parse(String(e||""));return Number.isFinite(t)?t:null}function f(e){let t=T(e);if(!t)return"TBD";try{return new Date(t).toLocaleString(void 0,{year:"numeric",month:"short",day:"numeric"})}catch{return new Date(t).toISOString().slice(0,10)}}function F(e){let t=T(e);if(!t)return"Closing date TBD";let o=t-Date.now();if(o<=0)return"Closed";let l=Math.floor(o/36e5),s=Math.floor(l/24),n=l%24;return s>0?`${s}d ${n}h left`:l>0?`${l}h left`:`${Math.max(1,Math.floor(o/6e4))}m left`}function ce(e){return Array.isArray(e)?e.map(t=>d(t)).filter(Boolean):typeof e=="string"?e.split("|").map(t=>d(t)).filter(Boolean):[]}function y(e){let t=e&&typeof e=="object"?e:{};return{id:d(t.id),slug:d(t.slug)||null,status:d(t.status)||"draft",question:d(t.question)||"Untitled poll",options:ce(t.options),createdAt:d(t.createdAt||t.created_at),closeAt:d(t.closeAt||t.close_at),manualClose:!!(t.manualClose||t.manual_close),visibility:d(t.visibility)==="members"?"members":"public",closed:!!t.closed}}function ue(e){let t={};if(!e||typeof e!="object")return t;for(let[o,l]of Object.entries(e)){let s=Number(l);!Number.isFinite(s)||s<0||(t[String(o)]=Math.floor(s))}return t}function me(e){let t=e&&typeof e=="object"?e:{};return{total:Math.max(0,Number(t.total||0)||0),counts:Array.isArray(t.counts)?t.counts.map(o=>Math.max(0,Number(o)||0)):ue(t.counts),viewerVote:Number.isInteger(Number(t.viewerVote))?Number(t.viewerVote):null,closed:!!t.closed,mode:d(t.mode||"live")||"live",publishedSnapshot:t.publishedSnapshot&&typeof t.publishedSnapshot=="object"?t.publishedSnapshot:null}}function V(e,t=1){if(Array.isArray(e))return{polls:e.map(y),page:t,pages:1,total:e.length};let o=e&&typeof e=="object"?e:{},s=[o.polls,o.items,o.data,o.rows].find(n=>Array.isArray(n))||[];return{polls:s.map(y),page:Math.max(1,Number(o.page)||t),pages:Math.max(1,Number(o.pages||o.totalPages)||1),total:Math.max(0,Number(o.total||o.count||s.length)||0)}}function xe(e){let t=e&&typeof e=="object"?e:{},o=Array.isArray(t.items)?t.items:Array.isArray(t.rows)?t.rows:Array.isArray(t.polls)?t.polls:[];return{rows:o.map(l=>{let s=l!=null&&l.poll&&typeof l.poll=="object"?l.poll:l,n=l!=null&&l.publishedSnapshot&&typeof l.publishedSnapshot=="object"?l.publishedSnapshot:l!=null&&l.snapshot&&typeof l.snapshot=="object"?l.snapshot:null;return{poll:y(s),snapshot:n}}),page:Math.max(1,Number(t.page)||1),pages:Math.max(1,Number(t.pages||t.totalPages)||1),total:Math.max(0,Number(t.total||t.count||o.length)||0)}}function fe(e){let t=e&&typeof e=="object"?e:{},o=t.trend&&typeof t.trend=="object"?t.trend:t;return(Array.isArray(o.series)?o.series:Array.isArray(o.points)?o.points:[]).map(s=>{var n,r,p;return{t:d(s.t||s.bucket||s.timestamp||s.date||s.label),value:Math.max(0,Number((p=(r=(n=s.value)!=null?n:s.count)!=null?r:s.total)!=null?p:0)||0)}}).filter(s=>s.t)}function Q(e=[]){let t="\u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588";if(!Array.isArray(e)||e.length===0)return"";let o=e.map(s=>Math.max(0,Number(s.value)||0)),l=Math.max(...o,0);return l<=0?"\u2581".repeat(o.length):o.map(s=>{let n=s/l,r=Math.max(0,Math.min(t.length-1,Math.round(n*(t.length-1))));return t[r]}).join("")}function Y(e){if(!e||e.status==="closed"||e.manualClose||e.closed)return!0;let t=T(e.closeAt);return t?t<=Date.now():!1}function be(){return d(window.DEX_API_BASE_URL||window.DEX_API_ORIGIN||"https://dex-api.spring-fog-8edd.workers.dev").replace(/\/$/,"")}async function X(){let e=window.DEX_AUTH||window.dexAuth||null;if(!e)return{auth:null,authenticated:!1,token:null,user:null};try{typeof e.resolve=="function"?await e.resolve(2400):e.ready&&typeof e.ready.then=="function"&&await e.ready}catch{}let t=!1;try{typeof e.isAuthenticated=="function"&&(t=!!await e.isAuthenticated())}catch{}let o=null;if(t&&typeof e.getAccessToken=="function")try{o=await e.getAccessToken()}catch{o=null}let l=null;try{typeof e.getUser=="function"&&(l=await e.getUser())}catch{}return{auth:e,authenticated:t,token:o,user:l}}async function B(){var e;if(!(!((e=a.authSnapshot)!=null&&e.auth)||typeof a.authSnapshot.auth.signIn!="function"))try{await a.authSnapshot.auth.signIn({returnTo:`${window.location.pathname}${window.location.search}${window.location.hash}`})}catch{}}async function c(e,{method:t="GET",body:o=null,authRequired:l=!1}={}){var p;let s={accept:"application/json"};if(o!=null&&(s["content-type"]="application/json"),(p=a.authSnapshot)!=null&&p.token&&(s.authorization=`Bearer ${a.authSnapshot.token}`),l&&!s.authorization)return{ok:!1,status:401,data:{error:"AUTH_REQUIRED"}};let n=await fetch(`${be()}${e}`,{method:t,headers:s,body:o==null?void 0:JSON.stringify(o)}),r=null;try{r=await n.json()}catch{r=null}return{ok:n.ok,status:n.status,data:r}}function q(e,t){e.setAttribute("data-dx-fetch-state",t),t==="loading"?e.setAttribute("aria-busy","true"):e.removeAttribute("aria-busy")}let G=`
      <div class="dx-route-loader" data-dx-route-loader role="status" aria-live="polite">
        <div class="dx-route-loader-inner">
          <div class="dx-route-loader-meta">
            <span class="dx-route-loader-phase">Loading</span>
            <span class="dx-route-loader-detail">Loading polls\u2026</span>
          </div>
          <div class="dx-route-loader-track"><span class="dx-route-loader-fill"></span></div>
        </div>
      </div>`;function he(){if(document.getElementById(j))return;let e=document.createElement("style");e.id=j,e.textContent=`
      .dx-polls-shell{
        --dx-polls-gap: clamp(14px,1.6vw,20px);
        --dx-polls-line: rgba(255,255,255,.14);
        --dx-polls-line-strong: rgba(255,255,255,.26);
        --dx-polls-ink:#f3f3f4;
        --dx-polls-muted:rgba(255,255,255,.66);
        --dx-polls-faint:rgba(255,255,255,.42);
        --dx-polls-accent:var(--dx-accent-solid,#ff5b3a);
        --dx-polls-accent-grad:var(--dx-accent-gradient,linear-gradient(90deg,#ff1910,#ff6a00));
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
      .dx-polls-title{margin:0;font-family:var(--font-heading);text-transform:uppercase;font-size:clamp(1.6rem,4vw,2.5rem);letter-spacing:0;line-height:1;color:var(--dx-polls-ink)!important}
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
        display:block;
        padding-top:var(--dx-polls-gap);
      }
      .dx-polls-body::-webkit-scrollbar{width:9px}
      .dx-polls-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:9px}
      .dx-polls-col{min-height:0}

      .dx-polls-section + .dx-polls-section{margin-top:28px}
      .dx-polls-section--current{display:grid;gap:10px}
      .dx-polls-section--current .dx-polls-list{gap:4px}
      .dx-polls-section--current .dx-poll-card{
        border:1px solid var(--dx-polls-line)!important;border-radius:16px;
        padding:clamp(20px,2.3vw,30px) clamp(20px,2.3vw,28px);
        background:linear-gradient(150deg,rgba(255,255,255,.055),rgba(255,255,255,.018));
        cursor:pointer;
        transition:transform .28s var(--dx-motion-ease-standard,cubic-bezier(.22,.8,.24,1)),border-color .28s ease,box-shadow .28s ease;
      }
      .dx-polls-section--current .dx-poll-card::after{
        content:"";position:absolute;inset:0;border-radius:16px;padding:1px;
        background:var(--dx-polls-accent-grad);
        -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
        -webkit-mask-composite:xor;mask-composite:exclude;
        opacity:0;transition:opacity .28s ease;pointer-events:none;
      }
      .dx-polls-section--current .dx-poll-card:hover{transform:translateY(-3px);box-shadow:0 18px 40px rgba(0,0,0,.32)}
      .dx-polls-section--current .dx-poll-card:hover::after{opacity:.9}
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

      .dx-polls-list{display:grid;gap:0}
      .dx-poll-card{
        position:relative;isolation:auto;background:transparent;
        display:grid;gap:7px;padding:15px 0;
        border-top:1px solid var(--dx-polls-line);
      }
      .dx-poll-card:first-child{border-top:0}
      .dx-poll-card.is-locked{opacity:.72}
      .dx-poll-card:hover .dx-poll-question{color:var(--dx-polls-accent)!important;mix-blend-mode:normal;isolation:auto}
      .dx-poll-card-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
      .dx-poll-chip{font-family:var(--font-body);font-size:.62rem;text-transform:uppercase;letter-spacing:.14em;color:var(--dx-polls-muted)}
      .dx-poll-chip.is-accent{color:var(--dx-polls-accent);display:inline-flex;align-items:center;gap:7px}
      .dx-poll-chip.is-accent::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--dx-polls-accent-grad);box-shadow:0 0 8px 1px rgba(255,90,40,.6);animation:dxPollPulse 2s ease-in-out infinite}
      .dx-poll-chip.is-members{color:var(--dx-polls-ink)}
      .dx-poll-question{position:relative;margin:0;font-family:var(--font-heading);font-size:clamp(1rem,1.3vw,1.18rem);line-height:1.16;letter-spacing:.01em;text-transform:uppercase;color:var(--dx-polls-ink)!important;transition:color .15s ease}
      @keyframes dxPollPulse{0%,100%{opacity:1}50%{opacity:.4}}
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

      .dx-poll-trend{margin:0;font-family:var(--font-body);font-size:.72rem;text-transform:uppercase;letter-spacing:.14em;color:var(--dx-polls-muted)}
      .dx-poll-trend-line{margin:4px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.9rem;letter-spacing:.04em;color:var(--dx-polls-ink)}
      .dx-polls-loading{opacity:.6}
      @media (max-width:980px){
        .dx-polls-shell{height:auto;overflow:visible}
        .dx-polls-body{overflow:visible}
      }
    `,document.head.appendChild(e)}function A(){return document.querySelector("[data-dx-polls-app]")||document.getElementById("dx-polls-app")||document.getElementById("dex-console")}function ge(e,t){e.innerHTML=`
      ${G}
      <section class="dx-polls-shell">
        <header class="dx-polls-head">
          <h1 class="dx-polls-title">Polls</h1>
        </header>
        <div class="dx-polls-body">
          <p class="dx-polls-error">${i(t||"Unable to load polls right now.")}</p>
        </div>
      </section>
    `}function K(e,{includeTrend:t=!1}={}){let o=Y(e),l=e.visibility==="members"&&!a.authSnapshot.authenticated,s=L(a.tab,e.id),n=t&&Array.isArray(e.__trendPoints)&&e.__trendPoints.length?`<p class="dx-poll-trend">90d trend</p><p class="dx-poll-trend-line">${i(Q(e.__trendPoints))}</p>`:"";return`
      <article class="dx-poll-card${l?" is-locked":""}" data-dx-poll-id="${i(e.id)}">
        <div class="dx-poll-card-head">
          <span class="dx-poll-chip ${o?"":"is-accent"}">${o?"Closed":"Open"}</span>
          ${e.visibility==="members"?'<span class="dx-poll-chip is-members">Members only</span>':""}
        </div>
        <h3 class="dx-poll-question">${i(e.question)}</h3>
        <p class="dx-poll-meta">${o?`Closed ${i(f(e.closeAt))}`:`Closes ${i(f(e.closeAt))} (${i(F(e.closeAt))})`}</p>
        ${n}
        <div class="dx-poll-actions">
          <a class="dx-poll-link is-primary" href="${i(s)}" data-dx-poll-open="${i(e.id)}" data-dx-soft-nav-skip="true">View Poll</a>
          ${l?'<button class="dx-poll-action" type="button" data-dx-poll-signin="true">Sign in</button>':""}
        </div>
      </article>
    `}function ye(e){var p;let t=e.poll||y({}),o=e.snapshot&&typeof e.snapshot=="object"?e.snapshot:null,l=Number((o==null?void 0:o.total)||((p=o==null?void 0:o.totals)==null?void 0:p.total)||0)||0,s=d((o==null?void 0:o.headline)||""),n=d((o==null?void 0:o.summaryMarkdown)||(o==null?void 0:o.summary)||""),r=d((o==null?void 0:o.publishedAt)||(o==null?void 0:o.published_at));return`
      <article class="dx-poll-card" data-dx-poll-id="${i(t.id)}">
        <div class="dx-poll-card-head">
          <span class="dx-poll-chip">Published</span>
          ${t.visibility==="members"?'<span class="dx-poll-chip is-members">Members only</span>':""}
        </div>
        <h3 class="dx-poll-question">${i(s||t.question)}</h3>
        <p class="dx-poll-meta">${r?`Published ${i(f(r))}`:"Official snapshot"} \u2022 ${l} votes</p>
        ${n?`<div class="dx-poll-published">${i(n.slice(0,220))}</div>`:""}
        <div class="dx-poll-actions">
          <a class="dx-poll-link is-primary" href="${i(L("results",t.id))}" data-dx-poll-open="${i(t.id)}" data-dx-soft-nav-skip="true">View snapshot</a>
        </div>
      </article>
    `}let Z="dx-polls-modal-style",b=null,S=null,u=0;function ve(){if(document.getElementById(Z))return;let e=document.createElement("style");e.id=Z,e.textContent=`
      #dx-polls-modal{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:clamp(12px,3vw,40px);font-family:var(--font-body);}
      #dx-polls-modal[data-open='true']{display:flex;}
      #dx-polls-modal .dx-pm-backdrop{position:absolute;inset:0;background:rgba(6,7,10,.64);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);opacity:0;transition:opacity .34s ease;}
      #dx-polls-modal[data-anim='in'] .dx-pm-backdrop{opacity:1;}
      #dx-polls-modal .dx-pm-card{position:relative;z-index:1;width:min(620px,100%);max-height:min(88dvh,880px);display:flex;flex-direction:column;
        color:var(--dx-blackglass-ink,#f3f3f4);
        background:var(--dx-blackglass-bg,linear-gradient(145deg,rgba(15,16,21,.92),rgba(9,10,14,.88)));
        border:1px solid var(--dx-blackglass-rim,rgba(255,255,255,.16));border-radius:18px;
        box-shadow:0 40px 100px rgba(0,0,0,.6);
        backdrop-filter:var(--dx-blackglass-backdrop,blur(24px) saturate(170%));-webkit-backdrop-filter:var(--dx-blackglass-backdrop,blur(24px) saturate(170%));
        overflow:hidden;opacity:0;transform:translateY(24px) scale(.96);
        transition:opacity .42s var(--dx-motion-ease-standard,cubic-bezier(.22,.8,.24,1)),transform .44s var(--dx-motion-ease-standard,cubic-bezier(.22,.8,.24,1));}
      #dx-polls-modal[data-anim='in'] .dx-pm-card{opacity:1;transform:none;}
      #dx-polls-modal[data-anim='out'] .dx-pm-card{opacity:0;transform:translateY(12px) scale(.985);transition-duration:.22s;}
      #dx-polls-modal[data-anim='out'] .dx-pm-backdrop{opacity:0;transition-duration:.22s;}
      #dx-polls-modal .dx-pm-card::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:var(--dx-polls-accent-grad,linear-gradient(90deg,#ff1910,#ff6a00));}
      #dx-polls-modal .dx-pm-head{position:relative;flex:0 0 auto;padding:24px 26px 16px;border-bottom:1px solid var(--dx-blackglass-line,rgba(255,255,255,.14));}
      #dx-polls-modal .dx-pm-chips{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding-right:44px;}
      #dx-polls-modal .dx-pm-chip{font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--dx-blackglass-faint,rgba(255,255,255,.4));}
      #dx-polls-modal .dx-pm-chip.is-open{color:#fff;display:inline-flex;align-items:center;gap:7px;}
      #dx-polls-modal .dx-pm-chip.is-open::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--dx-polls-accent-grad,linear-gradient(90deg,#ff1910,#ff6a00));box-shadow:0 0 10px 1px rgba(255,90,40,.7);animation:dxPmPulse 2s ease-in-out infinite;}
      #dx-polls-modal .dx-pm-chip.is-members{color:#fff;}
      #dx-polls-modal .dx-pm-title{margin:14px 0 0;font-family:var(--font-heading);text-transform:uppercase;font-size:clamp(1.25rem,2.6vw,1.75rem);line-height:1.08;letter-spacing:.01em;color:#fff;}
      #dx-polls-modal .dx-pm-meta{margin:9px 0 0;font-size:.78rem;color:var(--dx-blackglass-muted,rgba(255,255,255,.62));}
      #dx-polls-modal .dx-pm-close{position:absolute;top:18px;right:18px;width:36px;height:36px;border-radius:999px;border:1px solid var(--dx-blackglass-line-strong,rgba(255,255,255,.26));background:rgba(255,255,255,.06);color:#fff;font-size:1.15rem;line-height:1;cursor:pointer;transition:background .18s ease,transform .3s var(--dx-motion-ease-standard,cubic-bezier(.22,.8,.24,1));}
      #dx-polls-modal .dx-pm-close:hover{background:rgba(255,255,255,.14);transform:rotate(90deg);}
      #dx-polls-modal .dx-pm-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:18px 26px;display:flex;flex-direction:column;gap:14px;}
      #dx-polls-modal .dx-pm-body::-webkit-scrollbar{width:8px}
      #dx-polls-modal .dx-pm-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:8px}
      #dx-polls-modal .dx-pm-hint{margin:0;font-size:.76rem;color:var(--dx-blackglass-muted,rgba(255,255,255,.62));padding:11px 13px;border:1px dashed var(--dx-blackglass-line-strong,rgba(255,255,255,.26));border-radius:10px;}
      #dx-polls-modal .dx-pm-empty{margin:auto;padding:40px 0;color:var(--dx-blackglass-muted,rgba(255,255,255,.62));font-size:.85rem;text-align:center;}
      #dx-polls-modal .dx-pm-options{display:grid;gap:9px;}
      #dx-polls-modal .dx-poll-option{display:grid;gap:10px;cursor:pointer;text-align:left;width:100%;border:0;
        padding:14px 16px;border:1px solid var(--dx-blackglass-line,rgba(255,255,255,.14));border-radius:13px;background:rgba(255,255,255,.04);
        transition:border-color .2s ease,background .2s ease,transform .2s ease;
        opacity:0;transform:translateY(10px);animation:dxPmOptIn .46s var(--dx-motion-ease-standard,cubic-bezier(.22,.8,.24,1)) forwards;}
      #dx-polls-modal .dx-poll-option:hover:not([disabled]){background:rgba(255,255,255,.08);border-color:var(--dx-blackglass-line-strong,rgba(255,255,255,.26));transform:translateY(-1px);}
      #dx-polls-modal .dx-poll-option.is-selected{border-color:transparent;background:rgba(255,90,40,.13);box-shadow:0 0 0 1px rgba(255,90,40,.45);}
      #dx-polls-modal .dx-poll-option[disabled]{cursor:default;}
      #dx-polls-modal .dx-poll-option-title{display:flex;align-items:center;gap:8px;font-size:.92rem;letter-spacing:.01em;color:var(--dx-blackglass-ink,#f3f3f4);}
      #dx-polls-modal .dx-poll-option.is-selected .dx-poll-option-title::before{content:"\u2713";font-size:.72rem;color:#fff;width:16px;height:16px;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:var(--dx-polls-accent-grad,linear-gradient(90deg,#ff1910,#ff6a00));}
      #dx-polls-modal .dx-poll-bar{position:relative;height:6px;border-radius:6px;background:rgba(255,255,255,.1);overflow:hidden;}
      #dx-polls-modal .dx-poll-bar-fill{height:100%;width:0;border-radius:6px;background:var(--dx-polls-accent-grad,linear-gradient(90deg,#ff1910,#ff6a00));transition:width .62s var(--dx-motion-ease-standard,cubic-bezier(.22,.8,.24,1));}
      #dx-polls-modal .dx-poll-row-foot{display:flex;align-items:center;justify-content:space-between;font-size:.72rem;color:var(--dx-blackglass-muted,rgba(255,255,255,.62));}
      #dx-polls-modal .dx-poll-published{padding:13px 15px;border:1px solid var(--dx-blackglass-line,rgba(255,255,255,.14));border-radius:12px;background:rgba(255,255,255,.03);}
      #dx-polls-modal .dx-poll-published .dx-poll-meta{margin:0;font-size:.76rem;color:var(--dx-blackglass-muted,rgba(255,255,255,.62));}
      #dx-polls-modal .dx-poll-published .dx-poll-meta + .dx-poll-meta{margin-top:5px;}
      #dx-polls-modal .dx-poll-trend-line{margin:6px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:1rem;letter-spacing:.05em;color:#fff;}
      #dx-polls-modal .dx-pm-foot{flex:0 0 auto;border-top:1px solid var(--dx-blackglass-line,rgba(255,255,255,.14));padding:15px 26px;display:flex;align-items:center;justify-content:space-between;gap:10px;}
      #dx-polls-modal .dx-pm-total{font-size:.78rem;color:var(--dx-blackglass-muted,rgba(255,255,255,.62));}
      #dx-polls-modal .dx-pm-total strong{color:#fff;font-weight:600;}
      #dx-polls-modal .dx-pm-signin{appearance:none;border:0;cursor:pointer;font-family:var(--font-body);font-size:.72rem;text-transform:uppercase;letter-spacing:.14em;color:#fff;background:none;padding:0;}
      #dx-polls-modal .dx-pm-signin:hover{color:var(--dx-polls-accent,#ff5b3a);}
      @keyframes dxPmOptIn{to{opacity:1;transform:none;}}
      @keyframes dxPmPulse{0%,100%{opacity:1;}50%{opacity:.4;}}
      @media (max-width:640px){#dx-polls-modal .dx-pm-card{max-height:92dvh;}}
      @media (prefers-reduced-motion:reduce){
        #dx-polls-modal .dx-pm-card,#dx-polls-modal .dx-pm-backdrop{transition-duration:.001ms !important;}
        #dx-polls-modal .dx-poll-option{animation-duration:.001ms !important;opacity:1 !important;transform:none !important;}
        #dx-polls-modal .dx-poll-bar-fill{transition-duration:.001ms !important;}
        #dx-polls-modal .dx-pm-chip.is-open::before{animation:none !important;}
        #dx-polls-modal .dx-pm-close:hover{transform:none !important;}
      }
    `,document.head.appendChild(e)}function we(){let e=document.getElementById("dx-polls-modal");return e||(ve(),e=document.createElement("div"),e.id="dx-polls-modal",e.setAttribute("aria-hidden","true"),e.innerHTML=`
      <div class="dx-pm-backdrop" data-dx-pm-close="1"></div>
      <div class="dx-pm-card" role="dialog" aria-modal="true" aria-label="Poll" tabindex="-1">
        <div class="dx-pm-head">
          <button type="button" class="dx-pm-close" data-dx-pm-close="1" aria-label="Close">\xD7</button>
          <div class="dx-pm-chips" data-dx-pm-chips></div>
          <h2 class="dx-pm-title" data-dx-pm-title></h2>
          <p class="dx-pm-meta" data-dx-pm-meta></p>
        </div>
        <div class="dx-pm-body" data-dx-pm-body></div>
        <div class="dx-pm-foot" data-dx-pm-foot></div>
      </div>`,document.body.appendChild(e),e.addEventListener("click",async t=>{let o=t.target;if(!(o instanceof HTMLElement))return;if(o.closest("[data-dx-pm-close]")){E();return}if(o.closest("[data-dx-poll-signin]")){t.preventDefault(),await B();return}let l=o.closest("[data-dx-poll-vote]");if(l){let s=Number(l.getAttribute("data-dx-poll-vote"));await Pe(s),P({animateBars:!0})}}),e)}function ke(e){if(!e||e.loading)return{chips:'<span class="dx-pm-chip">Loading</span>',title:"Loading poll\u2026",meta:"",body:'<p class="dx-pm-empty">Loading\u2026</p>',foot:""};if(e.error)return{chips:'<span class="dx-pm-chip">Error</span>',title:"Unable to load poll",meta:"",body:`<p class="dx-pm-empty">${i(e.error)}</p>`,foot:""};if(e.locked)return{chips:'<span class="dx-pm-chip is-members">Members only</span>',title:"Sign in required",meta:"This poll is open to members.",body:'<p class="dx-pm-hint">Sign in to view this members-only poll and cast your vote.</p>',foot:'<span class="dx-pm-total"></span><button type="button" class="dx-pm-signin" data-dx-poll-signin="true">Sign in \u2192</button>'};let t=e.poll,o=e.results,l=Y(t)||!!o.closed,s=Array.isArray(o.counts)?o.counts:t.options.map((w,x)=>{var g,k,R,ne;return Number((ne=(R=(g=o.counts)==null?void 0:g[String(x)])!=null?R:(k=o.counts)==null?void 0:k[x])!=null?ne:0)}),n=t.options.map((w,x)=>{let g=Math.max(0,Number(s[x])||0),k=o.total>0?Math.round(g/o.total*100):0;return`
        <button type="button" class="dx-poll-option${o.viewerVote===x?" is-selected":""}" data-dx-poll-vote="${x}" style="animation-delay:${x*55}ms" ${l||a.busyVote?"disabled":""}>
          <span class="dx-poll-option-title">${i(w)}</span>
          <div class="dx-poll-bar"><div class="dx-poll-bar-fill" data-pct="${k}" style="width:0"></div></div>
          <div class="dx-poll-row-foot"><span>${g} ${g===1?"vote":"votes"}</span><span>${k}%</span></div>
        </button>
      `}).join(""),r=o.publishedSnapshot&&typeof o.publishedSnapshot=="object"?o.publishedSnapshot:null,p=r?`<div class="dx-poll-published">
            <p class="dx-poll-meta">Official snapshot v${i(String(r.version||"1"))}${r.publishedAt?` \u2022 ${i(f(r.publishedAt))}`:""}</p>
            ${r.summaryMarkdown?`<p class="dx-poll-meta">${i(String(r.summaryMarkdown).slice(0,280))}</p>`:""}
          </div>`:"",m=Array.isArray(e.trend)&&e.trend.length?`<div class="dx-poll-published">
            <p class="dx-poll-meta">Trend \xB7 90 days</p>
            <p class="dx-poll-trend-line">${i(Q(e.trend))}</p>
          </div>`:"",I=!a.authSnapshot.authenticated&&!l?'<p class="dx-pm-hint">Sign in to cast your vote \u2014 results stay visible either way.</p>':"";return{chips:`
        <span class="dx-pm-chip ${l?"":"is-open"}">${l?"Closed":"Open"}</span>
        <span class="dx-pm-chip">${i(o.mode||"live")}</span>
        ${t.visibility==="members"?'<span class="dx-pm-chip is-members">Members only</span>':""}`,title:t.question,meta:l?`Closed ${f(t.closeAt)}`:`Closes ${f(t.closeAt)} \xB7 ${F(t.closeAt)}`,body:`${I}${p}${m}<div class="dx-pm-options">${n}</div>`,foot:`<span class="dx-pm-total"><strong>${o.total}</strong> total ${o.total===1?"vote":"votes"}</span>
        ${!a.authSnapshot.authenticated&&!l?'<button type="button" class="dx-pm-signin" data-dx-poll-signin="true">Sign in \u2192</button>':""}`}}function $e(e){let t=e.querySelectorAll(".dx-poll-bar-fill[data-pct]");requestAnimationFrame(()=>requestAnimationFrame(()=>{t.forEach(o=>{let l=Math.max(0,Math.min(100,Number(o.getAttribute("data-pct"))||0));o.style.width=`${l}%`})}))}function P({animateBars:e=!0}={}){let t=document.getElementById("dx-polls-modal");if(!t)return;let o=ke(a.detail);t.querySelector("[data-dx-pm-chips]").innerHTML=o.chips,t.querySelector("[data-dx-pm-title]").textContent=o.title;let l=t.querySelector("[data-dx-pm-meta]");l.textContent=o.meta,l.style.display=o.meta?"":"none",t.querySelector("[data-dx-pm-body]").innerHTML=o.body,t.querySelector("[data-dx-pm-foot]").innerHTML=o.foot,e&&$e(t)}function J(){let e=we();if(e.getAttribute("data-open")==="true")return e;u&&(clearTimeout(u),u=0),S=document.activeElement,e.setAttribute("data-open","true"),e.setAttribute("aria-hidden","false");try{e.__dxPrevOverflow=document.body.style.overflow,document.body.style.overflow="hidden"}catch{}requestAnimationFrame(()=>requestAnimationFrame(()=>e.setAttribute("data-anim","in"))),b||(b=o=>{o.key==="Escape"&&E()},document.addEventListener("keydown",b));let t=e.querySelector(".dx-pm-card");if(t)try{t.focus()}catch{}return e}async function W(e,{push:t=!0}={}){var n;let o=d(e);if(!o)return;let l=a.pollId===o&&((n=document.getElementById("dx-polls-modal"))==null?void 0:n.getAttribute("data-open"))==="true";a.pollId=o,t&&$({tab:a.tab,pollId:o},!1),J();let s=a.detailCache.get(o);s&&Date.now()-s.cachedAt<=U?a.detail=s.value:l||(a.detail={loading:!0}),P({animateBars:!0});try{await D(o)}catch(r){a.detail={error:r instanceof Error?r.message:String(r)}}a.pollId===o&&P({animateBars:!0})}function E({push:e=!0}={}){a.pollId="";let t=document.getElementById("dx-polls-modal");if(e&&$({tab:a.tab,pollId:""},!1),!t||t.getAttribute("data-open")!=="true"){t&&(t.removeAttribute("data-open"),t.removeAttribute("data-anim"));return}t.setAttribute("data-anim","out"),b&&(document.removeEventListener("keydown",b),b=null);try{document.body.style.overflow=t.__dxPrevOverflow||""}catch{}if(u&&clearTimeout(u),u=window.setTimeout(()=>{t.removeAttribute("data-open"),t.removeAttribute("data-anim"),t.setAttribute("aria-hidden","true"),u=0},240),S&&typeof S.focus=="function")try{S.focus()}catch{}}function Ae(){a.pollId?(J(),P({animateBars:!0})):E({push:!1})}function ee(e){let t=a.collections.open.polls.length?a.collections.open.polls.map(n=>K(n)).join(""):'<p class="dx-polls-empty">No open polls right now.</p>',o=a.collections.closed.polls.length?a.collections.closed.polls.map(n=>K(n,{includeTrend:!0})).join(""):'<p class="dx-polls-empty">No closed polls in this window.</p>',l=a.collections.published.rows.length?a.collections.published.rows.map(n=>ye(n)).join(""):'<p class="dx-polls-empty">No published snapshots yet.</p>',s=a.tab==="open"?`
          <div class="dx-polls-section dx-polls-section--current">
            <p class="dx-polls-section-label">Current polls</p>
            <div class="dx-polls-list">${t}</div>
          </div>
          <details class="dx-polls-archive-drawer" data-dx-polls-archive-drawer="true" ${a.archiveDrawerOpen?"open":""}>
            <summary>
              <span>Past polls</span>
              <span class="dx-polls-archive-count">${a.collections.closed.total} archived</span>
            </summary>
            <div class="dx-polls-archive-panel">
              <div class="dx-polls-list">${o}</div>
              <div class="dx-polls-pager">
                <button type="button" class="dx-poll-action" data-dx-poll-closed-prev="true" ${a.collections.closed.page<=1?"disabled":""}>Previous</button>
                <span class="dx-poll-meta">Page ${a.collections.closed.page} of ${a.collections.closed.pages}</span>
                <button type="button" class="dx-poll-action" data-dx-poll-closed-next="true" ${a.collections.closed.page>=a.collections.closed.pages?"disabled":""}>Next</button>
              </div>
            </div>
          </details>
        `:a.tab==="results"?`
          <div class="dx-polls-section">
            <p class="dx-polls-section-label">Published results</p>
            <div class="dx-polls-list">${l}</div>
          </div>
        `:`
          <div class="dx-polls-section">
            <p class="dx-polls-section-label">Archive &amp; trends</p>
            <div class="dx-polls-list">${o}</div>
            <div class="dx-polls-pager">
              <button type="button" class="dx-poll-action" data-dx-poll-closed-prev="true" ${a.collections.closed.page<=1?"disabled":""}>Previous</button>
              <span class="dx-poll-meta">Page ${a.collections.closed.page} of ${a.collections.closed.pages}</span>
              <button type="button" class="dx-poll-action" data-dx-poll-closed-next="true" ${a.collections.closed.page>=a.collections.closed.pages?"disabled":""}>Next</button>
            </div>
          </div>
        `;e.innerHTML=`
      ${G}
      <section class="dx-polls-shell${a.loading?" dx-polls-loading":""}">
        <header class="dx-polls-head">
          <div>
            <h1 class="dx-polls-title">Polls</h1>
            <p class="dx-polls-subtitle">Open voting, official snapshots, and archive trends.</p>
          </div>
          <nav class="dx-polls-tabs" role="tablist" aria-label="Poll views">
            <button type="button" role="tab" class="dx-polls-tab${a.tab==="open"?" is-active":""}" data-dx-polls-tab="open">Open</button>
            <button type="button" role="tab" class="dx-polls-tab${a.tab==="results"?" is-active":""}" data-dx-polls-tab="results">Results</button>
            <button type="button" role="tab" class="dx-polls-tab${a.tab==="archive"?" is-active":""}" data-dx-polls-tab="archive">Archive</button>
          </nav>
        </header>
        ${a.error?`<p class="dx-polls-error">${i(a.error)}</p>`:""}
        <div class="dx-polls-body">
          <div class="dx-polls-col dx-polls-col--list">${s}</div>
        </div>
      </section>
    `}async function Se(){let[e,t,o]=await Promise.all([c(`/polls?state=open&page=1&pageSize=${re}`),c(`/polls?state=closed&page=${a.closedPage}&pageSize=${ie}`),c(`/polls/published?page=1&pageSize=${de}`)]);if(!e.ok)throw new Error("Unable to load open polls");if(!t.ok)throw new Error("Unable to load closed polls");a.collections.open=V(e.data,1),a.collections.closed=V(t.data,a.closedPage),a.collections.published=o.ok?xe(o.data):{rows:[],page:1,pages:1,total:0},a.closedPage=a.collections.closed.page}async function te(e){try{let t=await c(`/polls/${encodeURIComponent(e)}/trend?bucket=day&window=90d`);return t.ok?fe(t.data):[]}catch{return[]}}async function D(e){var I,w;let t=d(e);if(!t){a.detail=null;return}let o=a.detailCache.get(t);if(o&&Date.now()-o.cachedAt<=U&&!a.busyVote){a.detail=o.value;return}let l=await c(`/polls/${encodeURIComponent(t)}`);if(l.status===401||l.status===403){a.detail={locked:!0,pollId:t};return}if(!l.ok)throw new Error(`Unable to load poll ${t}`);let s=y(((I=l.data)==null?void 0:I.poll)||l.data),n=await c(`/polls/${encodeURIComponent(t)}/results`);if(!n.ok)throw new Error(`Unable to load poll results (${t})`);let r=me(((w=n.data)==null?void 0:w.results)||n.data),p=await te(t),m={locked:!1,poll:s,results:r,trend:p};a.detail=m,a.detailCache.set(t,{cachedAt:Date.now(),value:m})}async function Pe(e){if(!(!a.detail||a.detail.locked||a.busyVote)&&!(!Number.isInteger(e)||e<0)){if(a.authSnapshot=await X(),!a.authSnapshot.authenticated){await B();return}a.busyVote=!0;try{let t=a.detail.poll.id;if(!(await c(`/polls/${encodeURIComponent(t)}/vote`,{method:"POST",authRequired:!0,body:{optionIndex:e}})).ok)throw new Error("Vote failed");a.detailCache.delete(t),await D(t)}finally{a.busyVote=!1}}}function oe(e){e.querySelectorAll("[data-dx-polls-tab]").forEach(n=>{n.addEventListener("click",async()=>{let r=z(n.getAttribute("data-dx-polls-tab"));r!==a.tab&&(a.tab=r,a.error="",$({tab:a.tab,pollId:a.pollId},!1),await M(e))})}),e.querySelectorAll("[data-dx-poll-signin]").forEach(n=>{n.addEventListener("click",async r=>{r.preventDefault(),await B()})});let t=e.querySelector(".dx-polls-col--list");t&&t.addEventListener("click",n=>{let r=n.target;if(!(r instanceof HTMLElement)||r.closest("[data-dx-poll-signin]"))return;let p=r.closest("[data-dx-poll-open]")||r.closest(".dx-poll-card[data-dx-poll-id]");if(!p)return;let m=p.getAttribute("data-dx-poll-open")||p.getAttribute("data-dx-poll-id");m&&(n.preventDefault(),W(m).catch(()=>{}))});let o=e.querySelector("[data-dx-polls-archive-drawer]");o&&o.addEventListener("toggle",()=>{a.archiveDrawerOpen=!!o.open});let l=e.querySelector("[data-dx-poll-closed-prev]");l&&l.addEventListener("click",async()=>{a.closedPage<=1||(a.closedPage-=1,await M(e))});let s=e.querySelector("[data-dx-poll-closed-next]");s&&s.addEventListener("click",async()=>{a.closedPage+=1,await M(e)})}async function Ee(){if(a.tab!=="archive")return;let e=a.collections.closed.polls.slice(0,3);e.length&&await Promise.all(e.map(async t=>{if(!t.id)return;let o=await te(t.id);t.__trendPoints=o}))}async function M(e){a.loading=!0,ee(e),oe(e);try{await Se(),await Ee(),await D(a.pollId),a.error=""}catch(t){a.error=t instanceof Error?t.message:String(t)}finally{a.loading=!1,ee(e),oe(e),Ae()}}async function ae(e){let t=performance.now()-e;t>=O||await new Promise(o=>window.setTimeout(o,O-t))}async function Me(){let e=A();if(!e)return;he();let t=performance.now();q(e,"loading");let o=C(e);a.tab=o.tab,a.pollId=o.pollId,$({tab:a.tab,pollId:a.pollId},!0);try{a.authSnapshot=await X(),await M(e),await ae(t),q(e,"ready")}catch(l){console.error("[dx-polls] boot error",l),ge(e,"Unable to load polls right now. Please try again."),await ae(t),q(e,"error")}}let h=null,N=!1,le="";function se(){let e=C(A()),t=H(window.location.pathname||"/"),o=d(window.location.search||"");return`${t}?${o}|${e.tab}|${e.pollId}`}async function Ie(){do N=!1,await Me(),le=se();while(N)}function v(){if(!h){let e=A();if(e&&e.getAttribute("data-dx-fetch-state")==="ready"&&se()===le)return Promise.resolve()}return h?(N=!0,h):(h=Ie().catch(e=>{console.error("[dx-polls] queue boot error",e)}).finally(()=>{h=null}),h)}window.__dxPollsQueueBoot=v,window.addEventListener("dx:slotready",()=>{v().catch(()=>{})},{once:!0}),window.addEventListener("popstate",()=>{let e=A();if(!e)return;let t=C(e);if(t.tab!==a.tab){v().catch(()=>{});return}t.pollId!==a.pollId&&(t.pollId?W(t.pollId,{push:!1}).catch(()=>{}):E({push:!1}))}),document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{v().catch(()=>{})},{once:!0}):v().catch(()=>{})})();})();
