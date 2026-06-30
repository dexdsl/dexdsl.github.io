(()=>{(()=>{if(typeof window=="undefined"||typeof document=="undefined")return;if(window.__dxAchievementsRuntimeLoaded&&typeof window.__dxAchievementsMount=="function"){try{window.__dxAchievementsMount()}catch{}return}window.__dxAchievementsRuntimeLoaded=!0;let Q="loading",O="ready",Ee="error",J="loading",Se="ready",Z="error",Ae="empty",ee="signed-out",f="overview",b="secret-vault",te="history",z=120,L=2600,ke=2600,Te=9e3,Le=40,ne=8,Me="badge",ae="https://dex-api.spring-fog-8edd.workers.dev",_e="/assets/vendor/heroicons/24/outline/",ie={submission:"document-arrow-up.svg","submission-stack":"rectangle-stack.svg",release:"arrow-down-tray.svg",license:"check-circle.svg",joint:"share.svg",poll:"list-bullet.svg",streak:"star.svg",call:"eye.svg",lane:"bars-3.svg",favorite:"heart.svg",profile:"user-circle.svg",explorer:"eye.svg",rhythm:"list-bullet.svg",secret:"lock-closed.svg","secret-license":"shield-check.svg","secret-release":"archive-box-arrow-down.svg",vault:"key.svg"},oe={submissions:[1,.25,.08],releases:[.12,.68,1],license:[.28,.96,.68],polls:[.67,.33,1],calls:[1,.28,.58],favorites:[1,.16,.28],profile:[.2,.72,1],secret:[.64,.7,.94],general:[1,.35,.12]},re={bronze:[.78,.36,.15],silver:[.72,.8,.92],gold:[1,.66,.1],legend:[.68,.36,1]},E=Object.freeze({x:-5,y:-8});function u(e,n=""){return String(e!=null?e:"").trim()||n}function x(e,n,i){return Math.min(n,Math.max(e,i))}function I(){return Date.now()}function F(e){return new Promise(n=>setTimeout(n,Math.max(0,e)))}function M(e,n,i=null){let t=null,a=new Promise(o=>{t=setTimeout(()=>o(i),Math.max(1,n))});return Promise.race([Promise.resolve(typeof e=="function"?e():e).catch(()=>i),a]).finally(()=>{t!==null&&clearTimeout(t)})}function _(){return window.crypto&&typeof window.crypto.randomUUID=="function"?window.crypto.randomUUID():`dx-achv-${Math.floor(Math.random()*1e9).toString(16)}-${Date.now()}`}function $e(){return u(window.DEX_API_BASE_URL||window.DEX_API_ORIGIN||ae,ae).replace(/\/+$/,"")}function $(e,n){e instanceof HTMLElement&&(e.setAttribute("data-dx-fetch-state",n),n===Q?e.setAttribute("aria-busy","true"):e.setAttribute("aria-busy","false"))}function R(e,n,i,t){e instanceof HTMLElement&&(e.setAttribute("data-dx-achievements-state",i),e.setAttribute("data-dx-achievements-page",t)),n instanceof HTMLElement&&(n.setAttribute("data-dx-achievements-state",i),n.setAttribute("data-dx-achievements-page",t))}function Re(){return window.DEX_AUTH||window.dexAuth||null}async function Ie(){let e=Re();if(!e)return{auth:null,authenticated:!1,token:"",user:null};try{typeof e.resolve=="function"?await M(()=>e.resolve(L),L,null):e.ready&&typeof e.ready.then=="function"&&await M(e.ready,L,null)}catch{}let n=!1;try{typeof e.isAuthenticated=="function"&&(n=!!await M(()=>e.isAuthenticated(),L,!1))}catch{n=!1}let i="";n&&typeof e.getAccessToken=="function"&&(i=u(await M(()=>e.getAccessToken(),ke,""),""));let t=null;try{typeof e.getUser=="function"&&(t=await M(()=>e.getUser(),L,null))}catch{t=null}return{auth:e,authenticated:n,token:i,user:t}}async function P(e,{method:n="GET",token:i="",body:t=null,timeoutMs:a=Te,headers:o={}}={}){let r=`${$e()}${e}`,c=typeof AbortController=="function"?new AbortController:null,s=setTimeout(()=>{c&&c.abort()},Math.max(1e3,a));try{let d=await fetch(r,{method:n,credentials:"same-origin",cache:"no-store",headers:{...i?{authorization:`Bearer ${i}`}:{},...t?{"content-type":"application/json"}:{},...o},body:t?JSON.stringify(t):void 0,signal:c?c.signal:void 0}),m=await d.json().catch(()=>null);return{ok:d.ok,status:d.status,payload:m}}catch(d){return{ok:!1,status:0,payload:{ok:!1,code:"NETWORK_ERROR",detail:d instanceof Error?d.message:String(d)}}}finally{clearTimeout(s)}}function l(e){return String(e!=null?e:"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function se(e,{silhouette:n=!1}={}){let i=u(e,"secret").toLowerCase(),t=ie[i]||ie.secret,a=`${_e}${t}`,o=n?"dx-achievement-glyph-svg is-silhouette":"dx-achievement-glyph-svg";return`<img src="${l(a)}" class="${o}" alt="" loading="lazy" decoding="async" aria-hidden="true">`}function ce(e,n){let i=n>0?x(0,100,Math.round(e/n*100)):0,a=2*Math.PI*18,o=Math.round(i/100*a*1e3)/1e3;return{pct:i,c:a,dash:o}}function j(e){return e.secret&&!e.unlocked?"CLASSIFIED":e.title}function de(e){return e.secret&&!e.unlocked?`Clue: ${e.clueGrowlix||"???"}`:e.description}function Y(e){return e.secret&&!e.unlocked?"Signal encrypted":e.unlocked?e.newly?"Newly unlocked":"Unlocked":`Progress ${Math.min(e.progress,e.threshold)} / ${e.threshold}`}function le(e){return e.secret&&!e.unlocked?"Points hidden":`${e.points} pts`}function X(e){return e.secret&&!e.unlocked?"Secret vault":e.category}function Pe(e){if(!e.unlockedAt)return e.unlocked?"Recorded in the Dex archive":"Not yet unlocked";let n=new Date(e.unlockedAt);return Number.isNaN(n.getTime())?"Recorded in the Dex archive":`Unlocked ${n.toLocaleDateString(void 0,{year:"numeric",month:"short",day:"numeric"})}`}function Ce(e,n){var h,v;let i=e&&typeof e=="object"?e:{},t=u(i.id).toLowerCase(),a=!!i.secret,o=Math.max(1,Number(i.threshold)||1),r=Math.max(0,Number((v=(h=i.progress)!=null?h:i.metricValue)!=null?v:0)||0),c=!!i.unlocked||r>=o,s=n.newlyUnlockedSet.has(t)||!!i.newlyUnlocked,d=u(i.visibility,"default").toLowerCase(),m="locked";return c&&s?m="new":c?m="unlocked":r>0&&(m="progress"),{id:t,title:u(i.title,"Untitled Achievement"),description:u(i.description,""),category:u(i.category,"general"),tier:u(i.tier,"bronze"),glyph:u(i.glyph,"secret"),points:Math.max(0,Number(i.points)||0),threshold:o,progress:r,unlocked:c,newly:s,cardState:m,secret:a,visibility:d,unlockedAt:u(i.unlockedAt||i.unlocked_at||i.earnedAt||i.earned_at,""),clueGrowlix:u(i.clueGrowlix,"???"),claimable:d==="hidden-until-unlocked"?!1:!!i.claimable}}function He(e){let n=ce(e.progress,e.threshold),i=j(e),t=de(e),a=e.secret&&!e.unlocked&&e.claimable?`<button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm dx-achievement-claim" data-dx-achievement-claim="${l(e.id)}" data-dx-motion-include="true">Claim</button>`:"";return`
      <article
        class="badge-card dx-achievement-card dx-achievement-card--${l(e.cardState)}"
        data-dx-achievement-id="${l(e.id)}"
        data-dx-achievement-state="${l(e.cardState)}"
        data-dx-achievement-secret="${e.secret?"true":"false"}"
        data-dx-achievement-category="${l(e.category)}"
        data-dx-achievement-tier="${l(e.tier)}"
        data-dx-achievement-open="${l(e.id)}"
        style="--dx-achievement-progress: ${n.pct}%;"
        data-dx-motion-include="true"
      >
        <button
          type="button"
          class="dx-achievement-open-target"
          data-dx-achievement-open="${l(e.id)}"
          aria-haspopup="dialog"
          aria-label="Inspect achievement: ${l(i)}"
        ></button>
        <span class="dx-achievement-material" aria-hidden="true"></span>
        <div class="dx-achievement-card-top">
          <span class="dx-achievement-category">${l(X(e))}</span>
          <span class="dx-achievement-tier">${l(e.tier.toUpperCase())}</span>
          ${e.newly?'<span class="dx-achievement-new">NEW</span>':""}
        </div>
        <div class="dx-achievement-crest" aria-hidden="true">
          <span class="dx-achievement-crest-rim"></span>
          <div class="dx-achievement-glyph-wrap">
            ${se(e.glyph,{silhouette:e.secret&&!e.unlocked})}
          </div>
        </div>
        <div class="dx-achievement-copy">
          <h3 class="dx-achievement-title">${l(i)}</h3>
          <p class="dx-achievement-desc">${l(t)}</p>
        </div>
        <div class="dx-achievement-progress" aria-hidden="true">
          <span></span>
        </div>
        <div class="dx-achievement-meta">
          <span>${l(Y(e))}</span>
          <span>${l(le(e))}</span>
        </div>
        ${a}
      </article>
    `}function Ne(e){let n=ce(e.progress,e.threshold),i=j(e),t=de(e),a=e.secret&&!e.unlocked,o=a?"Unlock criteria remain classified.":e.unlocked?"Achievement complete.":`${Math.min(e.progress,e.threshold)} of ${e.threshold} recorded.`,r=Array.from({length:13},(c,s)=>`<i style="--dx-achievement-depth-z:${-9+s*1.5}px"></i>`).join("");return`
      <div
        class="dx-achievement-inspect-object${e.newly?" is-cinematic":""}"
        data-dx-achievement-inspect-object
        data-dx-achievement-state="${l(e.cardState)}"
        data-dx-achievement-category="${l(e.category)}"
        data-dx-achievement-tier="${l(e.tier)}"
        style="--dx-achievement-progress: ${n.pct}%;"
        role="group"
        aria-label="3D achievement object: ${l(i)}"
        tabindex="0"
      >
        <div class="dx-achievement-inspect-plate" data-dx-achievement-inspect-plate>
          <span class="dx-achievement-inspect-depth" aria-hidden="true">
            ${r}
            <b class="dx-achievement-inspect-edge dx-achievement-inspect-edge--top"></b>
            <b class="dx-achievement-inspect-edge dx-achievement-inspect-edge--right"></b>
            <b class="dx-achievement-inspect-edge dx-achievement-inspect-edge--bottom"></b>
            <b class="dx-achievement-inspect-edge dx-achievement-inspect-edge--left"></b>
          </span>
          <section class="dx-achievement-inspect-face dx-achievement-inspect-front">
            <canvas class="dx-achievement-inspect-shader" data-dx-achievement-inspect-shader aria-hidden="true"></canvas>
            <span class="dx-achievement-inspect-foil" aria-hidden="true"></span>
            <header class="dx-achievement-inspect-head">
              <span>${l(X(e))}</span>
              <span>${l(e.tier.toUpperCase())}</span>
            </header>
            <div class="dx-achievement-inspect-crest" aria-hidden="true">
              <span class="dx-achievement-inspect-crest-rim"></span>
              <span class="dx-achievement-inspect-glyph">
                ${se(e.glyph,{silhouette:a})}
              </span>
            </div>
            <div class="dx-achievement-inspect-copy">
              <p class="dx-achievement-inspect-kicker">${l(Y(e))}</p>
              <h2 id="dx-achievement-inspect-title">${l(i)}</h2>
              <p>${l(t)}</p>
            </div>
            <div class="dx-achievement-inspect-meter" aria-hidden="true"><span></span></div>
            <footer class="dx-achievement-inspect-foot">
              <span>${l(le(e))}</span>
              <span>${l(Pe(e))}</span>
            </footer>
          </section>
          <section class="dx-achievement-inspect-face dx-achievement-inspect-back" aria-label="Achievement record">
            <div class="dx-achievement-inspect-back-seal" aria-hidden="true">DX</div>
            <p class="dx-achievement-inspect-kicker">Archive record</p>
            <h3>${l(i)}</h3>
            <dl>
              <div><dt>Category</dt><dd>${l(X(e))}</dd></div>
              <div><dt>Tier</dt><dd>${l(e.tier)}</dd></div>
              <div><dt>Status</dt><dd>${l(Y(e))}</dd></div>
              <div><dt>Record</dt><dd>${l(o)}</dd></div>
            </dl>
            <p class="dx-achievement-inspect-back-id">${a?"DEX-ACHV-CLASSIFIED":l(e.id)}</p>
          </section>
        </div>
      </div>
    `}function Be(e,n){if(!(e instanceof HTMLCanvasElement))return null;let i=()=>(e.setAttribute("data-dx-shader-state","fallback"),null),t=null;try{t=e.getContext("webgl",{alpha:!0,antialias:!1,depth:!1,premultipliedAlpha:!0,powerPreference:"low-power"})}catch{return i()}if(!t)return i();let a=`
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `,o=`
      precision highp float;
      varying vec2 v_uv;
      uniform float u_time;
      uniform vec2 u_pointer;
      uniform vec3 u_category;
      uniform vec3 u_tier;
      uniform float u_unlocked;
      uniform float u_secret;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      void main() {
        vec2 uv = v_uv;
        vec2 pointer = clamp(u_pointer, 0.0, 1.0);
        float time = u_time * 0.12;
        float grain = noise(uv * vec2(22.0, 15.0) + time);
        float micro = noise(uv * vec2(96.0, 64.0));
        float diagonal = uv.x * 0.92 + uv.y * 0.42;
        float travel = fract(diagonal + time * 0.11 + pointer.x * 0.24);
        float foil = pow(max(0.0, 1.0 - abs(travel - 0.5) * 2.0), 5.0);
        float bands = 0.5 + 0.5 * sin((diagonal * 12.0 + grain * 1.8 + time) * 6.28318);
        float spot = exp(-10.0 * distance(uv, pointer));
        float edge = smoothstep(0.64, 0.98, distance(uv, vec2(0.5)) * 1.42);

        vec3 rainbow = vec3(
          0.5 + 0.5 * sin(6.28318 * (bands + 0.00)),
          0.5 + 0.5 * sin(6.28318 * (bands + 0.33)),
          0.5 + 0.5 * sin(6.28318 * (bands + 0.67))
        );
        vec3 metal = mix(u_tier, u_category, 0.28 + grain * 0.3);
        vec3 color = mix(metal, rainbow, foil * (0.42 + u_unlocked * 0.42));
        color += u_category * spot * 0.56;
        color += vec3(0.7, 0.78, 0.92) * edge * 0.2;
        color += (micro - 0.5) * 0.065;

        float alpha = 0.035 + foil * 0.2 + spot * 0.18 + edge * 0.08;
        alpha *= mix(0.72, 1.0, u_unlocked);
        alpha *= mix(1.0, 0.72, u_secret);
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.5));
      }
    `;function r(w,T){let g=t.createShader(w);return g?(t.shaderSource(g,T),t.compileShader(g),t.getShaderParameter(g,t.COMPILE_STATUS)?g:(t.deleteShader(g),null)):null}let c=r(t.VERTEX_SHADER,a),s=r(t.FRAGMENT_SHADER,o);if(!c||!s)return i();let d=t.createProgram();if(!d)return i();if(t.attachShader(d,c),t.attachShader(d,s),t.linkProgram(d),t.deleteShader(c),t.deleteShader(s),!t.getProgramParameter(d,t.LINK_STATUS))return t.deleteProgram(d),i();let m=t.createBuffer();if(!m)return t.deleteProgram(d),i();t.bindBuffer(t.ARRAY_BUFFER,m),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),t.STATIC_DRAW),t.useProgram(d);let h=t.getAttribLocation(d,"a_position");t.enableVertexAttribArray(h),t.vertexAttribPointer(h,2,t.FLOAT,!1,0,0);let v={time:t.getUniformLocation(d,"u_time"),pointer:t.getUniformLocation(d,"u_pointer"),category:t.getUniformLocation(d,"u_category"),tier:t.getUniformLocation(d,"u_tier"),unlocked:t.getUniformLocation(d,"u_unlocked"),secret:t.getUniformLocation(d,"u_secret")},p=oe[n.category]||oe.general,k=re[n.tier]||re.silver;t.uniform3fv(v.category,p),t.uniform3fv(v.tier,k),t.uniform1f(v.unlocked,n.unlocked?1:0),t.uniform1f(v.secret,n.secret&&!n.unlocked?1:0);let ge=[.5,.42],D=0,ye=!0,q=null,be=!!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);function we(){let w=e.getBoundingClientRect(),T=Math.min(2,Math.max(1,window.devicePixelRatio||1)),g=Math.max(1,Math.round(w.width*T)),W=Math.max(1,Math.round(w.height*T));(e.width!==g||e.height!==W)&&(e.width=g,e.height=W),t.viewport(0,0,g,W)}function K(w){ye&&(we(),t.useProgram(d),t.uniform1f(v.time,Math.max(0,Number(w)||0)/1e3),t.uniform2fv(v.pointer,ge),t.drawArrays(t.TRIANGLE_STRIP,0,4),!be&&!document.hidden&&(D=window.requestAnimationFrame(K)))}return typeof ResizeObserver=="function"&&(q=new ResizeObserver(we),q.observe(e)),e.setAttribute("data-dx-shader-state","ready"),D=window.requestAnimationFrame(K),{setPointer(w,T){ge=[x(0,1,Number(w)||0),x(0,1,Number(T)||0)],be&&K(0)},dispose(){ye=!1,D&&window.cancelAnimationFrame(D),q&&q.disconnect(),t.deleteBuffer(m),t.deleteProgram(d)}}}function G(e){let n=e.root.querySelector("[data-dx-achievement-inspect-object]");n instanceof HTMLElement&&(n.style.setProperty("--dx-inspect-rotate-x",`${e.inspector.rotationX}deg`),n.style.setProperty("--dx-inspect-rotate-y",`${e.inspector.rotationY}deg`))}function V(e){e.inspector.rotationX=E.x,e.inspector.rotationY=E.y,G(e)}function ue(e){let n=e.root.querySelector("[data-dx-achievement-inspector]");n instanceof HTMLDialogElement&&n.open&&n.close()}function me(e,n,i=null){let t=e.badges.find(r=>r.id===n),a=e.root.querySelector("[data-dx-achievement-inspector]"),o=e.root.querySelector("[data-dx-achievement-inspect-viewport]");if(!(!t||!(a instanceof HTMLDialogElement)||!(o instanceof HTMLElement))){e.inspector.shader&&(e.inspector.shader.dispose(),e.inspector.shader=null),e.inspector.badgeId=t.id,e.inspector.opener=i instanceof HTMLElement?i:null,o.innerHTML=Ne(t),a.setAttribute("aria-label",`Inspect achievement: ${j(t)}`),a.setAttribute("data-dx-achievement-state",t.cardState),a.setAttribute("data-dx-achievement-category",t.category),a.setAttribute("data-dx-achievement-tier",t.tier),V(e);try{a.open||a.showModal()}catch{a.setAttribute("open","")}window.requestAnimationFrame(()=>{a.classList.add("is-visible");let r=o.querySelector("[data-dx-achievement-inspect-object]"),c=o.querySelector("[data-dx-achievement-inspect-shader]");c instanceof HTMLCanvasElement&&(e.inspector.shader=Be(c,t)),r instanceof HTMLElement&&r.focus({preventScroll:!0})})}}function C(e){let n=e.root.getBoundingClientRect(),i=Math.max(0,n.width||window.innerWidth||0),t=Math.max(0,n.height||window.innerHeight||0);return i<=640?3:i<=900?6:t>0&&t<520?4:ne}function Ue(e,n,i){let t=C(e);e.badgePageSize=t;let a=Math.max(1,Math.ceil(i.length/t)),o=x(0,a-1,Number(e.badgePages[n])||0);e.badgePages[n]=o;let r=o*t;return{pageSize:t,totalPages:a,current:o,visible:i.slice(r,r+t)}}function De(e,n,i){if(n<=1)return"";let t=i<=0?' disabled aria-disabled="true"':"",a=i>=n-1?' disabled aria-disabled="true"':"";return`
      <span class="dx-achievements-carousel-edge dx-achievements-carousel-edge--left">
        <button type="button" class="carousel-nav prev dx-pagenav-arrow dx-pagenav-arrow--prev dx-pagenav-arrow--on-dark" data-dx-achievements-badge-page-prev="${l(e)}" aria-label="Previous achievements page"${t}></button>
      </span>
      <span class="dx-achievements-carousel-edge dx-achievements-carousel-edge--right">
        <button type="button" class="carousel-nav next dx-pagenav-arrow dx-pagenav-arrow--next dx-pagenav-arrow--on-dark" data-dx-achievements-badge-page-next="${l(e)}" aria-label="Next achievements page"${a}></button>
      </span>
    `}function he(e,n,i){let t=Ue(e,n,i);return`
      <div class="dx-achievements-carousel-frame" data-dx-achievements-pager="${l(n)}" data-dx-achievements-pager-index="${t.current}" data-dx-achievements-pager-total="${t.totalPages}" data-dx-achievements-page-size="${t.pageSize}">
        ${De(n,t.totalPages,t.current)}
        <div class="dx-achievements-grid" data-dx-achievements-grid-page="${l(n)}">${t.visible.map(He).join("")}</div>
      </div>
    `}function qe(e){let n=e&&typeof e=="object"?e:{},i=u(n.title||n.badgeTitle||n.badgeId||"Achievement event"),t=u(n.createdAt||n.eventAt||""),a=t?new Date(t).toLocaleString():"Unknown time",o=u(n.detail||n.body||n.eventType||"");return`
      <article class="dx-achievement-history-item" data-dx-motion-include="true">
        <div class="dx-achievement-history-head">
          <h4>${l(i)}</h4>
          <span>${l(a)}</span>
        </div>
        <p>${l(o)}</p>
      </article>
    `}function y(e,n,{error:i=!1}={}){let t=e.root.querySelector("[data-dx-achievements-toasts]");if(!(t instanceof HTMLElement))return;let a=document.createElement("p");a.className=`dx-achievements-toast${i?" dx-achievements-toast--error":""}`,a.textContent=n,t.appendChild(a),setTimeout(()=>{a.remove()},3400)}function pe(e,n){try{window.dispatchEvent(new CustomEvent(e,{detail:n}))}catch{}}function ve(){try{let e=new URL(window.location.href);return u(e.searchParams.get(Me),"").toLowerCase()}catch{return""}}function Oe(e,n){if(!n)return;let i=`[data-dx-achievement-id="${CSS.escape(n)}"]`,t=e.root.querySelector(i);if(t instanceof HTMLElement){try{t.scrollIntoView({block:"center",behavior:"smooth"})}catch{t.scrollIntoView()}t.classList.add("dx-achievement-card--focus"),setTimeout(()=>t.classList.remove("dx-achievement-card--focus"),1800)}}function ze(e){let n=e.root.querySelector("[data-dx-achievements-body]");if(!(n instanceof HTMLElement))return;n.innerHTML=`
      <article class="dx-achievements-empty" data-dx-motion-include="true">
        <h3>SIGN IN REQUIRED</h3>
        <p>Please sign in to view achievements and unlock history.</p>
        <button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm" data-dx-achievements-signin="true" data-dx-motion-include="true">Sign in</button>
      </article>
    `;let i=n.querySelector('[data-dx-achievements-signin="true"]');i instanceof HTMLButtonElement&&i.addEventListener("click",async()=>{let t=e.authSnapshot.auth;if(t&&typeof t.signIn=="function")try{await t.signIn({returnTo:`${window.location.pathname}${window.location.search}${window.location.hash}`});return}catch{}window.location.assign("/")})}function Fe(e){let n=e.root.querySelector("[data-dx-achievements-totals]"),i=e.root.querySelector("[data-dx-achievements-metrics]"),t=e.root.querySelector("[data-dx-achievements-warning]"),a=e.summary;if(!(n instanceof HTMLElement)||!(i instanceof HTMLElement)||!(t instanceof HTMLElement))return;if(!a){n.textContent="No summary available.",i.textContent="",t.hidden=!0,t.textContent="";return}let o=a.totals&&typeof a.totals=="object"?a.totals:{},r=Math.max(0,Number(o.unlocked)||0),c=Math.max(0,Number(o.total||a.badges.length)||a.badges.length),s=Math.max(0,Number(o.points)||0);n.textContent=`${r} / ${c} unlocked \xB7 ${s} points`;let d=a.metrics&&typeof a.metrics=="object"?a.metrics:{},m=Math.max(0,Number(d.submissionsTotal)||0),h=Math.max(0,Number(d.releasesTotal)||0),v=Math.max(0,Number(d.pollVotes)||0),p=Math.max(0,Number(d.favoritesCount)||0);i.textContent=`Submissions ${m} \xB7 Releases ${h} \xB7 Votes ${v} \xB7 Favorites ${p}`;let k=Array.isArray(a.warnings)?a.warnings.filter(Boolean):[];k.length?(t.hidden=!1,t.textContent=k.join(" \xB7 ")):(t.hidden=!0,t.textContent="")}function S(e){let n=e.root.querySelector('[data-dx-achievements-page-panel="overview"]');if(!(n instanceof HTMLElement))return;let i=e.badges.filter(t=>!t.secret);if(!i.length){n.innerHTML='<p class="dx-achievements-empty-text">No public achievements found.</p>';return}n.innerHTML=he(e,f,i)}function A(e){let n=e.root.querySelector('[data-dx-achievements-page-panel="secret-vault"]');if(!(n instanceof HTMLElement))return;let i=e.badges.filter(t=>t.secret);if(!i.length){n.innerHTML='<p class="dx-achievements-empty-text">Secret vault is empty.</p>';return}n.innerHTML=he(e,b,i)}function fe(e){let n=e.root.querySelector('[data-dx-achievements-page-panel="history"]');if(!(n instanceof HTMLElement))return;if(!e.historyLoaded&&e.historyLoading){n.innerHTML='<p class="dx-achievements-empty-text">Loading history\u2026</p>';return}let i=Array.isArray(e.historyEvents)?e.historyEvents:[],t=i.length?i.map(qe).join(""):'<p class="dx-achievements-empty-text">No unlock history yet.</p>';n.innerHTML=`
      <div class="dx-achievements-history">${t}</div>
      <div class="dx-achievements-history-actions">
        ${e.historyNextCursor?'<button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm" data-dx-achievements-load-more="true" data-dx-motion-include="true">Load more</button>':""}
      </div>
    `}function H(e,n){let i=n===b||n===te?n:f;e.page=i;let t=e.root.querySelector('[data-dx-achievements-app="v2"]');R(e.root,t,e.visualState,e.page),e.root.querySelectorAll("[data-dx-achievements-page]").forEach(r=>{if(!(r instanceof HTMLButtonElement))return;let c=u(r.getAttribute("data-dx-achievements-page"))===e.page;r.setAttribute("aria-pressed",c?"true":"false"),r.classList.toggle("is-active",c)}),e.root.querySelectorAll("[data-dx-achievements-page-panel]").forEach(r=>{if(!(r instanceof HTMLElement))return;let c=u(r.getAttribute("data-dx-achievements-page-panel"))===e.page;r.hidden=!c}),e.page===te&&!e.historyLoaded&&!e.historyLoading&&e.authSnapshot.authenticated&&xe(e,{append:!1})}async function N(e){let n=u(e.authSnapshot.token,""),i=_(),t=await P("/me/achievements/summary",{method:"GET",token:n,headers:{"x-dx-request-id":i}});return!t.ok||!t.payload||t.payload.ok!==!0?{ok:!1,status:t.status,payload:t.payload}:{ok:!0,payload:t.payload}}async function xe(e,{append:n=!1}={}){if(!e.authSnapshot.authenticated||e.historyLoading)return;e.historyLoading=!0,fe(e);let i=u(e.authSnapshot.token,""),t=e.historyNextCursor?`&cursor=${encodeURIComponent(e.historyNextCursor)}`:"",a=await P(`/me/achievements/history?limit=${Le}${t}`,{method:"GET",token:i,headers:{"x-dx-request-id":_()}});if(a.ok&&a.payload&&a.payload.ok===!0){let o=Array.isArray(a.payload.events)?a.payload.events:[];e.historyEvents=n?e.historyEvents.concat(o):o,e.historyNextCursor=u(a.payload.nextCursor,""),e.historyLoaded=!0}else!n&&!e.historyLoaded&&(e.historyEvents=[],e.historyNextCursor="",e.historyLoaded=!0);e.historyLoading=!1,fe(e)}async function je(e,n=[]){if(!e.authSnapshot.authenticated)return;let i=u(e.authSnapshot.token,""),t={badgeIds:Array.isArray(n)?n:[]},a=await P("/me/achievements/seen",{method:"POST",token:i,body:t,headers:{"x-dx-request-id":_()}});if(!a.ok||!a.payload||a.payload.ok!==!0){y(e,"Unable to clear new badge markers.",{error:!0});return}y(e,"New badge markers cleared.");let o=await N(e);o.ok&&B(e,o.payload)}async function Ye(e,n){if(!e.authSnapshot.authenticated)return;let i=u(e.authSnapshot.token,""),t=_(),a=await P("/me/achievements/secret-claim",{method:"POST",token:i,body:{claim:n,badgeId:n,clientRequestId:t},headers:{"x-dx-request-id":_(),"x-dx-idempotency-key":t}});if(!a.ok||!a.payload||a.payload.ok!==!0){y(e,"Secret claim failed.",{error:!0});return}let o=u(a.payload.state,"");o==="already_unlocked"?y(e,"Secret already unlocked."):o==="unlocked"?y(e,"Secret unlocked."):o==="not_eligible"?y(e,"Not eligible yet.",{error:!0}):y(e,"Invalid claim.",{error:!0});let r=await N(e);r.ok&&B(e,r.payload)}function B(e,n){let i=n&&typeof n=="object"?n:{},t=(Array.isArray(i.badges)?i.badges:[]).filter(s=>{var v,p;if(!s||typeof s!="object"||u(s.visibility,"default").toLowerCase()!=="hidden-until-unlocked")return!0;let m=Math.max(1,Number(s.threshold)||1),h=Math.max(0,Number((p=(v=s.progress)!=null?v:s.metricValue)!=null?p:0)||0);return!!s.unlocked||h>=m}),a=Array.isArray(i.newlyUnlocked)?i.newlyUnlocked.map(s=>u(s&&typeof s=="object"?s.id:s,"").toLowerCase()).filter(Boolean):[];e.summary={...i,badges:t},e.newlyUnlockedSet=new Set(a),e.badges=t.map(s=>Ce(s,e)),Fe(e),S(e),A(e),pe("dx:achievements:updated",i);for(let s of e.badges)!s.newly||e.emittedUnlocked.has(s.id)||(e.emittedUnlocked.add(s.id),pe("dx:achievements:unlocked",{badgeId:s.id,title:s.title,tier:s.tier,secret:s.secret}));let o=ve();if(o){let s=e.badges.find(d=>d.id===o);if(s){if(s.secret){let m=e.badges.filter(h=>h.secret).findIndex(h=>h.id===o);e.badgePages[b]=Math.max(0,Math.floor(m/C(e))),A(e),H(e,b)}else{let m=e.badges.filter(h=>!h.secret).findIndex(h=>h.id===o);e.badgePages[f]=Math.max(0,Math.floor(m/C(e))),S(e),H(e,f)}Oe(e,o)}}e.visualState=e.badges.length?Se:Ae;let r=e.root.querySelector('[data-dx-achievements-app="v2"]');R(e.root,r,e.visualState,e.page),$(e.root,O);let c=e.root.querySelector("[data-dx-achievements-mark-seen]");c instanceof HTMLButtonElement&&(c.hidden=e.newlyUnlockedSet.size===0)}function Xe(e){let n=e.root.querySelector("[data-dx-achievement-inspector]"),i=e.root.querySelector("[data-dx-achievement-inspector-close]");if(!(n instanceof HTMLDialogElement))return;i instanceof HTMLButtonElement&&i.addEventListener("click",()=>ue(e)),n.addEventListener("click",a=>{a.target===n&&ue(e)}),n.addEventListener("close",()=>{n.classList.remove("is-visible"),e.inspector.dragging=!1,e.inspector.pointerId=null,e.inspector.shader&&(e.inspector.shader.dispose(),e.inspector.shader=null);let a=e.inspector.opener;e.inspector.opener=null,a&&a.isConnected&&window.requestAnimationFrame(()=>a.focus({preventScroll:!0}))}),n.addEventListener("pointerdown",a=>{let o=a.target instanceof Element?a.target:null,r=o?o.closest("[data-dx-achievement-inspect-object]"):null;if(r instanceof HTMLElement){e.inspector.dragging=!0,e.inspector.pointerId=a.pointerId,e.inspector.startX=a.clientX,e.inspector.startY=a.clientY,e.inspector.startRotationX=e.inspector.rotationX,e.inspector.startRotationY=e.inspector.rotationY,r.classList.add("is-dragging");try{r.setPointerCapture(a.pointerId)}catch{}a.preventDefault()}}),n.addEventListener("pointermove",a=>{let o=n.querySelector("[data-dx-achievement-inspect-object]");if(!(o instanceof HTMLElement))return;let r=o.getBoundingClientRect(),c=r.width>0?x(0,1,(a.clientX-r.left)/r.width):.5,s=r.height>0?x(0,1,1-(a.clientY-r.top)/r.height):.5;if(e.inspector.shader&&e.inspector.shader.setPointer(c,s),o.style.setProperty("--dx-inspect-light-x",`${c*100}%`),o.style.setProperty("--dx-inspect-light-y",`${(1-s)*100}%`),!e.inspector.dragging||e.inspector.pointerId!==a.pointerId)return;let d=a.clientX-e.inspector.startX,m=a.clientY-e.inspector.startY;e.inspector.rotationY=e.inspector.startRotationY+d*.48,e.inspector.rotationX=x(-34,34,e.inspector.startRotationX-m*.36),G(e),a.preventDefault()});let t=a=>{if(!e.inspector.dragging||e.inspector.pointerId!==null&&a.pointerId!==e.inspector.pointerId)return;e.inspector.dragging=!1,e.inspector.pointerId=null;let o=n.querySelector("[data-dx-achievement-inspect-object]");o instanceof HTMLElement&&o.classList.remove("is-dragging")};n.addEventListener("pointerup",t),n.addEventListener("pointercancel",t),n.addEventListener("dblclick",a=>{let o=a.target instanceof Element?a.target:null;!o||!o.closest("[data-dx-achievement-inspect-object]")||V(e)}),n.addEventListener("keydown",a=>{let o=a.target instanceof Element?a.target:null;if(!o||!o.closest("[data-dx-achievement-inspect-object]"))return;let r=a.shiftKey?24:12;if(a.key==="ArrowLeft")e.inspector.rotationY-=r;else if(a.key==="ArrowRight")e.inspector.rotationY+=r;else if(a.key==="ArrowUp")e.inspector.rotationX=x(-34,34,e.inspector.rotationX-r*.6);else if(a.key==="ArrowDown")e.inspector.rotationX=x(-34,34,e.inspector.rotationX+r*.6);else if(a.key==="Home")V(e);else return;G(e),a.preventDefault()})}function Ge(e){e.root.querySelectorAll("[data-dx-achievements-page]").forEach(a=>{a instanceof HTMLButtonElement&&a.addEventListener("click",()=>{H(e,a.getAttribute("data-dx-achievements-page"))})});let i=e.root.querySelector("[data-dx-achievements-refresh]");i instanceof HTMLButtonElement&&i.addEventListener("click",async()=>{i.disabled=!0;let a=await N(e);a.ok?(B(e,a.payload),y(e,"Achievements refreshed.")):y(e,"Unable to refresh achievements.",{error:!0}),i.disabled=!1});let t=e.root.querySelector("[data-dx-achievements-mark-seen]");if(t instanceof HTMLButtonElement&&t.addEventListener("click",async()=>{t.disabled||(t.disabled=!0,await je(e,Array.from(e.newlyUnlockedSet)),t.disabled=!1)}),Xe(e),typeof ResizeObserver=="function"){let a=0;e.layoutObserver=new ResizeObserver(()=>{a||(a=window.requestAnimationFrame(()=>{a=0;let o=C(e);o===e.badgePageSize||!e.summary||(e.badgePageSize=o,S(e),A(e))}))}),e.layoutObserver.observe(e.root)}e.root.addEventListener("pointermove",a=>{if(a.pointerType==="touch")return;let o=a.target instanceof Element?a.target:null,r=o?o.closest(".dx-achievement-card"):null;if(!(r instanceof HTMLElement))return;let c=r.getBoundingClientRect();if(c.width<=0||c.height<=0)return;let s=x(0,1,(a.clientX-c.left)/c.width),d=x(0,1,(a.clientY-c.top)/c.height);r.style.setProperty("--dx-card-light-x",`${s*100}%`),r.style.setProperty("--dx-card-light-y",`${d*100}%`),r.style.setProperty("--dx-card-tilt-x",`${(.5-d)*2.4}deg`),r.style.setProperty("--dx-card-tilt-y",`${(s-.5)*3.2}deg`)}),e.root.addEventListener("pointerout",a=>{let o=a.target instanceof Element?a.target:null,r=o?o.closest(".dx-achievement-card"):null;if(!(r instanceof HTMLElement))return;let c=a.relatedTarget instanceof Node?a.relatedTarget:null;c&&r.contains(c)||(r.style.removeProperty("--dx-card-light-x"),r.style.removeProperty("--dx-card-light-y"),r.style.removeProperty("--dx-card-tilt-x"),r.style.removeProperty("--dx-card-tilt-y"))}),e.root.addEventListener("keydown",a=>{if(a.key!=="Enter"&&a.key!==" ")return;let o=a.target instanceof Element?a.target:null,r=o?o.closest("[data-dx-achievement-open]"):null;if(!(r instanceof HTMLElement)||o instanceof HTMLButtonElement)return;let c=u(r.getAttribute("data-dx-achievement-open"),"").toLowerCase();c&&(me(e,c,r),a.preventDefault())}),e.root.addEventListener("click",a=>{let o=a.target instanceof Element?a.target:null;if(!o)return;let r=o.closest("[data-dx-achievement-claim]");if(r instanceof HTMLButtonElement){let p=u(r.getAttribute("data-dx-achievement-claim"),"").toLowerCase();if(!p)return;r.disabled=!0,Ye(e,p).finally(()=>{r.disabled=!1});return}let c=o.closest('[data-dx-achievements-load-more="true"]');if(c instanceof HTMLButtonElement){if(!e.historyNextCursor)return;c.disabled=!0,xe(e,{append:!0}).finally(()=>{c.disabled=!1});return}let s=o.closest("[data-dx-achievements-badge-page-index]");if(s instanceof HTMLButtonElement){let p=u(s.getAttribute("data-dx-achievements-badge-page"),f),k=Number(s.getAttribute("data-dx-achievements-badge-page-index"))||0;e.badgePages[p]=k,p===b?A(e):S(e);return}let d=o.closest("[data-dx-achievements-badge-page-prev]");if(d instanceof HTMLButtonElement){let p=u(d.getAttribute("data-dx-achievements-badge-page-prev"),f);e.badgePages[p]=Math.max(0,(Number(e.badgePages[p])||0)-1),p===b?A(e):S(e);return}let m=o.closest("[data-dx-achievements-badge-page-next]");if(m instanceof HTMLButtonElement){let p=u(m.getAttribute("data-dx-achievements-badge-page-next"),f);e.badgePages[p]=(Number(e.badgePages[p])||0)+1,p===b?A(e):S(e);return}let h=o.closest("[data-dx-achievement-open]");if(!(h instanceof HTMLElement))return;let v=u(h.getAttribute("data-dx-achievement-open"),"").toLowerCase();v&&me(e,v,h)})}function Ve(e){e.innerHTML=`
      <div class="dx-route-loader" data-dx-route-loader role="status" aria-live="polite">
        <div class="dx-route-loader-inner">
          <div class="dx-route-loader-meta">
            <span class="dx-route-loader-phase">Loading</span>
            <span class="dx-route-loader-detail">your achievements</span>
          </div>
          <div class="dx-route-loader-track"><span class="dx-route-loader-fill"></span></div>
        </div>
      </div>
      <div class="dex-sidebar dx-achievements-shell" data-dx-achievements-app="v2" data-dx-achievements-state="loading" data-dx-achievements-page="overview">
        <div class="dx-achievements-panel" data-dx-achievements-body>
          <header class="dx-achievements-header">
            <div>
              <p class="dx-achievements-kicker">PROFILE</p>
              <h1>YOUR ACHIEVEMENTS</h1>
              <p class="dx-achievements-sub" data-dx-achievements-totals>Loading achievement summary\u2026</p>
              <p class="dx-achievements-sub" data-dx-achievements-metrics></p>
            </div>
            <div class="dx-achievements-actions">
              <button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm" data-dx-achievements-refresh data-dx-motion-include="true">Refresh</button>
              <button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm" data-dx-achievements-mark-seen data-dx-motion-include="true" hidden>Mark seen</button>
            </div>
          </header>
          <p class="dx-achievements-warning" data-dx-achievements-warning hidden></p>
          <nav class="dx-achievements-nav" aria-label="Achievements pages">
            <button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm is-active" aria-pressed="true" data-dx-achievements-page="overview" data-dx-motion-include="true">Overview</button>
            <button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm" aria-pressed="false" data-dx-achievements-page="secret-vault" data-dx-motion-include="true">Secret Vault</button>
            <button type="button" class="dx-button-element dx-button-element--secondary dx-button-size--sm" aria-pressed="false" data-dx-achievements-page="history" data-dx-motion-include="true">History</button>
          </nav>
          <div class="dx-achievements-page" data-dx-achievements-page-panel="overview"></div>
          <div class="dx-achievements-page" data-dx-achievements-page-panel="secret-vault" hidden></div>
          <div class="dx-achievements-page" data-dx-achievements-page-panel="history" hidden></div>
        </div>
        <div class="dx-achievements-toast-stack" data-dx-achievements-toasts></div>
      </div>
      <dialog class="dx-achievement-inspector" data-dx-achievement-inspector aria-modal="true">
        <button type="button" class="dx-achievement-inspector-close" data-dx-achievement-inspector-close aria-label="Close achievement viewer">Close</button>
        <div class="dx-achievement-inspector-stage">
          <div class="dx-achievement-inspect-viewport" data-dx-achievement-inspect-viewport></div>
        </div>
        <p class="dx-achievement-inspector-hint">Drag to rotate \xB7 Arrow keys inspect \xB7 Double-click resets \xB7 Esc closes</p>
      </dialog>
    `}async function Ke(e){if(!(e instanceof HTMLElement)||e.getAttribute("data-dx-achievements-mounted")==="true")return;e.setAttribute("data-dx-achievements-mounted","true"),$(e,Q),Ve(e);let n={root:e,page:f,visualState:J,summary:null,badges:[],historyEvents:[],historyNextCursor:"",historyLoaded:!1,historyLoading:!1,badgePages:{[f]:0,[b]:0},newlyUnlockedSet:new Set,emittedUnlocked:new Set,authSnapshot:{auth:null,authenticated:!1,token:"",user:null},inspector:{badgeId:"",opener:null,shader:null,dragging:!1,pointerId:null,startX:0,startY:0,startRotationX:E.x,startRotationY:E.y,rotationX:E.x,rotationY:E.y},badgePageSize:ne,layoutObserver:null};Ge(n),R(e,e.querySelector('[data-dx-achievements-app="v2"]'),J,f);let i=I();if(n.authSnapshot=await Ie(),!n.authSnapshot.authenticated||!u(n.authSnapshot.token,"")){n.visualState=ee,R(e,e.querySelector('[data-dx-achievements-app="v2"]'),ee,f),ze(n);let o=z-(I()-i);o>0&&await F(o),$(e,O);return}let t=await N(n);if(!t.ok){n.visualState=Z,R(e,e.querySelector('[data-dx-achievements-app="v2"]'),Z,f);let o=e.querySelector("[data-dx-achievements-body]");o instanceof HTMLElement&&(o.innerHTML=`
          <article class="dx-achievements-empty" data-dx-motion-include="true">
            <h3>Unable to load achievements</h3>
            <p>Try again in a moment. If this persists, open Messages for system updates.</p>
          </article>
        `);let r=z-(I()-i);r>0&&await F(r),$(e,Ee);return}B(n,t.payload),ve()||H(n,f);let a=z-(I()-i);a>0&&await F(a),$(e,O)}function U(){document.querySelectorAll("#dex-achv").forEach(n=>{Ke(n)})}window.__dxAchievementsMount=U,document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{U()},{once:!0}):U(),window.addEventListener("dx:slotready",()=>{U()})})();})();
