/* Hüsli – Kern: Hilfen, Zustand, Schnittstelle, Rahmen, Formulare. Eigene Entwicklung. */
"use strict";
const S = { ich: null, personen: [], haushalte: [], module: [], alleModule: [], E: new Map(), hinweise: 0, geladen: 0 };
const V = {}; // Ansichten: V[name] = function(args) → Element

/* ---------- DOM-Hilfen ---------- */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style") for (const [a, b] of Object.entries(v)) el.style.setProperty(a, b);
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "value") el.value = v;
    else if (k === "checked") el.checked = !!v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  anhaengen(el, kids);
  return el;
}
function anhaengen(el, kids) {
  for (const k of kids.flat(9)) {
    if (k === null || k === undefined || k === false || k === "") continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}
const SVGNS = "http://www.w3.org/2000/svg";
// Eigene, einfache Linien-Piktogramme (24×24)
const ICONS = {
  haus: "M3 11.5 12 4l9 7.5M5.5 10v9.5h5v-6h3v6h5V10",
  aufgaben: "M9 6h11M9 12h11M9 18h11M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M3.5 18l1.5 1.5 2.5-2.5",
  projekte: "M4 5h6l2 2.5h8V19H4zM4 10h16",
  einkauf: "M4 5h2l2 10h10l2-7H7.2M9.5 19.5a1 1 0 1 0 0 .1M17 19.5a1 1 0 1 0 0 .1",
  ausgaben: "M3 7h18v12H3zM3 11h18M7 15.5h3M16 4l-9 3",
  notizen: "M6 3.5h9l4 4V20.5H6zM15 3.5v4h4M9 12h7M9 15.5h7",
  rezepte: "M5 11h14a7 7 0 0 1-14 0zM8 8c0-1.5 1-2 1-3.5M12 8c0-1.5 1-2 1-3.5M16 8c0-1.5 1-2 1-3.5",
  kontakte: "M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5",
  geburtstage: "M4 20h16v-7H4zM4 16c2 1.5 4 1.5 5.3 0 1.4 1.5 4 1.5 5.4 0 1.3 1.5 3.3 1.5 5.3 0M12 13V9M12 6.5c-.8-.8-.8-1.8 0-3 .8 1.2.8 2.2 0 3z",
  kalender: "M4 6h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4",
  vorrat: "M4 8l8-4 8 4v9l-8 4-8-4zM4 8l8 4 8-4M12 12v9",
  fahrzeuge: "M5 16.5h14v-4l-2-5H7l-2 5zM5 12.5h14M7.5 19.5v-3M16.5 19.5v-3M8 14.5h.01M16 14.5h.01",
  haustiere: "M8 9.5a1.8 2.3 0 1 0 0-.1M16 9.5a1.8 2.3 0 1 0 0-.1M5 13a1.6 2 0 1 0 0-.1M19 13a1.6 2 0 1 0 0-.1M8.5 18.5c0-2.5 1.6-4.5 3.5-4.5s3.5 2 3.5 4.5c0 1.5-1.8 1.5-3.5 1.5s-3.5 0-3.5-1.5z",
  mitglieder: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8M16 11a2.5 2.5 0 1 0 0-5M17 14.3c2 .4 3.3 2 3.7 4.7",
  module: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  hinweise: "M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0",
  einstellungen: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2.3.3-1.4-1.4L16.6 4l-3-1-1 2h-1.2l-1-2-3 1 .3 2.3-1.4 1.4L4 7.4 3 10.4l2 1.2v.8l-2 1.2 1 3 2.3-.3 1.4 1.4-.3 2.3 3 1 1-2h1.2l1 2 3-1-.3-2.3 1.4-1.4 2.3.3 1-3-2-1.2z",
  papierkorb: "M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5",
  suche: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20",
  mehr: "M5 12h.01M12 12h.01M19 12h.01",
  plus: "M12 5v14M5 12h14",
  haken: "M5 12.5l4.5 4.5L19 7.5",
  zurueck: "M15 5l-7 7 7 7",
  stift: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  stern: "M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4-4.9-2.8-4.9 2.8 1.1-5.4-4-3.7 5.4-.6z",
  nadel: "M9 4h6l-1 5 3 3H7l3-3zM12 12v8",
  teilen: "M8 12a2.5 2.5 0 1 1 0-.1M18 6a2.5 2.5 0 1 1 0-.1M18 18a2.5 2.5 0 1 1 0-.1M10.2 11l5.6-3.6M10.2 13l5.6 3.6",
  drucken: "M7 9V4h10v5M7 17H4v-7h16v7h-3M7 14h10v6H7z",
  abmelden: "M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10",
  telefon: "M5 4h4l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  mail: "M3.5 6h17v12h-17zM3.5 6.5 12 13l8.5-6.5",
  ort: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  x: "M6 6l12 12M18 6 6 18",
  links: "M15 5l-7 7 7 7", rechts: "M9 5l7 7-7 7",
  import: "M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14",
  minus: "M5 12h14",
  wiederholen: "M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4",
};
function ic(name) {
  const s = document.createElementNS(SVGNS, "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", "ic"); s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(SVGNS, "path"); p.setAttribute("d", ICONS[name] || ICONS.mehr);
  s.append(p); return s;
}

/* ---------- Formate ---------- */
const WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const WT_LANG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function heuteIso() { return iso(new Date()); }
function alsDatum(s) { if (!s) return null; const [j, m, t] = s.slice(0, 10).split("-").map(Number); return new Date(j, m - 1, t); }
function plusTage(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function tageBis(s) { const d = alsDatum(s); if (!d) return null; const h = alsDatum(heuteIso()); return Math.round((d - h) / 864e5); }
function zeitTeil(s) { return s && s.length > 10 ? s.slice(11, 16) : ""; }
function fmtDatum(s, jahr = true) { const d = alsDatum(s); if (!d) return ""; return `${d.getDate()}.${d.getMonth() + 1}.` + (jahr ? d.getFullYear() : ""); }
function fmtLang(s) { const d = alsDatum(s); return d ? `${WT_LANG[d.getDay()]}, ${d.getDate()}. ${MONATE[d.getMonth()]}` : ""; }
function fmtRelativ(s) {
  const n = tageBis(s); if (n === null) return "";
  const z = zeitTeil(s) ? " " + zeitTeil(s) : "";
  if (n === 0) return "heute" + z; if (n === 1) return "morgen" + z; if (n === -1) return "gestern" + z;
  if (n > 1 && n < 7) return WT_LANG[alsDatum(s).getDay()] + z;
  if (n < 0) return `vor ${-n} Tagen`;
  return fmtDatum(s, alsDatum(s).getFullYear() !== new Date().getFullYear()) + z;
}
function fmtVor(ts) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return "gerade eben"; if (s < 3600) return `vor ${Math.floor(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std.`; if (s < 7 * 86400) return `vor ${Math.floor(s / 86400)} T.`;
  return fmtDatum(ts);
}
function chf(n, w = "CHF") {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const [g, k] = Math.abs(v).toFixed(2).split(".");
  return (v < 0 ? "−" : "") + w + " " + g.replace(/\B(?=(\d{3})+(?!\d))/g, "’") + "." + k;
}
function zahl(s) { if (s === null || s === undefined || s === "") return 0; return Number(String(s).replace(/[’'\s]/g, "").replace(",", ".")) || 0; }
function normal(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }

/* ---------- Personen ---------- */
function person(id) { return S.personen.find(p => p.id === id); }
function haushalt(id) { return S.haushalte.find(x => x.id === id); }
function mitLogin(p) { return ["admin", "erwachsen", "gast"].includes(p.rolle); }
function aktive() { return S.personen.filter(p => p.aktiv); }
function menschen() { return aktive().filter(p => p.rolle !== "tier"); }
function tiere() { return aktive().filter(p => p.rolle === "tier"); }
function meinHaushalt() { return aktive().filter(p => p.haushalt_id === S.ich.haushalt_id); }
function ava(p, cls = "") {
  if (!p) return h("span", { class: "ava " + cls, style: { background: "#999" } }, "?");
  const inhalt = p.emoji && p.emoji !== "🙂" ? p.emoji : (p.name || "?").slice(0, 1).toUpperCase();
  return h("span", { class: "ava " + cls, title: p.name, style: { background: p.farbe || "#5b7c99" } }, inhalt);
}
function name(id) { const p = person(id); return p ? p.name : "—"; }
const ROLLE_NAME = { admin: "Admin", erwachsen: "Erwachsen", gast: "Gast", kind: "Kind", tier: "Haustier" };

/* ---------- Schnittstelle ---------- */
async function api(methode, pfad, koerper) {
  const opt = { method: methode, headers: { "X-Huesli": "1" }, credentials: "same-origin" };
  if (koerper !== undefined) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(koerper); }
  let r;
  try { r = await fetch("/familie/api" + pfad, opt); }
  catch (e) { meldung("Keine Verbindung zum Hüsli (Tailscale an?)"); throw e; }
  if (r.status === 401 && pfad !== "/anmelden") { S.ich = null; zeigeAnmeldung(); throw new Error("abgemeldet"); }
  const typ = r.headers.get("Content-Type") || "";
  const d = typ.includes("json") ? await r.json() : await r.blob();
  if (!r.ok) { const t = (d && d.fehler) || "Fehler " + r.status; meldung(t); const e = new Error(t); e.status = r.status; throw e; }
  return d;
}
async function laden() {
  const d = await api("GET", "/ich");
  S.ich = d.ich; S.personen = d.personen; S.haushalte = d.haushalte; S.module = d.module; S.alleModule = d.alle_module;
  S.hinweise = d.hinweise_offen; S.E = new Map(d.eintraege.map(e => [e.id, e])); S.geladen = Date.now();
}
function merken(e) { if (e && e.id) S.E.set(e.id, e); return e; }
function alle(typ, filter) { const a = []; for (const e of S.E.values()) if (e.typ === typ && !e.geloescht && (!filter || filter(e))) a.push(e); return a; }
function kinder(id, typ) { return alle(typ, e => e.eltern_id === id); }
async function neu(typ, felder) { const e = merken(await api("POST", "/eintraege", Object.assign({ typ }, felder))); neuZeichnen(); return e; }
async function aendern(id, felder, still) { const e = merken(await api("PATCH", "/eintraege/" + id, felder)); if (!still) neuZeichnen(); return e; }
async function entfernen(id, text) {
  const e = S.E.get(id);
  await api("DELETE", "/eintraege/" + id);
  S.E.delete(id); for (const k of S.E.values()) if (k.eltern_id === id) S.E.delete(k.id);
  neuZeichnen();
  meldung((text || "Gelöscht") + (e && e.titel ? ": " + e.titel : ""), "Rückgängig", async () => {
    merken(await api("POST", `/eintraege/${id}/wiederherstellen`)); await laden(); neuZeichnen();
  });
}
async function abhaken(e) {
  const vorher = e.datum;
  const n = await aendern(e.id, { erledigt: !e.erledigt });
  if (e.daten.wiederholung && !e.erledigt && n.datum !== vorher) meldung(`Erledigt ✓ Nächstes Mal: ${fmtRelativ(n.datum)}` +
    (n.zugewiesen_id && n.zugewiesen_id !== e.zugewiesen_id ? ` (${name(n.zugewiesen_id)})` : ""));
}

/* ---------- Meldung, Dialog ---------- */
let meldungTimer;
function meldung(text, knopf, aktion) {
  document.querySelectorAll(".meldung").forEach(x => x.remove());
  const m = h("div", { class: "meldung", role: "status" }, h("span", null, text),
    knopf && h("button", { class: "link", onclick: () => { m.remove(); aktion(); } }, knopf));
  document.body.append(m); clearTimeout(meldungTimer); meldungTimer = setTimeout(() => m.remove(), knopf ? 6000 : 3500);
}
let offeneDialoge = 0;
function dialog(titel, inhalt, knoepfe = [], opt = {}) {
  const schliessen = () => { s.remove(); offeneDialoge--; document.removeEventListener("keydown", esc); if (opt.zu) opt.zu(); };
  const esc = ev => { if (ev.key === "Escape") schliessen(); };
  const fuss = h("div", { class: "dialog-fuss" }, knoepfe.map(k => h("button", {
    class: "knopf " + (k.art || "") + (k.links ? " links" : ""), type: k.haupt ? "submit" : "button",
    onclick: k.haupt ? null : async ev => { ev.preventDefault(); if ((await k.tun(schliessen)) !== false && k.schliesst !== false) schliessen(); }
  }, k.text)));
  const form = h("form", { class: "dialog" + (opt.breit ? " breit" : ""), role: "dialog", "aria-modal": "true",
    onsubmit: async ev => {
      ev.preventDefault(); const k = knoepfe.find(x => x.haupt); if (!k) return;
      const b = form.querySelector("button[type=submit]"); if (b) b.disabled = true;
      try { if ((await k.tun(schliessen)) !== false) schliessen(); } catch (e) { console.error(e); } finally { if (b) b.disabled = false; }
    } },
    h("div", { class: "dialog-kopf" }, h("h2", null, titel), h("button", { class: "knopf rund klein", type: "button", "aria-label": "Schliessen", onclick: schliessen }, ic("x"))),
    inhalt, knoepfe.length ? fuss : null);
  const s = h("div", { class: "schleier", onmousedown: ev => { if (ev.target === s) s._z = 1; }, onclick: ev => { if (ev.target === s && s._z) schliessen(); } }, form);
  document.body.append(s); offeneDialoge++; document.addEventListener("keydown", esc);
  const erstes = form.querySelector("input:not([type=checkbox]),textarea,select");
  if (erstes && matchMedia("(pointer:fine)").matches) setTimeout(() => erstes.focus(), 30);
  return schliessen;
}
function bestaetigen(text, knopf = "Löschen") {
  return new Promise(res => dialog("Sicher?", h("p", null, text), [
    { text: "Abbrechen", tun: () => res(false) }, { text: knopf, art: "gefahr", tun: () => res(true) }], { zu: () => res(false) }));
}

/* ---------- Formulare ---------- */
const SICHT_NAME = { privat: "Nur ich", personen: "Ausgewählte", haushalt: "Mein Haushalt", familie: "Ganze Familie" };
const SICHT_STANDARD = { aufgabe: "haushalt", projekt: "haushalt", einkauf_liste: "haushalt", ausgaben_topf: "personen", notiz: "privat",
  rezept: "familie", menu: "haushalt", kontakt: "familie", geburtstag: "familie", termin: "familie", vorrat: "haushalt", fahrzeug: "haushalt",
  tier_eintrag: "haushalt" };
const WIEDERHOLUNG = [["", "Nie"], ["taeglich", "Täglich"], ["woechentlich", "Wöchentlich"], ["zweiwoechentlich", "Alle 2 Wochen"],
  ["monatlich", "Monatlich"], ["quartal", "Alle 3 Monate"], ["jaehrlich", "Jährlich"]];
const WH_NAME = Object.fromEntries(WIEDERHOLUNG);

function wert(e, key) {
  if (!e) return undefined;
  if (key.startsWith("d.")) return e.daten ? e.daten[key.slice(2)] : undefined;
  return e[key];
}
function feldElement(f, start) {
  const v = start === undefined || start === null ? (f.std !== undefined ? f.std : "") : start;
  let el;
  switch (f.art) {
    case "textarea": el = h("textarea", { rows: f.zeilen || 5, placeholder: f.platz || "" }); el.value = v; break;
    case "datum": el = h("input", { type: "date", value: v ? String(v).slice(0, 10) : "" }); break;
    case "datumzeit": el = h("input", { type: "datetime-local", value: v ? String(v).slice(0, 16) : "" }); break;
    case "zeit": el = h("input", { type: "time", value: v || "" }); break;
    case "zahl": el = h("input", { type: "text", inputmode: "decimal", value: v === "" ? "" : String(v), placeholder: f.platz || "" }); break;
    case "auswahl": {
      el = h("select", null, (typeof f.optionen === "function" ? f.optionen() : f.optionen).map(([a, b]) => h("option", { value: a }, b)));
      el.value = v === null || v === undefined ? "" : String(v); break;
    }
    case "haken": {
      const cb = h("input", { type: "checkbox", checked: !!v });
      const lab = h("label", { class: "haken" }, cb, f.text); lab._wert = () => cb.checked; lab._cb = cb; return lab;
    }
    case "personen": {
      const gewaehlt = new Set(v || []);
      const wahl = typeof f.optionen === "function" ? f.optionen() : f.optionen;
      const box = h("div", { class: "chips" }, wahl.map(p => {
        const c = h("button", { type: "button", class: "chip" + (gewaehlt.has(p.id) ? " an" : ""), onclick: () => {
          gewaehlt.has(p.id) ? gewaehlt.delete(p.id) : gewaehlt.add(p.id); c.classList.toggle("an"); if (f.wechsel) f.wechsel([...gewaehlt]); } },
          ava(p, "mini"), p.name);
        return c;
      }));
      const lab = h("div", { class: "feld" }, h("span", null, f.text), box); lab._wert = () => [...gewaehlt]; return lab;
    }
    case "sicht": return sichtFeld(v || {});
    default: el = h("input", { type: f.typ || "text", value: v, placeholder: f.platz || "", autocomplete: "off",
      list: f.vorschlaege ? "vl-" + f.key.replace(/\W/g, "") : null, required: f.pflicht || null, maxlength: f.max || null });
  }
  const lab = h("label", { class: "feld" + (f.breit ? " breit" : "") }, h("span", null, f.text), el,
    f.vorschlaege ? h("datalist", { id: "vl-" + f.key.replace(/\W/g, "") }, (typeof f.vorschlaege === "function" ? f.vorschlaege() : f.vorschlaege).map(x => h("option", { value: x }))) : null,
    f.hilfe ? h("span", { class: "klein leise" }, f.hilfe) : null);
  lab._wert = () => {
    const x = el.value;
    if (f.art === "zahl") return x === "" ? null : zahl(x);
    if (f.art === "auswahl" && f.zahlen) return x === "" ? null : Number(x);
    return x;
  };
  lab._el = el;
  return lab;
}
function sichtFeld(v) {
  let sicht = v.sicht || "haushalt";
  const freigabe = new Set(v.freigabe || []);
  const seg = h("div", { class: "segment" });
  const chips = h("div", { class: "chips" }, menschen().filter(p => p.id !== S.ich.id && mitLogin(p)).map(p => {
    const c = h("button", { type: "button", class: "chip" + (freigabe.has(p.id) ? " an" : ""), onclick: () => {
      freigabe.has(p.id) ? freigabe.delete(p.id) : freigabe.add(p.id); c.classList.toggle("an"); } }, ava(p, "mini"), p.name);
    return c;
  }));
  const chipBox = h("div", { style: { "margin-top": "8px" } }, chips);
  const zeichnen = () => {
    seg.replaceChildren(...Object.entries(SICHT_NAME).map(([k, t]) => h("button", { type: "button", class: sicht === k ? "an" : "",
      onclick: () => { sicht = k; zeichnen(); } }, t)));
    chipBox.classList.toggle("versteckt", sicht !== "personen");
  };
  zeichnen();
  const hh = haushalt(S.ich.haushalt_id);
  const lab = h("div", { class: "feld" }, h("span", null, "Wer sieht das?"), seg, chipBox,
    h("span", { class: "klein leise" }, v.hinweis || (hh ? `Haushalt: ${hh.name}` : "")));
  lab._wert = () => ({ sicht, freigabe: [...freigabe] });
  return lab;
}
/* felder: [{key, text, art, ...}] – key "titel" | "datum" | "zugewiesen_id" | "d.xyz" | "sicht" */
function formular(titel, felder, start, speichern, extra = {}) {
  const els = [];
  const box = h("div");
  let reihe = null;
  for (const f of felder) {
    if (f.zeigen && !f.zeigen(start)) continue;
    let sv = f.key === "sicht" ? { sicht: start ? start.sicht : f.std, freigabe: start ? start.freigabe : [], hinweis: f.hinweis } : wert(start, f.key);
    if ((sv === undefined || sv === null) && f.std !== undefined && f.key !== "sicht") sv = typeof f.std === "function" ? f.std() : f.std;
    const el = feldElement(f, sv);
    els.push([f, el]);
    if (f.halb) { if (!reihe) { reihe = h("div", { class: "felder2" }); box.append(reihe); } reihe.append(el); if (reihe.children.length === 2) reihe = null; }
    else { reihe = null; box.append(el); }
    if (f.nachher) f.nachher(el, els);
  }
  if (extra.unten) box.append(extra.unten);
  const knoepfe = [];
  if (extra.loeschen) knoepfe.push({ text: "Löschen", art: "gefahr", links: true, tun: async zu => { zu(); await extra.loeschen(); return false; } });
  if (extra.knoepfe) knoepfe.push(...extra.knoepfe);
  knoepfe.push({ text: "Abbrechen", tun: () => true });
  knoepfe.push({ text: extra.speichernText || "Speichern", art: "haupt", haupt: true, tun: async () => {
    const res = { daten: {} };
    for (const [f, el] of els) {
      const w = el._wert();
      if (f.key === "sicht") Object.assign(res, w);
      else if (f.key.startsWith("d.")) res.daten[f.key.slice(2)] = w === "" ? null : w;
      else res[f.key] = w === "" ? null : w;
    }
    for (const f of felder) if (f.pflicht && !res[f.key] && !(f.key.startsWith("d.") && res.daten[f.key.slice(2)])) { meldung(`Bitte «${f.text}» ausfüllen`); return false; }
    try { await speichern(res); } catch (e) { return false; }
  } });
  return dialog(titel, box, knoepfe, { breit: extra.breit });
}
/* Standard-Bearbeitung eines Eintragstyps */
function bearbeiten(typ, e, vor = {}) {
  const def = FORMULARE[typ];
  if (!def) return;
  const start = e || Object.assign({ typ, sicht: SICHT_STANDARD[typ] || "haushalt", freigabe: [], daten: {} }, vor, { daten: Object.assign({}, vor.daten || {}) });
  const felder = def.felder(start);
  if (!e && !vor.eltern_id && def.sicht !== false) felder.push({ key: "sicht", art: "sicht", std: SICHT_STANDARD[typ] });
  else if (e && !e.eltern_id && def.sicht !== false) felder.push({ key: "sicht", art: "sicht" });
  formular(e ? def.titel + " bearbeiten" : "Neu: " + def.titel, felder, start, async res => {
    if (def.vorher) def.vorher(res, start);
    if (e) await aendern(e.id, res);
    else { if (vor.eltern_id) res.eltern_id = vor.eltern_id; const n = await neu(typ, res); if (def.danach) def.danach(n); }
  }, { loeschen: e ? () => entfernen(e.id) : null, breit: def.breit, unten: def.unten ? def.unten(start) : null });
}
const FORMULARE = {}; // werden in den Ansichten gefüllt

/* ---------- Module / Navigation ---------- */
const NAV = [
  { k: "uebersicht", n: "Übersicht", i: "haus", p: "#/" },
  { k: "aufgaben", n: "Aufgaben", i: "aufgaben", p: "#/aufgaben", m: "aufgaben" },
  { k: "kalender", n: "Kalender", i: "kalender", p: "#/kalender", m: "kalender" },
  { k: "einkauf", n: "Einkauf", i: "einkauf", p: "#/einkauf", m: "einkauf" },
  { k: "ausgaben", n: "Ausgaben", i: "ausgaben", p: "#/ausgaben", m: "ausgaben" },
  { k: "projekte", n: "Projekte", i: "projekte", p: "#/projekte", m: "projekte" },
  { k: "notizen", n: "Notizen", i: "notizen", p: "#/notizen", m: "notizen" },
  { k: "rezepte", n: "Rezepte", i: "rezepte", p: "#/rezepte", m: "rezepte" },
  { k: "haustiere", n: "Haustiere", i: "haustiere", p: "#/haustiere", m: "haustiere" },
  { k: "geburtstage", n: "Geburtstage", i: "geburtstage", p: "#/geburtstage", m: "geburtstage" },
  { k: "kontakte", n: "Kontakte", i: "kontakte", p: "#/kontakte", m: "kontakte" },
  { k: "vorrat", n: "Vorrat", i: "vorrat", p: "#/vorrat", m: "vorrat" },
  { k: "fahrzeuge", n: "Fahrzeuge", i: "fahrzeuge", p: "#/fahrzeuge", m: "fahrzeuge" },
  { trenner: true },
  { k: "mitglieder", n: "Familie", i: "mitglieder", p: "#/mitglieder" },
  { k: "hinweise", n: "Hinweise", i: "hinweise", p: "#/hinweise" },
  { k: "suche", n: "Suche", i: "suche", p: "#/suche" },
  { k: "module", n: "Module", i: "module", p: "#/module", nichtGast: true },
  { k: "papierkorb", n: "Papierkorb", i: "papierkorb", p: "#/papierkorb", nichtGast: true },
  { k: "einstellungen", n: "Einstellungen", i: "einstellungen", p: "#/einstellungen" },
];
const MODUL_INFO = {
  aufgaben: ["Aufgaben", "Ämtli, To-dos, wiederkehrend und reihum"], projekte: ["Projekte", "Grössere Vorhaben mit Teilaufgaben"],
  einkauf: ["Einkauf", "Gemeinsame Einkaufslisten"], ausgaben: ["Ausgaben", "Gemeinsame Kassen, wer schuldet wem"],
  notizen: ["Notizen", "Notizen und Checklisten"], rezepte: ["Rezepte", "Rezepte und Menüplan"], kontakte: ["Kontakte", "Ärzte, Handwerker, Notfall"],
  geburtstage: ["Geburtstage", "Mit Geschenkideen und Erinnerung"], kalender: ["Kalender", "Termine, auch als Abo fürs iPhone"],
  vorrat: ["Vorrat", "Was ist wo, was geht aus"], fahrzeuge: ["Fahrzeuge", "MFK, Service, Tanken"], haustiere: ["Haustiere", "Impfungen, Entwurmung, Tierarzt"],
};
function navSichtbar() { return NAV.filter(n => n.trenner || (!n.m || S.module.includes(n.m)) && !(n.nichtGast && S.ich.rolle === "gast")); }
function leisteWahl() {
  const std = ["uebersicht", "aufgaben", "einkauf", "kalender"];
  const w = (S.ich.daten.leiste || std).filter(k => navSichtbar().some(n => n.k === k));
  return w.length ? w.slice(0, 4) : std.filter(k => navSichtbar().some(n => n.k === k));
}

/* ---------- Router ---------- */
let aktuelleRoute = "";
function route() {
  const roh = location.hash.replace(/^#\/?/, "");
  const [pfad, abfrage] = roh.split("?");
  const teile = pfad.split("/").filter(Boolean).map(decodeURIComponent);
  return { name: teile[0] || "uebersicht", args: teile.slice(1), q: new URLSearchParams(abfrage || "") };
}
function zeichnen() {
  const app = document.getElementById("app");
  const r = route();
  if (r.name === "einladung") return zeigeEinladung(r.args[0]);
  if (!S.ich) return zeigeAnmeldung();
  aktuelleRoute = location.hash;
  const sichtbar = navSichtbar();
  const nav = h("nav", { class: "nav" }, sichtbar.map(n => n.trenner ? h("div", { class: "trenner" }) :
    h("a", { href: n.p, class: n.k === r.name ? "aktiv" : "" }, ic(n.i), n.n, n.k === "hinweise" && S.hinweise ? h("span", { class: "zahl" }, S.hinweise) : null)));
  const seite = h("aside", { class: "seite" }, h("a", { class: "marke", href: "#/" }, h("img", { src: "/familie/icon.svg", alt: "" }), "Hüsli"), nav,
    h("div", { class: "trenner" }), h("div", { class: "klein leise", style: { padding: "8px 10px" } }, ava(S.ich, "mini"), " ", S.ich.name));
  const leiste = h("nav", { class: "leiste" }, leisteWahl().map(k => NAV.find(n => n.k === k)).filter(Boolean).map(n =>
    h("a", { href: n.p, class: n.k === r.name ? "aktiv" : "" }, ic(n.i), n.n)),
    h("a", { href: "#/mehr", class: r.name === "mehr" ? "aktiv" : "" }, ic("mehr"), "Mehr", S.hinweise ? h("span", { class: "punkt" }) : null));
  const inhalt = h("main", { class: "inhalt", id: "inhalt" });
  let ansicht;
  const fn = V[r.name];
  const navEintrag = NAV.find(n => n.k === r.name);
  if (!fn || (navEintrag && navEintrag.m && !S.module.includes(navEintrag.m))) ansicht = h("div", { class: "leer" }, h("span", { class: "gross" }, "🧭"), "Diese Seite gibt es nicht (oder das Modul ist ausgeschaltet).");
  else { try { ansicht = fn(r.args, r.q); } catch (e) { console.error(e); ansicht = h("div", { class: "leer" }, "Fehler beim Anzeigen: " + e.message); } }
  inhalt.append(ansicht);
  const plusFn = ansicht && ansicht._plus;
  const plus = plusFn ? h("button", { class: "plus", "aria-label": "Neu", onclick: plusFn }, ic("plus")) : null;
  const y = window.scrollY, gleich = app.dataset.route === location.hash;
  app.replaceChildren(h("div", { class: "rahmen" }, seite, inhalt), leiste, plus || "");
  app.dataset.route = location.hash;
  if (gleich) window.scrollTo(0, y); else window.scrollTo(0, 0);
  document.title = (navEintrag ? navEintrag.n + " · " : "") + "Hüsli";
}
let zeichnenGeplant = false;
function neuZeichnen() { if (zeichnenGeplant) return; zeichnenGeplant = true; requestAnimationFrame(() => { zeichnenGeplant = false; if (S.ich) zeichnen(); }); }

/* Seitenkopf mit Titel und Knöpfen */
function kopf(titel, knoepfe = [], zurueck) {
  return h("div", null, zurueck ? h("a", { class: "zurueck", href: zurueck[0] }, ic("zurueck"), zurueck[1]) : null,
    h("div", { class: "kopf" }, h("h1", null, titel), h("div", { class: "rechts" }, knoepfe)));
}
function knopf(text, tun, art = "", icon) { return h("button", { class: "knopf " + art, type: "button", onclick: tun }, icon ? ic(icon) : null, text); }
function neuKnopf(text, tun) { return h("button", { class: "knopf haupt nur-gross", type: "button", onclick: tun }, ic("plus"), text); }
function leer(emoji, text, knopfEl) { return h("div", { class: "leer" }, h("span", { class: "gross" }, emoji), text, knopfEl ? h("div", { style: { "margin-top": "10px" } }, knopfEl) : null); }
function seite(...kinder) { const d = h("div", null, ...kinder); return d; }
function mitPlus(el, fn) { el._plus = fn; return el; }
function suchfeld(wert, beiEingabe, platz = "Suchen …") {
  const i = h("input", { class: "eingabe", type: "search", placeholder: platz, value: wert || "", oninput: () => beiEingabe(i.value) });
  return h("div", { class: "suche" }, ic("suche"), i);
}
function sichtEtikett(e) {
  if (e.sicht === "privat") return h("span", { class: "etikett", title: "Nur für dich" }, "🔒 privat");
  if (e.sicht === "familie") return h("span", { class: "etikett", title: "Ganze Familie" }, "👪 Familie");
  if (e.sicht === "personen") return h("span", { class: "etikett", title: e.freigabe.map(name).join(", ") }, "👥 " + (e.freigabe.length + 1));
  if (e.haushalt_id !== S.ich.haushalt_id) { const hh = haushalt(e.haushalt_id); return h("span", { class: "etikett" }, (hh ? hh.emoji + " " + hh.name : "anderer Haushalt")); }
  return null;
}
function checkKnopf(an, tun, eckig) {
  return h("button", { class: "check" + (an ? " an" : "") + (eckig ? " eckig" : ""), type: "button", "aria-label": an ? "Wieder öffnen" : "Erledigt",
    onclick: ev => { ev.stopPropagation(); tun(); } }, an ? ic("haken") : null);
}

/* ---------- Anmeldung ---------- */
function zeigeAnmeldung() {
  const app = document.getElementById("app");
  const fehler = h("div", { class: "fehlertext" });
  const login = h("input", { class: "eingabe", autocomplete: "username", autocapitalize: "none", placeholder: "z. B. alfred", required: true });
  const pw = h("input", { class: "eingabe", type: "password", autocomplete: "current-password", required: true });
  const form = h("form", { class: "karte", onsubmit: async ev => {
    ev.preventDefault(); fehler.textContent = "";
    try {
      const r = await fetch("/familie/api/anmelden", { method: "POST", headers: { "Content-Type": "application/json", "X-Huesli": "1" },
        body: JSON.stringify({ login: login.value.trim(), passwort: pw.value }) });
      const d = await r.json();
      if (!r.ok) { fehler.textContent = d.fehler || "Fehler"; return; }
      await start();
    } catch (e) { fehler.textContent = "Keine Verbindung. Ist Tailscale an?"; }
  } },
    h("div", { class: "marke" }, h("img", { src: "/familie/icon.svg", alt: "" }), "Hüsli"),
    h("p", { class: "leise", style: { "text-align": "center", "margin-top": "0" } }, "Unser Familien-Organizer"),
    h("label", { class: "feld" }, h("span", null, "Name"), login),
    h("label", { class: "feld" }, h("span", null, "Passwort"), pw), fehler,
    h("button", { class: "knopf haupt", style: { width: "100%" } }, "Anmelden"),
    h("p", { class: "klein leise", style: { "text-align": "center" } }, "Noch kein Zugang? Alfred schickt dir einen Einladungslink."));
  app.replaceChildren(h("div", { class: "anmeldung" }, form));
  document.querySelector(".leiste")?.remove();
}
async function zeigeEinladung(code) {
  const app = document.getElementById("app");
  let info;
  try { const r = await fetch("/familie/api/einladung?code=" + encodeURIComponent(code || "")); info = r.ok ? await r.json() : null; } catch (e) { info = null; }
  if (!info) { app.replaceChildren(h("div", { class: "anmeldung" }, h("div", { class: "karte" }, h("h2", null, "Einladung ungültig"),
    h("p", null, "Der Link ist abgelaufen oder wurde schon benutzt. Bitte Alfred um einen neuen."), h("a", { class: "knopf", href: "#/" }, "Zur Anmeldung")))); return; }
  const fehler = h("div", { class: "fehlertext" });
  const pw = h("input", { class: "eingabe", type: "password", autocomplete: "new-password", minlength: 8, required: true });
  const pw2 = h("input", { class: "eingabe", type: "password", autocomplete: "new-password", minlength: 8, required: true });
  app.replaceChildren(h("div", { class: "anmeldung" }, h("form", { class: "karte", onsubmit: async ev => {
    ev.preventDefault();
    if (pw.value !== pw2.value) { fehler.textContent = "Die Passwörter sind nicht gleich."; return; }
    const r = await fetch("/familie/api/einladung", { method: "POST", headers: { "Content-Type": "application/json", "X-Huesli": "1" },
      body: JSON.stringify({ code, passwort: pw.value }) });
    const d = await r.json();
    if (!r.ok) { fehler.textContent = d.fehler; return; }
    location.hash = "#/"; await start();
  } }, h("div", { class: "marke" }, h("img", { src: "/familie/icon.svg", alt: "" }), "Hüsli"),
    h("h2", null, `Willkommen, ${info.name}!`),
    h("p", { class: "leise" }, "Dein Anmeldename ist ", h("b", null, info.login), ". Wähle jetzt ein Passwort (mindestens 8 Zeichen)."),
    h("input", { type: "text", autocomplete: "username", value: info.login, class: "versteckt", readonly: true }),
    h("label", { class: "feld" }, h("span", null, "Passwort"), pw), h("label", { class: "feld" }, h("span", null, "Nochmals"), pw2), fehler,
    h("button", { class: "knopf haupt", style: { width: "100%" } }, "Loslegen"))));
}

/* ---------- Start ---------- */
function thema() { const t = localStorage.getItem("huesli-thema"); if (t) document.documentElement.dataset.thema = t; else delete document.documentElement.dataset.thema; }
async function start() {
  thema();
  if (route().name === "einladung") return zeichnen();
  try { await laden(); } catch (e) { if (!S.ich) return; }
  zeichnen();
}
async function auffrischen() {
  if (!S.ich || offeneDialoge || document.hidden) return;
  if (document.activeElement && ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
  try { await laden(); if (!offeneDialoge) neuZeichnen(); } catch (e) { /* still */ }
}
window.addEventListener("hashchange", () => {
  if (offeneDialoge) document.querySelectorAll(".schleier").forEach(x => x.remove()), offeneDialoge = 0;
  zeichnen();
  // Neues von anderen Geräten oder aus Siri-Kurzbefehlen beim Seitenwechsel nachladen
  if (S.ich && Date.now() - S.geladen > 3000) laden().then(() => { const a = document.activeElement; if (!offeneDialoge && !(a && ["INPUT", "TEXTAREA"].includes(a.tagName) && a.value)) neuZeichnen(); }).catch(() => {});
});
document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - S.geladen > 3000) auffrischen(); });
setInterval(auffrischen, 60000);
document.addEventListener("DOMContentLoaded", start);
