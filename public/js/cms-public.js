/* Loads published content from Firestore for the public site, using the plain REST API
   (no Firebase SDK download, so the site stays light on mobile data).
   Also saves prayer requests and connection cards. */
(function(){
  const f = (window.HF_CONFIG && window.HF_CONFIG.firebase) || {};
  if (!f.projectId || !f.apiKey) { window.HF_CMS = { ready: false }; return; }

  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(f.projectId)}/databases/(default)/documents`;
  const key = `key=${encodeURIComponent(f.apiKey)}`;

  function decode(v){
    if (v == null) return null;
    if ("stringValue" in v) return v.stringValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return v.doubleValue;
    if ("booleanValue" in v) return v.booleanValue;
    if ("timestampValue" in v) return v.timestampValue;
    if ("nullValue" in v) return null;
    if ("arrayValue" in v) return (v.arrayValue.values || []).map(decode);
    if ("mapValue" in v) return fields(v.mapValue.fields || {});
    return null;
  }
  function fields(obj){ const o = {}; for (const k in obj) o[k] = decode(obj[k]); return o; }
  function encode(x){
    if (x === null || x === undefined) return { nullValue: null };
    if (typeof x === "boolean") return { booleanValue: x };
    if (typeof x === "number") return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
    if (x instanceof Date) return { timestampValue: x.toISOString() };
    if (Array.isArray(x)) return { arrayValue: { values: x.map(encode) } };
    if (typeof x === "object") { const m = {}; for (const k in x) m[k] = encode(x[k]); return { mapValue: { fields: m } }; }
    return { stringValue: String(x) };
  }

  async function list(col){
    let out = [], token = "", guard = 0;
    do {
      const r = await fetch(`${base}/${col}?pageSize=300&${key}${token ? "&pageToken=" + encodeURIComponent(token) : ""}`);
      if (!r.ok) throw new Error(col + " " + r.status);
      const j = await r.json();
      (j.documents || []).forEach(d => { const o = fields(d.fields || {}); o.id = d.name.split("/").pop(); out.push(o); });
      token = j.nextPageToken || "";
    } while (token && ++guard < 10);
    return out.filter(o => !o.hidden);
  }

  async function submit(col, record){
    const clean = {};
    for (const k in record) if (record[k] !== "" && record[k] != null) clean[k] = record[k];
    clean.status = "new";
    clean.createdAt = new Date();
    const body = { fields: {} };
    for (const k in clean) body.fields[k] = encode(clean[k]);
    const r = await fetch(`${base}/${col}?${key}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error("Save failed " + r.status);
    return true;
  }

  // Photos stored in the database: "media" holds the small version, "mediaFull" the large one.
  async function getMedia(id, size){
    const r = await fetch(`${base}/${size === "full" ? "mediaFull" : "media"}/${encodeURIComponent(id)}?${key}`);
    if (!r.ok) return "";
    const j = await r.json();
    const v = j.fields && j.fields.data && j.fields.data.stringValue;
    return v && /^data:image\/(jpeg|png|webp);base64,/.test(v) ? v : "";
  }

  window.HF_CMS = { ready: true, submit, getMedia };

  // Forms now save straight to the pastoral team's inbox.
  document.querySelectorAll("#connectForm button[type=submit], #prayerForm button[type=submit]").forEach(b => { b.textContent = "Send"; b.classList.remove("btn-wa"); b.classList.add("btn-flame"); });
  const ch = document.getElementById("connectHint"); if (ch) ch.textContent = "Fill this in and our welcome team will get in touch.";
  const ph = document.getElementById("prayerHint"); if (ph) ph.textContent = "Private requests are seen only by the pastoral team.";
  const pt = document.getElementById("pTo"); if (pt && pt.closest("label")) pt.closest("label").hidden = true;

  Promise.allSettled(["sermons", "events", "photos", "leaders", "departments"].map(list)).then(res => {
    const pick = i => res[i].status === "fulfilled" ? res[i].value : null;
    if (window.HF) window.HF.applyCMS({ sermons: pick(0), events: pick(1), photos: pick(2), leaders: pick(3), departments: pick(4) });
    else if (window.HF && window.HF.hydrate) window.HF.hydrate();
  });
})();
