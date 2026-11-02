/* Highfield Assembly: renders the site from HF data (built-in defaults, replaced by CMS content when available). */
(function(){
  const D = window.HF_DEFAULTS;
  const data = {
    WEEK: D.WEEK, PEOPLE: D.PEOPLE, MINISTRIES: D.MINISTRIES, ICONS: D.ICONS, DEPTS: D.DEPTS,
    SERMONS: D.SERMONS, EVENTS: D.EVENTS, PHOTOS: D.PHOTOS, SENIOR: D.SENIOR, ELDERS_DEACONS: D.ELDERS_DEACONS,
    examples: { sermons: true, events: true }
  };

  const $ = s => document.querySelector(s);
  const fmtPhone = p => p.replace(/(\d{4})(\d{3})(\d{3})/, "$1 $2 $3");
  const waNum = p => "263" + p.replace(/^0/, "");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const safeUrl = u => /^https?:\/\//i.test(u || "") || /^images\//.test(u || "") ? u : "";
  // Photos uploaded through the admin live in the database as "media:ID". They render as a
  // blank placeholder first and are fetched when they scroll into view (small size for cards,
  // full size only when someone opens the photo).
  const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
  const img = (src, w) => {
    if (typeof src === "string" && /^media:[A-Za-z0-9_-]+$/.test(src)) return `${BLANK}#hfm=${src.slice(6)}|${w >= 1200 ? "full" : "thumb"}`;
    return safeUrl(src) || "";
  };
  const mediaCache = new Map();
  let io = null;
  async function fill(el){
    const m = /#hfm=([A-Za-z0-9_-]+)\|(thumb|full)$/.exec(el.getAttribute("src") || ""); if (!m || !window.HF_CMS || !window.HF_CMS.getMedia) return;
    const key = m[1] + "|" + m[2];
    try {
      if (!mediaCache.has(key)) mediaCache.set(key, window.HF_CMS.getMedia(m[1], m[2]));
      let url = await mediaCache.get(key);
      if (!url && m[2] === "full") url = await window.HF_CMS.getMedia(m[1], "thumb");
      if (url && (el.getAttribute("src") || "").endsWith(m[1] + "|" + m[2])) el.src = url;
    } catch (_) { mediaCache.delete(key); }
  }
  function hydrate(root){
    if (!window.HF_CMS || !window.HF_CMS.getMedia) return;
    const els = (root || document).querySelectorAll('img[src*="#hfm="]');
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) { els.forEach(fill); return; }
    io = io || new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); fill(e.target); } }), { rootMargin: "300px" });
    els.forEach(el => io.observe(el));
  }
  const fmtDate = (iso, opts) => { const d = new Date(iso + "T00:00:00"); return isNaN(d) ? "" : d.toLocaleDateString("en-GB", opts || {day:"numeric", month:"long", year:"numeric"}); };

  // ---------- weekly schedule ----------
  function nextGathering(){
    const now = new Date(); let best = null;
    data.WEEK.filter(w => w.d !== null && w.start).forEach(w => {
      const [h,m] = w.start.split(":").map(Number);
      for (let add=0; add<8; add++){
        const t = new Date(now); t.setDate(now.getDate()+add); t.setHours(h,m,0,0);
        if (t.getDay()===w.d && t>now){ if(!best||t<best.t) best={t,w}; break; }
      }
    });
    return best;
  }
  function renderWeek(){
    const nx = nextGathering();
    const html = data.WEEK.map(w => {
      const isNext = nx && nx.w === w;
      return `<div class="item${isNext?" is-next":""}"><div class="day">${esc(w.day)}</div><div class="time">${esc(w.time)}</div><div><strong>${esc(w.name)}</strong>${isNext?'<span class="pill">Next</span>':""}<div class="muted">${esc(w.note)}</div></div></div>`;
    }).join("");
    $("#weekList").innerHTML = html; $("#weekList2").innerHTML = html;
    if (nx){
      const diff = Math.round((new Date(nx.t).setHours(0,0,0,0) - new Date().setHours(0,0,0,0))/864e5);
      $("#nextWhen").textContent = `${diff===0 ? "Today" : diff===1 ? "Tomorrow" : nx.w.day} ${nx.w.start}`;
      $("#nextWhat").textContent = nx.w.name;
    }
  }

  // ---------- leadership ----------
  const lastName = n => n.split(" ").filter(w=>!/^(Jnr|Snr)$/.test(w)).pop() || "?";
  function renderLeaders(){
    $("#leadersSenior").innerHTML = data.SENIOR.map(l => `<article class="senior">
      <div class="senior-pic">${l.photo?`<img src="${img(l.photo,700)}" alt="${esc(l.name)}" loading="lazy">`:`<span class="ph-initial">${esc(lastName(l.name)[0])}</span><img class="ph-logo" src="images/paoz-logo.png" alt="">`}</div>
      <div class="senior-txt"><h4>${esc(l.name)}</h4><div>${esc(l.role)}</div></div>
    </article>`).join("");
    $("#leadersED").innerHTML = data.ELDERS_DEACONS.map(l => `<article class="ed">
      <div class="ed-pic">${l.photo?`<img src="${img(l.photo,200)}" alt="${esc(l.name)}" loading="lazy">`:esc(lastName(l.name)[0])}</div>
      <h4>${esc(l.name)}</h4><div class="ed-role">${esc(l.role)}</div>
    </article>`).join("");
  }

  // ---------- contacts (static) ----------
  function renderContacts(){
    $("#contactPeople").insertAdjacentHTML("beforeend", data.PEOPLE.map(p => `
    <div style="display:grid;gap:4px;padding-top:6px">
      <div><strong>${esc(p.name)}</strong> <span class="muted">· ${esc(p.role)}</span></div>
      <div><span class="phone">${fmtPhone(p.phone)}</span><button class="copy" type="button" data-copy="${fmtPhone(p.phone)}">Copy</button></div>
      <a class="btn btn-wa" style="justify-self:start;padding:8px 14px;font-size:.85rem" href="https://wa.me/${waNum(p.phone)}" target="_blank" rel="noopener">WhatsApp ${esc(p.name)}</a>
    </div>`).join(""));
    $("#pTo").innerHTML = data.PEOPLE.map((p,i) => `<option value="${i}">${esc(p.name)}</option>`).join("");
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-copy]"); if(!b) return;
    const done = () => { b.textContent = "Copied"; setTimeout(()=>b.textContent="Copy",1500); };
    try { navigator.clipboard.writeText(b.dataset.copy).then(done, ()=>{}); } catch(_){}
  });

  // ---------- sermons ----------
  function sermonCard(s){
    const links = [
      safeUrl(s.videoUrl) && `<a class="chip-link" href="${esc(s.videoUrl)}" target="_blank" rel="noopener">Watch</a>`,
      safeUrl(s.audioUrl) && `<a class="chip-link" href="${esc(s.audioUrl)}" target="_blank" rel="noopener">Listen</a>`,
      safeUrl(s.notesUrl) && `<a class="chip-link" href="${esc(s.notesUrl)}" target="_blank" rel="noopener">Notes (PDF)</a>`
    ].filter(Boolean).join("");
    return `<div class="card sermon">
      ${s.cover ? `<div class="sermon-cover"><img src="${img(s.cover,700)}" alt="" loading="lazy"></div>` : ""}
      <div class="eyebrow">${esc(s.series || "Sermon")}</div>
      <h3>${esc(s.title)}</h3>
      <div class="muted">${[s.speaker, s.scripture].filter(Boolean).map(esc).join(" · ")}</div>
      ${s.date && /^\d{4}-/.test(s.date) ? `<div class="note">${fmtDate(s.date)}</div>` : ""}
      ${links ? `<div class="chip-row">${links}</div>` : ""}
    </div>`;
  }
  function renderSermons(){
    const q = ($("#sFilter").value || "").toLowerCase();
    const list = data.SERMONS.filter(s => !q || [s.title,s.speaker,s.series,s.scripture].join(" ").toLowerCase().includes(q));
    $("#sermonList").innerHTML = list.map(sermonCard).join("");
    $("#sermonEmpty").hidden = list.length > 0;
    hydrate($("#sermonList"));
    const ex = $("#sermonExampleNote"); if (ex) ex.hidden = !data.examples.sermons;
  }
  $("#sFilter").addEventListener("input", renderSermons);

  // ---------- events (past ones hide automatically) ----------
  const gcal = e => {
    const d = (e.date||"").replace(/-/g,"");
    let dates;
    if (e.time && /^\d\d:\d\d$/.test(e.time)) {
      const st = e.time.replace(":","") + "00";
      const en = (e.endTime && /^\d\d:\d\d$/.test(e.endTime) ? e.endTime : String(Math.min(23, +e.time.slice(0,2)+2)).padStart(2,"0")+e.time.slice(2)).replace(":","") + "00";
      dates = `${d}T${st}/${(e.endDate||e.date).replace(/-/g,"")}T${en}`;
    } else {
      const end = new Date((e.endDate||e.date)+"T00:00:00"); end.setDate(end.getDate()+1);
      dates = `${d}/${end.toISOString().slice(0,10).replace(/-/g,"")}`;
    }
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.name)}&dates=${dates}&ctz=Africa/Harare&location=${encodeURIComponent(e.venue || e.where || "PAOZ Highfield Assembly, 2407 Egypt, Highfield, Harare")}&details=${encodeURIComponent(e.summary || e.note || "")}`;
  };
  function renderEvents(){
    const today0 = new Date(); today0.setHours(0,0,0,0);
    const upcoming = data.EVENTS.filter(e => new Date((e.endDate||e.date)+"T23:59:59") >= today0)
      .sort((a,b) => (b.featured?1:0)-(a.featured?1:0) || a.date.localeCompare(b.date));
    $("#eventList").innerHTML = upcoming.length ? upcoming.map(e => `<div class="card event${e.featured?" featured":""}">
        ${e.flyer ? `<div class="sermon-cover"><img src="${img(e.flyer,800)}" alt="Flyer for ${esc(e.name)}" loading="lazy"></div>` : ""}
        <div class="eyebrow">${fmtDate(e.date,{weekday:"long",day:"numeric",month:"long"})}${e.time?` · ${esc(e.time)}`:""}</div>
        <h3>${esc(e.name)}</h3>
        <div class="muted">${[e.venue||e.where, e.summary||e.note].filter(Boolean).map(esc).join(" · ")}</div>
        <div class="chip-row">
          ${safeUrl(e.regUrl) ? `<a class="chip-link solid" href="${esc(e.regUrl)}" target="_blank" rel="noopener">Register</a>` : ""}
          <a class="chip-link" href="${gcal(e)}" target="_blank" rel="noopener">Add to Google Calendar</a>
        </div>
      </div>`).join("") : `<p class="muted">No special events are listed right now. Check our Facebook page for updates.</p>`;
  }

  // ---------- gallery ----------
  let galleryFilter = "All";
  const shot = (p,i,wide) => `<figure class="shot${wide&&p.wide?" wide":""}"><button type="button" data-photo="${i}" aria-label="View larger: ${esc(p.cap)}"><img src="${img(p.src,800)}" alt="${esc(p.cap)}" loading="lazy"></button><figcaption>${esc(p.cap)}</figcaption></figure>`;
  function renderGallery(){
    const cats = ["All", ...new Set(data.PHOTOS.map(p => p.category).filter(Boolean))];
    if (!cats.includes(galleryFilter)) galleryFilter = "All";
    const chips = $("#galleryChips");
    if (chips) chips.innerHTML = cats.length > 2 ? cats.map(c => `<button type="button" class="chip${c===galleryFilter?" on":""}" data-cat="${esc(c)}" aria-pressed="${c===galleryFilter}">${esc(c)}</button>`).join("") : "";
    $("#galleryGrid").innerHTML = data.PHOTOS.map((p,i) => (galleryFilter==="All" || p.category===galleryFilter) ? shot(p,i,true) : "").join("");
    const pick = [1,2,3].map(i => data.PHOTOS[i]).filter(Boolean);
    $("#homeGallery").innerHTML = pick.map(p => shot(p, data.PHOTOS.indexOf(p), false)).join("");
    hydrate($("#galleryGrid")); hydrate($("#homeGallery"));
  }
  document.addEventListener("click", e => {
    const c = e.target.closest("[data-cat]"); if (!c) return;
    galleryFilter = c.dataset.cat; renderGallery();
  });
  const lb = $("#lightbox");
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-photo],[data-photo-src]"); if(!b) return;
    const p = b.dataset.photoSrc ? {src:b.dataset.photoSrc, cap:b.dataset.photoCap} : data.PHOTOS[Number(b.dataset.photo)];
    if (!p) return;
    $("#lbImg").src = img(p.src,1600); $("#lbImg").alt = p.cap; $("#lbCap").textContent = p.cap;
    try { lb.showModal(); } catch(_) { lb.setAttribute("open",""); }
    fill($("#lbImg"));
  });
  $("#lbClose").addEventListener("click", () => lb.close());
  lb.addEventListener("click", e => { if (e.target === lb) lb.close(); });

  // ---------- departments & ministries ----------
  function renderDepts(){
    const html = data.DEPTS.map(d => `<figure class="dept">
      <div class="pic">${d.photo?`<img class="ph" src="${img(d.photo,700)}" alt="${esc(d.name)} at Highfield Assembly" loading="lazy">`:`<svg viewBox="0 0 24 24" aria-hidden="true">${data.ICONS[d.icon]||""}</svg>`}
        <img class="badge" src="images/paoz-logo.png" alt=""></div>
      <figcaption><div><h3>${esc(d.name)}</h3><div class="sub">${esc(d.sub)}</div></div></figcaption>
    </figure>`).join("");
    $("#deptsHome").innerHTML = html; $("#deptsMin").innerHTML = html;
  }
  function renderMinistries(){
    $("#ministryList").innerHTML = data.MINISTRIES.map(m => `<div class="card"><div class="eyebrow">${esc(m.when)}</div><h3>${esc(m.name)}</h3><p class="muted">${esc(m.text)}</p></div>`).join("");
  }

  // ---------- forms: save to the CMS when it is set up, otherwise WhatsApp ----------
  function waLink(num, text){ return `https://wa.me/${waNum(num)}?text=${encodeURIComponent(text)}`; }
  function openWA(url, statusEl){
    const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    statusEl.hidden = false;
    statusEl.innerHTML = `WhatsApp should open with your message ready. If it doesn't, <a href="${url}" target="_blank" rel="noopener">tap here</a>.`;
  }
  async function handleForm(e, collection, record, waNumber, waText, statusEl, okMsg){
    e.preventDefault();
    const form = e.target;
    if (form.querySelector(".hp") && form.querySelector(".hp").value) return; // spam trap
    const wa = waLink(waNumber, waText);
    if (window.HF_CMS && window.HF_CMS.ready) {
      const btn = form.querySelector('button[type="submit"]'); btn.disabled = true;
      statusEl.hidden = false; statusEl.textContent = "Sending…";
      try {
        await window.HF_CMS.submit(collection, record);
        form.reset();
        statusEl.innerHTML = `${okMsg} You can also <a href="${wa}" target="_blank" rel="noopener">send it on WhatsApp</a>.`;
      } catch(err) {
        statusEl.innerHTML = `We couldn't send that just now. Please <a href="${wa}" target="_blank" rel="noopener">send it on WhatsApp</a> instead.`;
      } finally { btn.disabled = false; }
    } else {
      openWA(wa, statusEl);
    }
  }
  $("#connectForm").addEventListener("submit", e => {
    const r = {name:$("#cName").value.trim(), phone:$("#cPhone").value.trim(), area:$("#cArea").value.trim(), request:$("#cHow").value};
    handleForm(e, "connections", r, data.PEOPLE[0].phone,
      `Connection card – Highfield Assembly\nName: ${r.name}\nPhone: ${r.phone}\nArea: ${r.area}\nRequest: ${r.request}`,
      $("#connectStatus"), "Thank you. Your details reached our welcome team and someone will be in touch.");
  });
  $("#prayerForm").addEventListener("submit", e => {
    const scope = document.querySelector('input[name="pScope"]:checked').value;
    const p = data.PEOPLE[Number($("#pTo").value)] || data.PEOPLE[0];
    const r = {name:$("#pName").value.trim(), text:$("#pText").value.trim(), scope, to:p.name};
    handleForm(e, "prayerRequests", r, p.phone,
      `Prayer request – Highfield Assembly\nFrom: ${r.name || "Anonymous"}\nVisibility: ${scope}\n\n${r.text}`,
      $("#prayerStatus"), "Thank you. Your prayer request reached the pastoral team.");
  });

  // ---------- render + CMS hook ----------
  function renderAll(){ renderWeek(); renderLeaders(); renderSermons(); renderEvents(); renderGallery(); renderDepts(); renderMinistries(); hydrate(); }
  renderContacts(); renderAll();

  window.HF = {
    hydrate,
    // Called by cms-public.js with whatever the database returned.
    applyCMS(c){
      if (c.sermons && c.sermons.length){ data.SERMONS = c.sermons.sort((a,b)=>(b.date||"").localeCompare(a.date||"")); data.examples.sermons = false; }
      if (c.events && c.events.length){ data.EVENTS = c.events; data.examples.events = false; }
      if (c.photos && c.photos.length){
        const fresh = c.photos.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
        const seen = new Set(fresh.map(p => p.src));
        data.PHOTOS = fresh.concat(D.PHOTOS.filter(p => !seen.has(p.src) && !c.replaceDefaultPhotos));
      }
      if (c.departments && c.departments.length){
        data.DEPTS = c.departments.sort((a,b)=>(a.order??999)-(b.order??999) || a.name.localeCompare(b.name));
      }
      if (c.leaders && c.leaders.length){
        const byOrder = (a,b)=>(a.order??999)-(b.order??999) || a.name.localeCompare(b.name);
        const s = c.leaders.filter(l => l.group === "senior").sort(byOrder);
        const ed = c.leaders.filter(l => l.group !== "senior").sort(byOrder);
        if (s.length) data.SENIOR = s;
        if (ed.length) data.ELDERS_DEACONS = ed;
      }
      renderAll();
    }
  };

  // ---------- routing ----------
  const PAGES = ["home","visit","about","sermons","events","ministries","gallery","give","contact"];
  function route(){
    const id = (location.hash||"#home").slice(1);
    const page = PAGES.includes(id) ? id : "home";
    document.querySelectorAll(".page").forEach(p => p.hidden = p.dataset.page !== page);
    document.querySelectorAll("nav a").forEach(a => { if(a.getAttribute("href")==="#"+page) a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current"); });
    window.scrollTo(0,0);
  }
  window.addEventListener("hashchange", route); route();
  $("#yr").textContent = new Date().getFullYear();
})();
