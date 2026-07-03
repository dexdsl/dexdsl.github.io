(()=>{var B={V:"Voice + Body",K:"Keyboards",B:"Brass",E:"Electronics",S:"Strings",W:"Winds",P:"Percussion",X:"Other"},T={A:"Audio",AV:"Audiovisual"},P=new RegExp("^([A-Za-z])\\.([A-Za-z]{1,6})\\.?\\s+([A-Za-z][A-Za-z'\u2019-]*)\\s+(AV|A)(\\d{4})\\s+(S\\d+)$");function Z(i){return String(i==null?"":i).replace(/[​-‍﻿]/g,"").replace(/\s+/g," ").trim()}function Q(i){return String(i==null?"":i).normalize("NFD").replace(/[̀-ͯ]/g,"")}function Y(i){return Z(i).toLowerCase()}function ee(i){return(Array.isArray(i)?i:[]).map(n=>Q(n&&n.family).replace(/[^A-Za-z]/g,"")).filter(Boolean).sort((n,d)=>n.toLowerCase().localeCompare(d.toLowerCase())).map(n=>n.charAt(0).toUpperCase()+(n.charAt(1)||"").toLowerCase()).join("")}function W(i,t={}){let n=Z(i),d=[];if(!n)return{raw:"",valid:!1,issues:["empty lookup number"],norm:""};let h=n,b=n.match(/^([A-Za-z]+\d*)-(.+)$/);b&&!P.test(n)&&(h=b[2],d.push(`non-standard prefix "${b[1]}-"`));let y=P.exec(h);if(!y)return{raw:n,valid:!1,issues:[...d,'does not match grammar "Family.Instrument. Cutter (A|AV)YYYY S#"'],norm:Y(n)};let[,l,g,$,v,E,R]=y,A=l.toUpperCase();A in B||d.push(`family "${A}" not in controlled vocabulary`),v in T||d.push(`medium "${v}" not in controlled vocabulary`);let w=Number(E);(!Number.isFinite(w)||w<2e3||w>2100)&&d.push(`year "${E}" out of range`);let e=ee(t.performers),a=!e||e.toLowerCase()===$.toLowerCase();return e&&!a&&d.push(`cutter "${$}" \u2260 authority-derived "${e}"`),{raw:n,family:A,familyLabel:B[A]||"",instrument:g,cutter:$,expectedCutter:e,cutterMatches:a,medium:v,mediumLabel:T[v]||"",year:w,season:R,norm:Y(n),valid:d.length===0,issues:d}}var F=Object.freeze({V:"Aerial video",I:"Field stills",A:"Ambient sound",D:"Imaging study"}),_=Object.freeze({FS:"Full-spectrum",RGB:"Visible light",IR:"Infrared",TH:"Thermal"}),H="X",re=Object.freeze([...Object.keys(F),H]),M=/^[A-Z][a-z]{2}$/,D=/^[A-Z][a-z]$/,N=/^T[1-9]\d*$/;function U(i){return String(i!=null?i:"").replace(/[\u200B-\u200D\uFEFF]/g,"").replace(/\s+/g," ").trim()}function O(i){let t=U(i);return t?`${t.charAt(0).toUpperCase()}${t.slice(1).toLowerCase()}`:""}function q(i){let t=U(i);return t?`${t.charAt(0).toUpperCase()}${t.slice(1).toLowerCase()}`:""}function z(i){return U(i).toUpperCase()}function I(i){return U(i).toLowerCase()}function V({subjectCode:i,siteCutter:t,year:n,tour:d}){let h=O(i),b=q(t),y=z(d),l=Number(n);if(!M.test(h))throw new Error(`Invalid UAV subject code: ${i}`);if(!D.test(b))throw new Error(`Invalid UAV site Cutter: ${t}`);if(!Number.isInteger(l)||l<2e3||l>2100)throw new Error(`Invalid UAV year: ${n}`);if(!N.test(y))throw new Error(`Invalid UAV tour: ${d}`);return`DR.${h}. ${b} ${l} ${y}`}function te({subjectCode:i,siteCutter:t,captureClass:n,year:d,tour:h,spectrum:b}){let y=V({subjectCode:i,siteCutter:t,year:d,tour:h}),l=U(n).toUpperCase(),g=U(b).toUpperCase();if(!(l in F))throw new Error(`Invalid UAV capture class: ${n}`);if(l==="A"&&g)throw new Error("Ambient-sound UAV series must omit spectrum");if(l!=="A"&&!(g in _))throw new Error(`${l} UAV series requires one of ${Object.keys(_).join(", ")}`);let $=y.replace(` ${Number(d)} `,` ${l}${Number(d)} `);return g?`${$} [${g}]`:$}function G(i){let t=U(i),n=p=>({raw:t,norm:I(t),valid:!1,issues:Array.isArray(p)?p:[p]});if(!t)return n("empty UAV lookup");let d=t.match(/^DR\.([A-Za-z]{3})\.\s+([A-Za-z]{2})\s+(\d{4})\s+(T\d+)$/i);if(d){let[,p,C,S,k]=d,o=O(p),c=q(C),L=z(k),x=[];M.test(o)||x.push(`subject code "${p}" must be three Title-case letters`),D.test(c)||x.push(`site Cutter "${C}" must be two Title-case letters`),N.test(L)||x.push(`tour "${k}" must match T#`);let j=Number(S);(j<2e3||j>2100)&&x.push(`year "${S}" out of range`);let K=x.length?t:V({subjectCode:o,siteCutter:c,year:j,tour:L});return!x.length&&K!==t&&x.push(`non-canonical form; expected "${K}"`),{raw:t,norm:I(t),level:"collection",wing:"DR",subjectCode:o,siteCutter:c,year:j,tour:L,valid:x.length===0,issues:x}}let h=t.match(/^DR\.([A-Za-z]{3})\.\s+([A-Za-z]{2})\s+([VIAD])(\d{4})\s+(T\d+)(?:\s+\[(FS|RGB|IR|TH)\])?\s+([VIADX])\.([1-9]\d{0,5})$/i),b=t.match(/^DR\.([A-Za-z]{3})\.\s+([A-Za-z]{2})\s+([VIAD])(\d{4})\s+(T\d+)(?:\s+\[(FS|RGB|IR|TH)\])?$/i),y=h||b;if(!y)return n("does not match UAV collection, capture-series, or item grammar");let[,l,g,$,v,E,R]=y,A=O(l),w=q(g),e=$.toUpperCase(),a=String(R||"").toUpperCase(),m=z(E),r=Number(v),s=[];M.test(A)||s.push(`subject code "${l}" must be three Title-case letters`),D.test(w)||s.push(`site Cutter "${g}" must be two Title-case letters`),e in F||s.push(`capture class "${$}" is not controlled`),e==="A"&&a&&s.push("ambient-sound series must omit spectrum"),e!=="A"&&!(a in _)&&s.push(`${e} series requires one of ${Object.keys(_).join(", ")}`),N.test(m)||s.push(`tour "${E}" must match T#`),(r<2e3||r>2100)&&s.push(`year "${v}" out of range`);let u={subjectCode:A,siteCutter:w,captureClass:e,year:r,tour:m,spectrum:a},f=s.length?"":te(u);if(h){let p=h[7].toUpperCase(),C=Number(h[8]);p!==e&&p!==H&&s.push(`${e} series accepts only ${e} or X items`);let S=s.length?t:`${f} ${p}.${C}`;return!s.length&&S!==t&&s.push(`non-canonical form; expected "${S}"`),{raw:t,norm:I(t),level:"item",wing:"DR",...u,bucket:p,number:C,seriesLookup:f,collectionLookup:V(u),valid:s.length===0,issues:s}}return!s.length&&f!==t&&s.push(`non-canonical form; expected "${f}"`),{raw:t,norm:I(t),level:"series",wing:"DR",...u,collectionLookup:s.length?"":V(u),valid:s.length===0,issues:s}}function X(i){return String(i==null?"":i).replace(/(\p{L})\1/gu,"$1\u200C$1")}function se(){return document.getElementById("gooey-mesh-wrapper")}function J(){try{window.dispatchEvent(new CustomEvent("dx:gooey-mesh:request"))}catch{}return se()}(()=>{if(typeof window=="undefined"||typeof document=="undefined")return;if(window.__dxGuideLoaded&&typeof window.__dxGuideMount=="function"){try{window.__dxGuideMount()}catch{}return}window.__dxGuideLoaded=!0;let i="/data/catalog.symbols.json",t=e=>String(e==null?"":e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"),n=e=>t(X(String(e==null?"":e))),d=[{text:"K.Hps.",part:1},{text:"Su",part:1},{text:"AV2023",part:2},{text:"S1",part:2},{text:"B.13",part:3},{text:"[4K]",part:4},{text:"[Met Perc Cle Lou Poly Exc]",part:4}],h=[{n:1,title:"Instrument \xB7 Performer",tag:"K.Hps. Su",body:"The instrument family class and abbreviation, then the performer\u2019s Cutter \u2014 a short code built from their surname. K = Keyboards, Hps = harpsichord, Su = Suarez-Solis."},{n:2,title:"Medium \xB7 Year \xB7 Season",tag:"AV2023 S1",body:"AV = audiovisual (A would mean audio-only), produced in 2023, from Season 1. We run one or two seasons a year."},{n:3,title:"Bucket \xB7 Number",tag:"B.13",body:"Inside a collection: the sample\u2019s type bucket (A\u2013E, or X for other) followed by its running number."},{n:4,title:"Quality \xB7 Qualifiers",tag:"[4K] [Met\u2026]",body:"Bracketed descriptors \u2014 resolution/format first ([4K], [1080p], [ste], [4ch]), then signifier codes describing the sound."}],b=[["A","Bucket A"],["B","Bucket B"],["C","Bucket C"],["D","Bucket D"],["E","Bucket E"],["X","Other"]],y=["K.Hps. Su AV2023 S1","W.Bsn. CoTo AV2024 S2","DR.Win. Mo 2026 T1","DR.Win. Mo V2026 T1 [FS]"];function l(e,a){let m=`${e} ${a}`.toLowerCase();return`<div class="dx-guide-sym" data-text="${t(m)}"><span class="dx-guide-sym-code">${t(e)}</span><span class="dx-guide-sym-label">${t(a)}</span></div>`}function g(e,a){return a?`<div class="dx-guide-sym-group"><h3 class="dx-guide-sym-group-title">${n(e)}</h3><div class="dx-guide-sym-grid">${a}</div></div>`:""}function $(e){let a=Array.isArray(e&&e.qualifier)?e.qualifier:[],m=a.find(u=>/^met$/i.test(String(u.key_raw||"").trim())),r=a.filter(u=>u!==m).map(u=>[String(u.key_raw||""),String(u.description_raw||"")]),s=[];return m&&(s=String(m.description_raw||"").split(";").map(u=>u.trim()).filter(Boolean).map(u=>{let f=u.split(/\s+-\s+/);return f.length>=2?[f[0].trim(),f.slice(1).join(" - ").trim()]:["Met",u.trim()]})),{quality:r,signifiers:s}}function v(e){let a=String(e||"").trim();if(!a)return'<p class="dx-guide-decode-empty">Type or paste a collection lookup to decode it.</p>';let m=/^DR\./i.test(a),r=m?G(a):W(a);if(!r.valid)return`<div class="dx-guide-decode-result is-invalid">
        <p class="dx-guide-decode-status">Not a valid collection lookup</p>
        <ul class="dx-guide-decode-issues">${(r.issues||[]).map(f=>`<li>${t(f)}</li>`).join("")}</ul>
        <p class="dx-guide-decode-grammar"><code>${m?"DR.Subject. Site [Class]YYYY T# [Spectrum]":"Family.Instrument. Cutter (A|AV)YYYY S#"}</code></p>
      </div>`;let s=(u,f,p)=>`<div class="dx-guide-facet"><span class="dx-guide-facet-label">${t(u)}</span><span class="dx-guide-facet-value">${n(f)}</span>${p?`<span class="dx-guide-facet-sub">${t(p)}</span>`:""}</div>`;return m?`<div class="dx-guide-decode-result is-valid">
        <p class="dx-guide-decode-status">Valid dexDRONES ${t(r.level)} lookup</p>
        <div class="dx-guide-facets">
          ${s("Wing",r.wing,"dexDRONES")}
          ${s("Subject",r.subjectCode,"LCSH-backed code")}
          ${s("Site Cutter",r.siteCutter,"geographic authority")}
          ${r.captureClass?s("Class",r.captureClass,"capture series"):""}
          ${s("Year",String(r.year),"captured")}
          ${s("Tour",r.tour,"site-year visit")}
          ${r.spectrum?s("Spectrum",r.spectrum,"acquisition"):""}
          ${r.bucket?s("Bucket",`${r.bucket}.${r.number}`,r.bucket==="X"?"raw/support":"deliverable"):""}
        </div>
      </div>`:`<div class="dx-guide-decode-result is-valid">
      <p class="dx-guide-decode-status">Valid collection lookup</p>
      <div class="dx-guide-facets">
        ${s("Family",r.family,r.familyLabel)}
        ${s("Instrument",r.instrument,"abbreviation")}
        ${s("Cutter",r.cutter,"performer")}
        ${s("Medium",r.medium,r.mediumLabel)}
        ${s("Year",String(r.year),"produced")}
        ${s("Season",r.season,"edition")}
      </div>
    </div>`}function E(e){let{quality:a,signifiers:m}=e,r=d.map(o=>`<button type="button" class="dx-guide-seg" data-part="${o.part}">${t(o.text)}</button>`).join(""),s=h.map(o=>`<article class="dx-guide-part" data-part="${o.n}">
        <span class="dx-guide-part-n">${o.n}</span>
        <div class="dx-guide-part-copy">
          <h3 class="dx-guide-part-title">${n(o.title)}</h3>
          <code class="dx-guide-part-tag">${t(o.tag)}</code>
          <p class="dx-guide-part-body">${t(o.body)}</p>
        </div>
      </article>`).join(""),u=y.map(o=>`<button type="button" class="dx-guide-example" data-lookup="${t(o)}">${t(o)}</button>`).join(""),f=Object.entries(B).map(([o,c])=>l(o,c)).join(""),p=Object.entries(T).map(([o,c])=>l(o,c)).join(""),C=b.map(([o,c])=>l(o,c)).join(""),S=a.length?a.map(([o,c])=>l(o,c)).join(""):"",k=m.length?m.map(([o,c])=>l(o,c)).join(""):"";return`<div class="dx-guide">
      <header class="dx-guide-hero" id="dex-how">
        <p class="dx-guide-kicker">Catalog reference</p>
        <h1 class="dx-guide-title">${n("Lookup Numbers")}</h1>
        <p class="dx-guide-lede">Every sample in dex carries a faceted lookup number \u2014 a compact call number that says which instrument, who played it, when, and how. Here\u2019s how to read one, and a decoder to try your own.</p>
      </header>

      <section class="dx-guide-card dx-guide-anatomy" aria-label="Anatomy of a lookup">
        <p class="dx-guide-section-kicker">Anatomy</p>
        <div class="dx-guide-specimen" role="group" aria-label="Example lookup, by part">${r}</div>
        <div class="dx-guide-parts">${s}</div>
      </section>

      <section class="dx-guide-card dx-guide-decoder" aria-label="Live decoder">
        <p class="dx-guide-section-kicker">Decoder</p>
        <h2 class="dx-guide-section-title">${n("Decode a lookup")}</h2>
        <label class="dx-guide-input-wrap">
          <span class="dx-guide-input-hint">Collection lookup</span>
          <input class="dx-guide-input" type="text" spellcheck="false" autocomplete="off" autocapitalize="off"
                 value="${t(y[0])}" placeholder="e.g. K.Hps. Su AV2023 S1" data-dx-guide-input>
        </label>
        <div class="dx-guide-examples">${u}</div>
        <div class="dx-guide-decode" data-dx-guide-decode>${v(y[0])}</div>
      </section>

      <section class="dx-guide-card dx-guide-symbols" id="list-of-identifiers" aria-label="List of symbols">
        <div class="dx-guide-symbols-head">
          <div>
            <p class="dx-guide-section-kicker">Reference</p>
            <h2 class="dx-guide-section-title">${n("List of Symbols")}</h2>
          </div>
          <label class="dx-guide-filter-wrap">
            <input class="dx-guide-filter" type="search" placeholder="Filter symbols\u2026" data-dx-guide-filter aria-label="Filter symbols">
          </label>
        </div>
        <div class="dx-guide-sym-groups" data-dx-guide-symbols>
          ${g("Instrument families",f)}
          ${g("Medium",p)}
          ${g("Sample buckets",C)}
          ${g("Quality & format",S)}
          ${g("Signifiers",k)}
        </div>
        <p class="dx-guide-empty" data-dx-guide-empty hidden>No symbols match that filter.</p>
      </section>
    </div>`}function R(e){let a=Array.from(e.querySelectorAll(".dx-guide-seg")),m=Array.from(e.querySelectorAll(".dx-guide-part")),r=o=>{a.forEach(c=>c.classList.toggle("is-active",c.getAttribute("data-part")===o)),m.forEach(c=>c.classList.toggle("is-active",c.getAttribute("data-part")===o))};a.forEach(o=>{let c=o.getAttribute("data-part");o.addEventListener("mouseenter",()=>r(c)),o.addEventListener("focus",()=>r(c)),o.addEventListener("click",()=>r(c))}),m.forEach(o=>{let c=o.getAttribute("data-part");o.addEventListener("mouseenter",()=>r(c))});let s=e.querySelector("[data-dx-guide-input]"),u=e.querySelector("[data-dx-guide-decode]"),f=()=>{u&&s&&(u.innerHTML=v(s.value))};s&&s.addEventListener("input",f),e.querySelectorAll(".dx-guide-example").forEach(o=>{o.addEventListener("click",()=>{s&&(s.value=o.getAttribute("data-lookup")||"",f(),s.focus())})});let p=e.querySelector("[data-dx-guide-filter]"),C=Array.from(e.querySelectorAll(".dx-guide-sym")),S=Array.from(e.querySelectorAll(".dx-guide-sym-group")),k=e.querySelector("[data-dx-guide-empty]");p&&p.addEventListener("input",()=>{let o=p.value.trim().toLowerCase();C.forEach(L=>{let x=!o||(L.getAttribute("data-text")||"").includes(o);L.hidden=!x});let c=!1;S.forEach(L=>{let x=L.querySelector(".dx-guide-sym:not([hidden])");L.hidden=!x,x&&(c=!0)}),k&&(k.hidden=c)})}async function A(){try{let e=await fetch(i,{headers:{accept:"application/json"}});return e.ok?$(await e.json()):{quality:[],signifiers:[]}}catch{return{quality:[],signifiers:[]}}}async function w(){let e=document.getElementById("dex-guide");if(!e)return;J();let a=await A();e.innerHTML=E(a),e.removeAttribute("aria-busy"),R(e)}window.__dxGuideMount=w,document.readyState==="loading"?document.addEventListener("DOMContentLoaded",w,{once:!0}):w()})();})();
