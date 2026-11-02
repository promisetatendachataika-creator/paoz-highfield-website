/* Highfield Assembly website admin.
   Login: Google accounts listed in the Firestore "admins" collection (document id = email, field roles = [...]).
   Roles: super (webmaster, everything), media (sermons + gallery), events, pastoral (prayer requests + connection cards). */

const CONFIG = window.HF_CONFIG || {};
const DEFAULTS = window.HF_DEFAULTS || {};
const SDK = "https://www.gstatic.com/firebasejs/10.12.2";

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const isMedia = v => typeof v === "string" && /^media:[A-Za-z0-9_-]+$/.test(v);
const thumb = src => !src ? "" : isMedia(src) ? `${BLANK}#am=${src.slice(6)}` : src;
const mediaCache = new Map();
async function hydrateAdmin(root){
  for (const el of (root || document).querySelectorAll('img[src*="#am="]')) {
    const id = el.getAttribute("src").split("#am=")[1];
    try {
      if (!mediaCache.has(id)) mediaCache.set(id, api.getMedia("media", id));
      const url = await mediaCache.get(id); if (url) el.src = url;
    } catch (_) { mediaCache.delete(id); }
  }
}
const fmtWhen = v => { if (!v) return ""; const d = new Date(v); return isNaN(d) ? String(v) : d.toLocaleString("en-GB", {day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"}); };
const today = () => new Date().toISOString().slice(0, 10);

function toast(msg){ const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, 2600); }

/* ---------------- backend (Firebase, or a test double) ---------------- */
async function firebaseApi(){
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-firestore.js`)
  ]);
  const app = initializeApp(CONFIG.firebase);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  const norm = snap => { const o = snap.data(); for (const k in o) if (o[k] && typeof o[k].toDate === "function") o[k] = o[k].toDate().toISOString(); o.id = snap.id; return o; };
  return {
    onAuth: cb => A.onAuthStateChanged(auth, cb),
    signIn: () => A.signInWithPopup(auth, new A.GoogleAuthProvider()),
    signOut: () => A.signOut(auth),
    async getAdmin(email){ const s = await F.getDoc(F.doc(db, "admins", email.toLowerCase())); return s.exists() ? s.data() : null; },
    async list(col){ const s = await F.getDocs(F.collection(db, col)); return s.docs.map(norm); },
    async add(col, data){ const r = await F.addDoc(F.collection(db, col), { ...data, createdAt: F.serverTimestamp() }); return r.id; },
    async set(col, id, data){ await F.setDoc(F.doc(db, col, id), data); },
    async update(col, id, data){ await F.updateDoc(F.doc(db, col, id), { ...data, updatedAt: F.serverTimestamp() }); },
    async remove(col, id){ await F.deleteDoc(F.doc(db, col, id)); },
    async getMedia(col, id){ const s = await F.getDoc(F.doc(db, col, id)); return s.exists() ? s.data().data : ""; }
  };
}

/* ---------------- photo storage (in the Firestore database) ----------------
   Each upload becomes two documents with the same id:
     media/{id}      small version (cards, thumbnails)   about 30-60 KB
     mediaFull/{id}  large version (opened photo)        up to about 650 KB
   Fields store the reference "media:{id}". */
async function encode(file, max, quality, limit){
  const bmp = await createImageBitmap(file);
  let size = max, q = quality;
  for (let i = 0; i < 8; i++) {
    const s = Math.min(1, size / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(bmp.width * s)); c.height = Math.max(1, Math.round(bmp.height * s));
    const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/jpeg", q);
    if (url.length <= limit) return url;
    if (q > 0.6) q -= 0.08; else size = Math.round(size * 0.85);
  }
  throw new Error("This photo is too large to store. Try a smaller copy.");
}
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(15)), b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
async function upload(file){
  if (!/^image\/(jpeg|png|webp|gif|heic|heif)$/i.test(file.type) && !/\.(jpe?g|png|webp|heic)$/i.test(file.name)) throw new Error("Please choose a photo (JPG, PNG or WebP).");
  let full, small;
  try {
    full = await encode(file, 1600, 0.82, 880000);
    small = await encode(file, 520, 0.78, 90000);
  } catch (e) { throw new Error(e.message && e.message.includes("too large") ? e.message : "Couldn't read this photo. Try saving it as a JPG first."); }
  const id = newId();
  await api.set("mediaFull", id, { data: full, createdAt: new Date() });
  await api.set("media", id, { data: small, createdAt: new Date() });
  mediaCache.set(id, Promise.resolve(small));
  return "media:" + id;
}
async function removeMedia(ref){
  if (!isMedia(ref)) return;
  const id = ref.slice(6);
  try { await api.remove("media", id); await api.remove("mediaFull", id); } catch (_) {}
}

/* ---------------- what each section edits ---------------- */
const CATS = ["Services", "Youth", "Fellowship", "Ministries", "Leadership", "History", "Events"];
const SECTIONS = {
  sermons: {
    title: "Sermons", role: "media", group: "Content", noun: "sermon",
    intro: "Add each Sunday's message. Newest appear first on the Sermons page.",
    fields: [
      { k: "title", label: "Sermon title", req: true, full: true },
      { k: "speaker", label: "Preacher", req: true },
      { k: "date", label: "Date preached", type: "date", req: true, def: today },
      { k: "series", label: "Series", hint: "Optional, e.g. Faith" },
      { k: "scripture", label: "Scripture", hint: "e.g. John 3:16-21" },
      { k: "videoUrl", label: "Video link", type: "url", hint: "Facebook or YouTube link to the live stream or video", full: true },
      { k: "audioUrl", label: "Audio link", type: "url", hint: "Optional. Upload the recording to Google Drive, set sharing to “Anyone with the link”, and paste the link here", full: true },
      { k: "notesUrl", label: "Sermon notes link", type: "url", hint: "Optional. A Google Drive link to the PDF notes, shared with “Anyone with the link”", full: true },
      { k: "cover", label: "Cover picture", type: "image", full: true },
      { k: "hidden", label: "Hide from the website", type: "check" }
    ],
    sort: (a, b) => (b.date || "").localeCompare(a.date || ""),
    item: d => ({ img: d.cover, t: d.title, s: [d.date, d.speaker, d.scripture].filter(Boolean).join(" · "), badge: d.hidden ? "Hidden" : "" }),
    search: d => [d.title, d.speaker, d.series, d.scripture].join(" ")
  },
  events: {
    title: "Events", role: "events", group: "Content", noun: "event",
    intro: "Events disappear from the website automatically the day after they end.",
    fields: [
      { k: "name", label: "Event name", req: true, full: true },
      { k: "date", label: "Start date", type: "date", req: true, def: today },
      { k: "time", label: "Start time", type: "time" },
      { k: "endDate", label: "End date", type: "date", hint: "Only for events longer than a day" },
      { k: "endTime", label: "End time", type: "time" },
      { k: "venue", label: "Venue", def: () => "PAOZ Highfield Assembly", full: true },
      { k: "summary", label: "Short description", type: "textarea", full: true },
      { k: "flyer", label: "Flyer", type: "image", full: true },
      { k: "regUrl", label: "Registration link", type: "url", hint: "Optional, e.g. a Google Form", full: true },
      { k: "featured", label: "Feature at the top", type: "check" },
      { k: "hidden", label: "Hide from the website", type: "check" }
    ],
    sort: (a, b) => (a.date || "").localeCompare(b.date || ""),
    item: d => {
      const past = new Date((d.endDate || d.date) + "T23:59:59") < new Date();
      return { img: d.flyer, t: d.name, s: [d.date, d.time, d.venue].filter(Boolean).join(" · "), badge: d.hidden ? "Hidden" : past ? "Past" : d.featured ? "Featured" : "" };
    },
    search: d => [d.name, d.venue, d.summary].join(" ")
  },
  photos: {
    title: "Gallery", role: "media", group: "Content", noun: "photo", bulk: true,
    intro: "Upload photos to the Gallery. They are resized automatically so the site stays fast on mobile data.",
    fields: [
      { k: "src", label: "Photo", type: "image", req: true, full: true },
      { k: "cap", label: "Caption", req: true, full: true },
      { k: "category", label: "Category", type: "select", options: CATS, def: () => "Services" },
      { k: "wide", label: "Show wide in the gallery", type: "check" },
      { k: "hidden", label: "Hide from the website", type: "check" }
    ],
    sort: (a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""),
    item: d => ({ img: d.src, t: d.cap, s: d.category || "", badge: d.hidden ? "Hidden" : "" }),
    search: d => [d.cap, d.category].join(" ")
  },
  leaders: {
    title: "Leaders", role: "super", group: "Content", noun: "leader",
    intro: "Senior Leadership shows as large photo cards; Elders and Deacons as round photos. Lower order numbers appear first.",
    fields: [
      { k: "name", label: "Name as shown", req: true, full: true, hint: "e.g. Elder Mrs Madya" },
      { k: "role", label: "Title / role", req: true, hint: "e.g. Elder · Church Secretary" },
      { k: "group", label: "Section", type: "select", options: [["senior", "Senior Leadership"], ["ed", "Elders and Deacons"]], def: () => "ed" },
      { k: "order", label: "Order", type: "number", def: () => 50 },
      { k: "photo", label: "Photo", type: "image", hint: "A clear head-and-shoulders photo works best", full: true }
    ],
    sort: (a, b) => (a.group === b.group ? 0 : a.group === "senior" ? -1 : 1) || (a.order ?? 999) - (b.order ?? 999),
    item: d => ({ img: d.photo, initial: (d.name || "?").split(" ").pop()[0], t: d.name, s: `${d.role || ""} · ${d.group === "senior" ? "Senior Leadership" : "Elders and Deacons"}` }),
    search: d => [d.name, d.role].join(" ")
  },
  departments: {
    title: "Serving departments", role: "media", group: "Content", noun: "department",
    intro: "The serving teams shown on the home and Ministries pages. Add a photo of each team; without one, an icon shows instead.",
    fields: [
      { k: "name", label: "Department name", req: true, hint: "e.g. Praise & Worship" },
      { k: "sub", label: "Subtitle", hint: "e.g. Worship Team" },
      { k: "photo", label: "Team photo", type: "image", full: true },
      { k: "icon", label: "Icon (shown when there's no photo)", type: "select", options: [["usher","Person (Ushering)"],["media","Camera (Media)"],["music","Music (Praise & Worship)"],["mic","Microphone (MCs)"],["cup","Cup (Hospitality)"],["shield","Shield (Protocol)"]], def: () => "usher" },
      { k: "order", label: "Order", type: "number", def: () => 50, hint: "Lower numbers appear first" }
    ],
    sort: (a, b) => (a.order ?? 999) - (b.order ?? 999),
    item: d => ({ img: d.photo, initial: (d.name || "?")[0], t: d.name, s: d.sub || "" }),
    search: d => [d.name, d.sub].join(" ")
  },
  prayerRequests: {
    title: "Prayer requests", role: "pastoral", group: "Inbox", inbox: true, noun: "prayer request",
    intro: "Requests sent from the Contact page. Private ones must stay within the pastoral team.",
    sort: (a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""),
    item: d => ({ t: d.name || "Anonymous", s: fmtWhen(d.createdAt), text: d.text, badge: d.status === "new" ? "New" : "Prayed", priv: d.scope === "Private" ? "Private" : "Can be shared" }),
    doneLabel: "Mark as prayed", doneStatus: "prayed",
    search: d => [d.name, d.text].join(" ")
  },
  connections: {
    title: "Connection cards", role: "pastoral", group: "Inbox", inbox: true, noun: "connection card",
    intro: "First-time visitors and people who want to join. Follow up within the week.",
    sort: (a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""),
    item: d => ({ t: d.name || "No name", s: [fmtWhen(d.createdAt), d.phone, d.area].filter(Boolean).join(" · "), text: d.request, badge: d.status === "new" ? "New" : "Followed up" }),
    doneLabel: "Mark as followed up", doneStatus: "done",
    search: d => [d.name, d.phone, d.area, d.request].join(" ")
  }
};
const ROLE_LABELS = { super: "Webmaster (everything)", media: "Media (sermons and gallery)", events: "Events", pastoral: "Pastoral care (prayer requests and connection cards)" };

/* ---------------- state ---------------- */
let api, me = null, roles = [], current = null, cache = {}, editing = null, query = "";
const can = r => roles.includes("super") || roles.includes(r);

/* ---------------- gate screens ---------------- */
function gate(html){ $("#app").hidden = true; $("#gate").hidden = false; $("#gateBox").innerHTML = `<img src="images/paoz-logo.png" alt="PAOZ logo">${html}`; }
function showSignIn(){
  $("#signOut").hidden = true; $("#who").textContent = "";
  gate(`<h1>Admin sign in</h1><p class="muted">Sign in with the Google account the webmaster added to the admin list.</p>
    <button class="btn" id="signInBtn" type="button">Sign in with Google</button><p class="note" id="signErr"></p>`);
  $("#signInBtn").onclick = async () => {
    try { await api.signIn(); } catch (e) { $("#signErr").textContent = e.code === "auth/popup-blocked" ? "Your browser blocked the sign-in window. Allow pop-ups for this site and try again." : "Sign-in didn't finish. Please try again."; }
  };
}

/* ---------------- app shell ---------------- */
function sectionIds(){ return [...Object.keys(SECTIONS).filter(id => can(SECTIONS[id].role)), ...(roles.includes("super") ? ["admins", "setup"] : [])]; }
function buildSide(){
  const ids = sectionIds(); let html = "", last = "";
  ids.forEach(id => {
    const g = SECTIONS[id] ? SECTIONS[id].group : "Settings";
    if (g !== last) { html += `<div class="grp">${g}</div>`; last = g; }
    const title = SECTIONS[id] ? SECTIONS[id].title : id === "admins" ? "Admins" : "Setup & import";
    const n = SECTIONS[id] && SECTIONS[id].inbox && cache[id] ? cache[id].filter(d => d.status === "new").length : 0;
    html += `<button type="button" data-sec="${id}" ${id === current ? 'aria-current="page"' : ""}><span>${title}</span>${n ? `<span class="count">${n}</span>` : ""}</button>`;
  });
  $("#side").innerHTML = html;
}
$("#side").addEventListener("click", e => { const b = e.target.closest("[data-sec]"); if (b) open(b.dataset.sec); });

async function load(id, force){ if (!cache[id] || force) cache[id] = await api.list(id); return cache[id]; }

async function open(id){
  current = id; editing = null; query = ""; buildSide();
  const main = $("#main");
  main.innerHTML = `<p class="muted">Loading…</p>`;
  try {
    if (id === "admins") return await renderAdmins();
    if (id === "setup") return await renderSetup();
    await load(id, true); renderSection();
  } catch (e) {
    main.innerHTML = `<div class="alert">Couldn't load this section. ${esc(e.message || "")} Check that your account has the right role.</div>`;
  }
  buildSide();
}

/* ---------------- generic list + form ---------------- */
function renderSection(){
  const S = SECTIONS[current], docs = (cache[current] || []).slice().sort(S.sort);
  const q = query.toLowerCase();
  const shown = q ? docs.filter(d => S.search(d).toLowerCase().includes(q)) : docs;
  $("#main").innerHTML = `
    <div class="head"><div><h1>${S.title}</h1><p class="muted">${S.intro}</p></div>
      ${S.inbox ? "" : `<button class="btn" type="button" id="addBtn">Add ${S.noun}</button>`}</div>
    <div id="formSlot"></div>
    ${S.bulk ? `<div class="drop" id="drop"><strong>Upload several photos at once</strong><p class="note">Drag photos here or choose them. Each gets a caption from its file name, which you can edit after.</p>
      <div class="filters" style="justify-content:center"><select id="bulkCat" aria-label="Category for these photos">${CATS.map(c => `<option>${c}</option>`).join("")}</select>
      <label class="btn light" for="bulkFiles">Choose photos</label><input id="bulkFiles" type="file" accept="image/*" multiple hidden></div><div class="progress" id="bulkProg"></div></div><div style="height:16px"></div>` : ""}
    ${docs.length > 6 ? `<div class="filters"><input type="text" id="q" placeholder="Search ${S.title.toLowerCase()}" value="${esc(query)}" aria-label="Search"></div>` : ""}
    <div class="list">${shown.length ? shown.map(d => rowHTML(S, d)).join("") : `<div class="empty">${docs.length ? "Nothing matches that search." : S.inbox ? "Nothing here yet. New submissions from the website will appear here." : `No ${S.title.toLowerCase()} yet. Use “Add ${S.noun}” to create the first one.`}</div>`}</div>`;
  if (!S.inbox) $("#addBtn").onclick = () => showForm(null);
  hydrateAdmin($("#main"));
  const qi = $("#q"); if (qi) qi.oninput = e => { query = e.target.value; const pos = e.target.selectionStart; renderSection(); const n = $("#q"); n.focus(); n.setSelectionRange(pos, pos); };
  if (S.bulk) wireBulk();
}
function rowHTML(S, d){
  const it = S.item(d), hasImg = !S.inbox;
  return `<div class="row${hasImg ? "" : " noimg"}">
    ${hasImg ? `<div class="th">${it.img ? `<img src="${esc(thumb(it.img))}" alt="" loading="lazy">` : esc(it.initial || "·")}</div>` : ""}
    <div><h3>${esc(it.t)}${it.badge ? `<span class="badge${it.badge === "New" ? " new" : ""}">${esc(it.badge)}</span>` : ""}${it.priv ? `<span class="badge${it.priv === "Private" ? " priv" : ""}">${esc(it.priv)}</span>` : ""}</h3>
      <div class="sub">${esc(it.s)}</div>${it.text ? `<div class="txt">${esc(it.text)}</div>` : ""}</div>
    <div class="acts">
      ${S.inbox ? (d.status === "new" ? `<button class="btn light sm" type="button" data-done="${d.id}">${S.doneLabel}</button>` : "") : `<button class="btn light sm" type="button" data-edit="${d.id}">Edit</button>`}
      <button class="btn danger sm" type="button" data-del="${d.id}">Delete</button>
    </div></div>`;
}
$("#main").addEventListener("click", async e => {
  const ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]"), done = e.target.closest("[data-done]");
  if (ed) return showForm(cache[current].find(d => d.id === ed.dataset.edit));
  if (del) {
    const S = SECTIONS[current]; if (!S) return;
    if (!confirm(`Delete this ${S.noun}? This can't be undone.`)) return;
    del.disabled = true;
    try {
      const d = cache[current].find(x => x.id === del.dataset.del);
      await api.remove(current, del.dataset.del);
      if (d && S.fields) for (const f of S.fields) if (f.type === "image") await removeMedia(d[f.k]);
      cache[current] = cache[current].filter(x => x.id !== del.dataset.del); toast("Deleted"); renderSection(); buildSide();
    }
    catch (err) { del.disabled = false; toast("Couldn't delete. " + (err.message || "")); }
  }
  if (done) {
    const S = SECTIONS[current]; done.disabled = true;
    try { await api.update(current, done.dataset.done, { status: S.doneStatus }); const d = cache[current].find(x => x.id === done.dataset.done); d.status = S.doneStatus; toast("Updated"); renderSection(); buildSide(); }
    catch (err) { done.disabled = false; toast("Couldn't update. " + (err.message || "")); }
  }
});

function fieldHTML(f, v){
  const id = `f_${f.k}`, full = f.full ? " full" : "";
  const hint = f.hint ? `<span class="hint">${esc(f.hint)}</span>` : "";
  const req = f.req ? " required" : "";
  if (f.type === "check") return `<label class="check${full}"><input type="checkbox" id="${id}" ${v ? "checked" : ""}> ${esc(f.label)}</label>`;
  if (f.type === "textarea") return `<label class="f${full}" for="${id}">${esc(f.label)}${hint}<textarea id="${id}"${req}>${esc(v || "")}</textarea></label>`;
  if (f.type === "select") return `<label class="f${full}" for="${id}">${esc(f.label)}${hint}<select id="${id}">${f.options.map(o => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${val === v ? "selected" : ""}>${esc(lab)}</option>`; }).join("")}</select></label>`;
  if (f.type === "image" || f.type === "file") {
    const isImg = f.type === "image";
    return `<div class="f${full}"><label class="f" for="${id}">${esc(f.label)}${hint}</label>
      <div class="imgf"><div class="pv" id="${id}_pv">${v ? (isImg ? `<img src="${esc(thumb(v, 300))}" alt="">` : `<a href="${esc(v)}" target="_blank" rel="noopener">Current file</a>`) : (isImg ? "No photo" : "No file")}</div>
      <input type="file" id="${id}" accept="${f.accept || "image/*"}" ${f.req && !v ? "required" : ""}>
      ${v && !f.req ? `<label class="check"><input type="checkbox" id="${id}_clear"> Remove</label>` : ""}</div></div>`;
  }
  return `<label class="f${full}" for="${id}">${esc(f.label)}${hint}<input type="${f.type || "text"}" id="${id}" value="${esc(v ?? "")}"${req}></label>`;
}
function showForm(doc){
  const S = SECTIONS[current]; editing = doc ? doc.id : "new";
  const vals = doc || Object.fromEntries(S.fields.map(f => [f.k, f.def ? f.def() : f.type === "check" ? false : ""]));
  $("#formSlot").innerHTML = `<form class="card form" id="editForm" novalidate>
      <h2>${doc ? "Edit" : "Add"} ${S.noun}</h2>
      <div class="fgrid">${S.fields.map(f => fieldHTML(f, vals[f.k])).join("")}</div>
      <div class="alert" id="formErr" hidden></div>
      <div class="acts"><button class="btn" type="submit" id="saveBtn">${doc ? "Save changes" : `Add ${S.noun}`}</button><button class="btn light" type="button" id="cancelBtn">Cancel</button></div>
    </form>`;
  S.fields.filter(f => f.type === "image").forEach(f => {
    $(`#f_${f.k}`).onchange = e => { const file = e.target.files[0]; if (file) $(`#f_${f.k}_pv`).innerHTML = `<img src="${URL.createObjectURL(file)}" alt="">`; };
  });
  hydrateAdmin($("#formSlot"));
  $("#cancelBtn").onclick = () => { editing = null; $("#formSlot").innerHTML = ""; };
  $("#editForm").onsubmit = e => { e.preventDefault(); save(doc); };
  $("#editForm").scrollIntoView({ behavior: "smooth", block: "start" });
  const first = $("#editForm input:not([type=checkbox]):not([type=file]), #editForm textarea"); if (first) first.focus({ preventScroll: true });
}
async function save(doc){
  const S = SECTIONS[current], err = $("#formErr"), btn = $("#saveBtn");
  err.hidden = true;
  const out = {};
  const missing = [];
  for (const f of S.fields) {
    const el = $(`#f_${f.k}`);
    if (f.type === "check") { out[f.k] = el.checked; continue; }
    if (f.type === "image" || f.type === "file") {
      const clear = $(`#f_${f.k}_clear`);
      if (el.files[0]) out[f.k] = el.files[0];
      else if (clear && clear.checked) out[f.k] = "";
      else out[f.k] = doc ? (doc[f.k] || "") : "";
    } else if (f.type === "number") out[f.k] = el.value === "" ? null : Number(el.value);
    else out[f.k] = el.value.trim();
    if (f.req && (out[f.k] === "" || out[f.k] == null)) missing.push(f.label);
    if (f.type === "url" && out[f.k] && !/^https?:\/\//i.test(out[f.k])) { err.textContent = `${f.label} must start with https://`; err.hidden = false; return; }
  }
  if (missing.length) { err.textContent = `Please fill in: ${missing.join(", ")}.`; err.hidden = false; return; }
  btn.disabled = true; btn.textContent = "Saving…";
  try {
    for (const f of S.fields) if (out[f.k] instanceof File) { btn.textContent = `Uploading ${f.label.toLowerCase()}…`; out[f.k] = await upload(out[f.k]); }
    btn.textContent = "Saving…";
    if (doc) {
      const old = S.fields.filter(f => f.type === "image" && doc[f.k] && doc[f.k] !== out[f.k]).map(f => doc[f.k]);
      await api.update(current, doc.id, out); Object.assign(doc, out);
      for (const ref of old) await removeMedia(ref);
    }
    else { const id = await api.add(current, out); cache[current].push({ ...out, id, createdAt: new Date().toISOString() }); }
    toast(doc ? "Saved" : `${S.noun[0].toUpperCase() + S.noun.slice(1)} added`);
    editing = null; renderSection();
  } catch (e) {
    btn.disabled = false; btn.textContent = doc ? "Save changes" : `Add ${S.noun}`;
    err.textContent = `Couldn't save. ${e.message || ""}`; err.hidden = false;
  }
}

function wireBulk(){
  const drop = $("#drop"), input = $("#bulkFiles"), prog = $("#bulkProg");
  const go = async files => {
    files = [...files].filter(f => f.type.startsWith("image/")); if (!files.length) return;
    const cat = $("#bulkCat").value; let n = 0;
    for (const file of files) {
      prog.textContent = `Uploading ${++n} of ${files.length}…`;
      try {
        const src = await upload(file);
        const rec = { src, cap: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Highfield Assembly", category: cat, wide: false, hidden: false };
        const id = await api.add("photos", rec); cache.photos.push({ ...rec, id, createdAt: new Date().toISOString() });
      } catch (e) { toast(`Couldn't upload ${file.name}. ${e.message || ""}`); }
    }
    toast(`${n} photo${n === 1 ? "" : "s"} uploaded`); renderSection();
  };
  input.onchange = e => go(e.target.files);
  ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", e => go(e.dataTransfer.files));
}

/* ---------------- admins ---------------- */
async function renderAdmins(){
  const list = await load("admins", true);
  $("#main").innerHTML = `<div class="head"><div><h1>Admins</h1><p class="muted">Who can sign in, and what each person can change. They sign in with this Google account.</p></div></div>
    <form class="card form" id="adminForm">
      <h2>Add or update an admin</h2>
      <label class="f" for="aEmail">Google account email<input type="email" id="aEmail" required placeholder="name@gmail.com"></label>
      <div class="roles">${Object.entries(ROLE_LABELS).map(([k, l]) => `<label class="check"><input type="checkbox" value="${k}" class="aRole"> ${esc(l)}</label>`).join("")}</div>
      <div class="alert" id="aErr" hidden></div>
      <div class="acts"><button class="btn" type="submit">Save admin</button></div>
    </form>
    <div class="list">${list.map(a => `<div class="row noimg"><div><h3>${esc(a.id)}${a.id === me.email.toLowerCase() ? '<span class="badge">You</span>' : ""}</h3><div class="sub">${(a.roles || []).map(r => esc(ROLE_LABELS[r] || r)).join(", ") || "No roles"}</div></div>
      <div class="acts"><button class="btn light sm" type="button" data-aedit="${esc(a.id)}">Edit</button>${a.id === me.email.toLowerCase() ? "" : `<button class="btn danger sm" type="button" data-adel="${esc(a.id)}">Remove</button>`}</div></div>`).join("")}</div>`;
  $("#adminForm").onsubmit = async e => {
    e.preventDefault();
    const email = $("#aEmail").value.trim().toLowerCase(), rs = [...document.querySelectorAll(".aRole:checked")].map(x => x.value), err = $("#aErr");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = "Enter a valid email address."; err.hidden = false; return; }
    if (!rs.length) { err.textContent = "Pick at least one role."; err.hidden = false; return; }
    try { await api.set("admins", email, { roles: rs }); toast("Admin saved"); renderAdmins(); }
    catch (x) { err.textContent = "Couldn't save. " + (x.message || ""); err.hidden = false; }
  };
  $("#main").onclick = null;
  document.querySelectorAll("[data-aedit]").forEach(b => b.onclick = () => {
    const a = list.find(x => x.id === b.dataset.aedit); $("#aEmail").value = a.id;
    document.querySelectorAll(".aRole").forEach(c => c.checked = (a.roles || []).includes(c.value));
    $("#adminForm").scrollIntoView({ behavior: "smooth" });
  });
  document.querySelectorAll("[data-adel]").forEach(b => b.onclick = async () => {
    if (!confirm(`Remove ${b.dataset.adel} from the admin list?`)) return;
    try { await api.remove("admins", b.dataset.adel); toast("Removed"); renderAdmins(); } catch (x) { toast("Couldn't remove. " + (x.message || "")); }
  });
}

/* ---------------- setup & import ---------------- */
async function renderSetup(){
  const [leaders, photos, depts] = await Promise.all([load("leaders", true), load("photos", true), load("departments", true)]);
  $("#main").innerHTML = `<div class="head"><div><h1>Setup &amp; import</h1><p class="muted">One-time steps for the webmaster.</p></div></div>
    <div class="list">
      <div class="card"><h2 style="font-size:18px">Photo uploads</h2>
        <p class="muted">Photos are stored in the church's Firebase database, resized automatically. For sermon notes and recordings, upload them to Google Drive, share them with “Anyone with the link”, and paste the link into the sermon.</p></div>
      <div class="card"><h2 style="font-size:18px">Import the current website content</h2>
        <p class="muted">Copies the leaders (${(DEFAULTS.SENIOR || []).length + (DEFAULTS.ELDERS_DEACONS || []).length}), gallery photos (${(DEFAULTS.PHOTOS || []).length}) and serving departments (${(DEFAULTS.DEPTS || []).length}) that are built into the site into the database, so you can edit them here. Do this once.</p>
        <p class="note">In the database now: ${leaders.length} leaders, ${photos.length} photos, ${depts.length} serving departments.</p>
        <div class="acts" style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" type="button" id="seedLeaders" ${leaders.length ? "disabled" : ""}>Import leaders</button>
          <button class="btn" type="button" id="seedPhotos" ${photos.length ? "disabled" : ""}>Import gallery photos</button>
          <button class="btn" type="button" id="seedDepts" ${depts.length ? "disabled" : ""}>Import serving departments</button>
        </div>
        <p class="progress" id="seedProg"></p>
        ${leaders.length || photos.length ? `<p class="note">Import is only available while that section is empty, so nothing gets duplicated.</p>` : ""}
      </div>
    </div>`;
  const prog = $("#seedProg");
  $("#seedLeaders").onclick = async e => {
    e.target.disabled = true; let n = 0;
    const all = [...(DEFAULTS.SENIOR || []).map((l, i) => ({ ...l, group: "senior", order: (i + 1) * 10 })), ...(DEFAULTS.ELDERS_DEACONS || []).map((l, i) => ({ ...l, group: "ed", order: (i + 1) * 10 }))];
    for (const l of all) { await api.add("leaders", { name: l.name, role: l.role, group: l.group, order: l.order, photo: l.photo || "" }); prog.textContent = `Imported ${++n} of ${all.length} leaders…`; }
    toast("Leaders imported"); renderSetup();
  };
  $("#seedDepts").onclick = async e => {
    e.target.disabled = true; let n = 0; const all = DEFAULTS.DEPTS || [];
    for (const [i, d] of all.entries()) { await api.add("departments", { name: d.name, sub: d.sub || "", icon: d.icon || "usher", photo: d.photo || "", order: (i + 1) * 10 }); prog.textContent = `Imported ${++n} of ${all.length} departments…`; }
    toast("Departments imported"); renderSetup();
  };
  $("#seedPhotos").onclick = async e => {
    e.target.disabled = true; let n = 0; const all = (DEFAULTS.PHOTOS || []).slice().reverse();
    for (const p of all) { await api.add("photos", { src: p.src, cap: p.cap, category: p.category || "Services", wide: !!p.wide, hidden: false }); prog.textContent = `Imported ${++n} of ${all.length} photos…`; }
    toast("Photos imported"); renderSetup();
  };
}

/* ---------------- start ---------------- */
(async function start(){
  const f = CONFIG.firebase || {};
  if (!window.HF_ADMIN_MOCK && (!f.apiKey || !f.projectId)) {
    return gate(`<h1>Almost ready</h1><p class="muted">The admin needs the church's Firebase project details. Fill in <code>js/cms-config.js</code> as described in <code>SETUP.md</code>, then reload this page.</p>`);
  }
  try { api = window.HF_ADMIN_MOCK ? window.HF_ADMIN_MOCK.api : await firebaseApi(); }
  catch (e) { return gate(`<h1>Couldn't connect</h1><p class="muted">Check your internet connection and the settings in <code>js/cms-config.js</code>, then reload.</p>`); }
  $("#signOut").onclick = () => api.signOut();
  api.onAuth(async user => {
    if (!user) { me = null; return showSignIn(); }
    me = user; $("#who").textContent = user.email; $("#signOut").hidden = false;
    let a = null;
    try { a = await api.getAdmin(user.email); } catch (_) {}
    roles = (a && a.roles) || [];
    if (!roles.length) return gate(`<h1>No access yet</h1><p class="muted">${esc(user.email)} isn't on the admin list. Ask the webmaster to add this email in Admins, then sign in again.</p><button class="btn light" type="button" onclick="document.getElementById('signOut').click()">Use a different account</button>`);
    $("#gate").hidden = true; $("#app").hidden = false;
    if (can("pastoral")) { try { await Promise.all([load("prayerRequests"), load("connections")]); } catch (_) {} }
    open(sectionIds()[0]);
  });
})();
