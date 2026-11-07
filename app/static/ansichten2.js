/* Hüsli – Notizen, Rezepte + Menüplan, Kontakte, Geburtstage, Kalender */
"use strict";

/* ---------- Notizen ---------- */
const NOTIZ_FARBEN = [["", "Weiss"], ["gelb", "Gelb"], ["gruen", "Grün"], ["blau", "Blau"], ["rosa", "Rosa"], ["grau", "Grau"]];
FORMULARE.notiz = {
  titel: "Notiz", breit: true,
  felder: () => [
    { key: "titel", text: "Titel", platz: "optional" },
    { key: "d.text", text: "Text", art: "textarea", zeilen: 10, platz: "Text … Checkliste mit «[ ] Punkt» pro Zeile" },
    { key: "d.farbe", text: "Farbe", art: "auswahl", optionen: NOTIZ_FARBEN, halb: true },
    { key: "d.angeheftet", text: "Oben anheften", art: "haken", halb: true },
  ],
  vorher: res => { if (!res.titel && !res.daten.text) throw meldung("Leere Notiz"); },
};
function notizText(e, klickbar) {
  const z = String(e.daten.text || "").split("\n");
  const box = h("div", { class: "notiz-text" });
  z.forEach((zeile, i) => {
    const m = zeile.match(/^\s*[-*]?\s*\[( |x|X)\]\s?(.*)$/);
    if (m) {
      const cb = h("input", { type: "checkbox", checked: m[1] !== " ", onclick: async ev => {
        ev.stopPropagation(); if (!klickbar) return;
        const neuZ = [...z]; neuZ[i] = zeile.replace(/\[( |x|X)\]/, cb.checked ? "[x]" : "[ ]");
        await aendern(e.id, { daten: { text: neuZ.join("\n") } });
      } });
      box.append(h("label", { class: "cl", onclick: ev => ev.stopPropagation() }, cb, h("span", { class: cb.checked ? "leise" : "" }, m[2])));
    } else box.append(h("div", null, zeile || " "));
  });
  return box;
}
V.notizen = function (args, q) {
  const such = q.get("s") || "";
  let xs = alle("notiz");
  if (such) xs = xs.filter(e => normal(e.titel + " " + e.daten.text).includes(normal(such)));
  xs.sort((a, b) => (b.daten.angeheftet ? 1 : 0) - (a.daten.angeheftet ? 1 : 0) || (b.geaendert > a.geaendert ? 1 : -1));
  const sf = suchfeld(such, v => { clearTimeout(sf._t); sf._t = setTimeout(() => { history.replaceState(null, "", "#/notizen?s=" + encodeURIComponent(v)); neuZeichnen(); setTimeout(() => { const i = document.querySelector(".suche input"); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } }, 30); }, 250); }, "Notizen durchsuchen");
  return mitPlus(seite(kopf("Notizen", [neuKnopf("Notiz", () => bearbeiten("notiz"))]), sf,
    xs.length ? h("div", { class: "notizen" }, xs.map(e => h("div", { class: "karte" + (e.daten.farbe ? " notiz-farbe-" + e.daten.farbe : ""), onclick: () => bearbeiten("notiz", e) },
      h("div", { class: "karte-kopf" }, e.daten.angeheftet ? "📌" : null, h("h3", { style: { margin: 0 } }, e.titel || ""), h("span", { class: "rechts" }, sichtEtikett(e))),
      notizText(e, true), h("div", { class: "klein leise", style: { "margin-top": "8px" } }, `${name(e.geaendert_von || e.besitzer_id)} · ${fmtVor(e.geaendert)}`))))
      : leer("📝", such ? "Nichts gefunden." : "Noch keine Notizen. Ideal für WLAN-Passwort, Katzensitter-Infos, Packlisten …")), () => bearbeiten("notiz"));
};

/* ---------- Rezepte ---------- */
FORMULARE.rezept = {
  titel: "Rezept", breit: true,
  felder: () => [
    { key: "titel", text: "Name", pflicht: true },
    { key: "d.portionen", text: "Portionen", art: "zahl", std: 4, halb: true },
    { key: "d.dauer", text: "Dauer (Min.)", art: "zahl", halb: true },
    { key: "d.emoji", text: "Symbol", platz: "🍲", halb: true, max: 8 },
    { key: "d.tags", text: "Stichworte", platz: "vegi, schnell, Znacht", halb: true },
    { key: "d.zutaten", text: "Zutaten (eine pro Zeile, Menge zuerst)", art: "textarea", zeilen: 8, platz: "500 g Teigwaren\n2 Zwiebeln\n1 dl Rahm" },
    { key: "d.zubereitung", text: "Zubereitung (Schritte durch Leerzeile oder Zeile trennen)", art: "textarea", zeilen: 8 },
    { key: "d.quelle", text: "Quelle / Link", platz: "optional" },
    { key: "d.notiz", text: "Unsere Notizen", art: "textarea", zeilen: 2, platz: "z. B. Aiden mag es ohne Pfeffer" },
  ],
  danach: n => { location.hash = "#/rezepte/" + n.id; },
};
FORMULARE.menu = {
  titel: "Menüplan",
  felder: () => [
    { key: "datum", text: "Tag", art: "datum", pflicht: true, std: heuteIso, halb: true },
    { key: "d.mahlzeit", text: "Mahlzeit", art: "auswahl", optionen: [["abend", "Znacht"], ["mittag", "Zmittag"], ["morgen", "Zmorge"]], halb: true },
    { key: "d.rezept_id", text: "Rezept", art: "auswahl", zahlen: true, optionen: () => [["", "— eigenes Gericht —"], ...alle("rezept").sort((a, b) => a.titel.localeCompare(b.titel)).map(r => [r.id, r.titel])] },
    { key: "titel", text: "…oder Gericht", platz: "z. B. Resten, Pizza bestellen" },
  ],
  vorher: res => { if (!res.titel && !res.daten.rezept_id) throw meldung("Rezept oder Gericht angeben"); if (!res.titel) res.titel = (S.E.get(res.daten.rezept_id) || {}).titel || ""; },
};
function zutatSkalieren(zeile, faktor) {
  if (faktor === 1) return zeile;
  return zeile.replace(/^(\s*)(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?|^(\s*)(½|¼|¾)/, (m, sp, a, b, sp2, bruch) => {
    const f = x => { const v = Math.round(zahl(x) * faktor * 100) / 100; return String(v).replace(".", ","); };
    if (bruch) return (sp2 || "") + f({ "½": 0.5, "¼": 0.25, "¾": 0.75 }[bruch]);
    return sp + f(a) + (b ? "–" + f(b) : "");
  });
}
V.rezepte = function (args, q) {
  if (args[0]) return rezeptDetail(Number(args[0]), q);
  const ansicht = q.get("ansicht") || "rezepte";
  const tabs = h("div", { class: "segment", style: { "margin-bottom": "14px" } }, [["rezepte", "Rezepte"], ["plan", "Menüplan"]].map(([k, t]) =>
    h("button", { class: ansicht === k ? "an" : "", onclick: () => location.hash = "#/rezepte?ansicht=" + k }, t)));
  if (ansicht === "plan") return menuPlan(q, tabs);
  const such = q.get("s") || "", tag = q.get("tag") || "";
  let xs = alle("rezept").sort((a, b) => a.titel.localeCompare(b.titel));
  const alleTags = [...new Set(xs.flatMap(r => String(r.daten.tags || "").split(",").map(t => t.trim()).filter(Boolean)))].sort();
  if (such) xs = xs.filter(r => normal(r.titel + " " + r.daten.zutaten + " " + r.daten.tags).includes(normal(such)));
  if (tag) xs = xs.filter(r => String(r.daten.tags || "").split(",").map(t => t.trim()).includes(tag));
  const sf = suchfeld(such, v => { clearTimeout(sf._t); sf._t = setTimeout(() => { history.replaceState(null, "", "#/rezepte?s=" + encodeURIComponent(v)); neuZeichnen(); setTimeout(() => { const i = document.querySelector(".suche input"); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } }, 30); }, 250); }, "Rezept oder Zutat suchen");
  return mitPlus(seite(kopf("Rezepte", [neuKnopf("Rezept", () => bearbeiten("rezept"))]), tabs, sf,
    alleTags.length ? h("div", { class: "chips", style: { "margin-bottom": "14px" } }, alleTags.map(t => h("button", { class: "chip" + (t === tag ? " an" : ""), onclick: () => location.hash = "#/rezepte" + (t === tag ? "" : "?tag=" + encodeURIComponent(t)) }, t))) : null,
    xs.length ? h("div", { class: "raster eng" }, xs.map(r => h("a", { class: "karte rezept-karte", href: "#/rezepte/" + r.id, style: { color: "var(--text)" } },
      h("div", { class: "bild" }, r.daten.emoji || "🍲"), h("h3", null, r.titel),
      h("div", { class: "klein leise" }, [r.daten.dauer ? r.daten.dauer + " Min." : null, r.daten.portionen ? r.daten.portionen + " Port." : null, r.daten.tags].filter(Boolean).join(" · ")))))
      : leer("🍲", "Noch keine Rezepte. Familienrezepte von Mama, Lieblingsgerichte …")), () => bearbeiten("rezept"));
};
function rezeptDetail(id, q) {
  const r = S.E.get(id);
  if (!r) return leer("🤷", "Rezept nicht gefunden.");
  const basis = zahl(r.daten.portionen) || 4;
  const port = Number(q.get("p")) || basis;
  const faktor = port / basis;
  const zutaten = String(r.daten.zutaten || "").split("\n").map(z => z.trim()).filter(Boolean);
  const schritte = String(r.daten.zubereitung || "").split(/\n\s*\n|\n(?=\d+[.)]\s)/).map(s => s.replace(/^\d+[.)]\s*/, "").trim()).filter(Boolean);
  const setzeP = p => location.hash = `#/rezepte/${id}?p=${Math.max(1, p)}`;
  return seite(kopf((r.daten.emoji || "🍲") + " " + r.titel, [knopf("In Menüplan", () => bearbeiten("menu", null, { daten: { rezept_id: id } })),
    knopf("", () => bearbeiten("rezept", r), "rund", "stift")], ["#/rezepte", "Rezepte"]),
    h("div", { class: "leise", style: { "margin-bottom": "14px" } }, [r.daten.dauer ? "⏱ " + r.daten.dauer + " Min." : null, r.daten.tags, r.daten.quelle ? h("a", { href: /^https?:/.test(r.daten.quelle) ? r.daten.quelle : null, target: "_blank", rel: "noopener" }, "Quelle") : null].filter(Boolean).flatMap((x, i) => i ? [" · ", x] : [x])),
    h("div", { class: "zwei" }, h("div", { class: "karte" }, h("h2", null, "Zubereitung"),
      schritte.length ? h("ol", { class: "schritte" }, schritte.map(s => h("li", { style: { "white-space": "pre-wrap" } }, s))) : h("p", { class: "leise" }, "Noch keine Schritte."),
      r.daten.notiz ? h("p", { class: "klein", style: { "white-space": "pre-wrap", background: "var(--gelb-hell)", padding: "8px 10px", "border-radius": "8px" } }, "💬 " + r.daten.notiz) : null),
      h("div", { class: "karte" }, h("div", { class: "karte-kopf" }, h("h2", null, "Zutaten"), h("span", { class: "rechts", style: { display: "flex", gap: "6px", "align-items": "center" } },
        h("button", { class: "knopf rund klein", "aria-label": "Weniger", onclick: () => setzeP(port - 1) }, ic("minus")), h("b", null, port + " Port."), h("button", { class: "knopf rund klein", "aria-label": "Mehr", onclick: () => setzeP(port + 1) }, ic("plus")))),
        h("ul", { class: "liste zutaten" }, zutaten.map(z => h("li", null, zutatSkalieren(z, faktor)))),
        zutaten.length ? knopf("Zutaten auf die Einkaufsliste", () => waehleZutaten(r, zutaten.map(z => zutatSkalieren(z, faktor))), "haupt", "einkauf") : null)));
}
function waehleZutaten(r, zutaten) {
  const wahl = new Set(zutaten.map((_, i) => i));
  const box = h("div", null, h("p", { class: "leise klein" }, "Was fehlt zu Hause?"), zutaten.map((z, i) => h("label", { class: "haken" },
    h("input", { type: "checkbox", checked: true, onchange: ev => ev.target.checked ? wahl.add(i) : wahl.delete(i) }), z)));
  dialog("Auf die Einkaufsliste", box, [{ text: "Abbrechen", tun: () => true }, { text: "Hinzufügen", art: "haupt", tun: () => {
    aufEinkaufsliste(zutaten.filter((_, i) => wahl.has(i)).map(z => mengeTrennen(z)), null, "für " + r.titel); } }]);
}
function montag(d) { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function menuPlan(q, tabs) {
  const start = q.get("w") ? alsDatum(q.get("w")) : montag(alsDatum(heuteIso()));
  const tage = [...Array(7)].map((_, i) => plusTage(start, i));
  const xs = alle("menu", e => e.datum >= iso(tage[0]) && e.datum <= iso(tage[6]));
  const ordnung = { morgen: 0, mittag: 1, abend: 2 };
  const nav = h("div", { class: "kopf" }, knopf("", () => location.hash = "#/rezepte?ansicht=plan&w=" + iso(plusTage(start, -7)), "rund", "links"),
    h("b", null, `${fmtDatum(iso(tage[0]), false)} – ${fmtDatum(iso(tage[6]))}`), knopf("", () => location.hash = "#/rezepte?ansicht=plan&w=" + iso(plusTage(start, 7)), "rund", "rechts"),
    h("div", { class: "rechts" }, knopf("Zutaten der Woche auf die Liste", () => {
      const z = [];
      for (const e of xs) { const r = S.E.get(e.daten.rezept_id); if (r) z.push(...String(r.daten.zutaten || "").split("\n").map(s => s.trim()).filter(Boolean)); }
      if (!z.length) return meldung("Keine Rezepte mit Zutaten in dieser Woche");
      waehleZutaten({ titel: "Menüplan" }, z);
    }, "klein", "einkauf")));
  return mitPlus(seite(kopf("Rezepte", [neuKnopf("Gericht planen", () => bearbeiten("menu"))]), tabs, nav,
    h("div", { class: "woche" }, tage.map(t => { const ti = iso(t); const es = xs.filter(e => e.datum === ti).sort((a, b) => ordnung[a.daten.mahlzeit || "abend"] - ordnung[b.daten.mahlzeit || "abend"]);
      return h("div", { class: "tagspalte" + (ti === heuteIso() ? " heute" : "") }, h("div", { class: "klein", style: { display: "flex" } }, h("b", null, WT[t.getDay()] + " " + t.getDate() + "."),
        h("button", { class: "link", style: { "margin-left": "auto" }, "aria-label": "Gericht planen", onclick: () => bearbeiten("menu", null, { datum: ti }) }, "+")),
        es.map(e => h("div", { class: "zeile klickbar", style: { padding: "4px 2px" }, onclick: () => e.daten.rezept_id && S.E.get(e.daten.rezept_id) ? location.hash = "#/rezepte/" + e.daten.rezept_id : bearbeiten("menu", e) },
          h("span", { class: "haupt" }, h("span", { class: "titel klein" }, menuTitel(e)), h("span", { class: "unter" }, { morgen: "Zmorge", mittag: "Zmittag", abend: "Znacht" }[e.daten.mahlzeit || "abend"])),
          h("button", { class: "link klein", "aria-label": "Bearbeiten", onclick: ev => { ev.stopPropagation(); bearbeiten("menu", e); } }, "✎")))); }))), () => bearbeiten("menu"));
}

/* ---------- Kontakte ---------- */
const KONTAKT_KAT = ["Familie", "Freunde", "Notfall", "Arzt", "Tierarzt", "Kita / Schule", "Handwerker", "Nachbarn", "Verwaltung", "Sonstiges"];
FORMULARE.kontakt = {
  titel: "Kontakt",
  felder: () => [
    { key: "titel", text: "Name", pflicht: true },
    { key: "d.kategorie", text: "Kategorie", art: "auswahl", optionen: KONTAKT_KAT.map(k => [k, k]), halb: true },
    { key: "d.firma", text: "Firma / Praxis", halb: true },
    { key: "d.telefon", text: "Telefon", typ: "tel", halb: true },
    { key: "d.email", text: "E-Mail", typ: "email", halb: true },
    { key: "d.adresse", text: "Adresse", art: "textarea", zeilen: 2 },
    { key: "d.geburtstag", text: "Geburtstag", art: "datum", halb: true, hilfe: "Jahr unbekannt? 1900 wählen." },
    { key: "d.notiz", text: "Notiz", art: "textarea", zeilen: 3 },
  ],
};
V.kontakte = function (args, q) {
  const such = q.get("s") || "";
  let xs = alle("kontakt").sort((a, b) => a.titel.localeCompare(b.titel));
  if (such) xs = xs.filter(e => normal([e.titel, e.daten.firma, e.daten.telefon, e.daten.kategorie, e.daten.notiz].join(" ")).includes(normal(such)));
  const nach = {};
  for (const e of xs) (nach[e.daten.kategorie || "Sonstiges"] = nach[e.daten.kategorie || "Sonstiges"] || []).push(e);
  const sf = suchfeld(such, v => { clearTimeout(sf._t); sf._t = setTimeout(() => { history.replaceState(null, "", "#/kontakte?s=" + encodeURIComponent(v)); neuZeichnen(); setTimeout(() => { const i = document.querySelector(".suche input"); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } }, 30); }, 250); }, "Name, Praxis, Telefon …");
  return mitPlus(seite(kopf("Kontakte", [neuKnopf("Kontakt", () => bearbeiten("kontakt"))]), sf,
    xs.length ? KONTAKT_KAT.filter(k => nach[k]).map(k => [h("div", { class: "gruppe-titel" }, (k === "Notfall" ? "🚨 " : "") + k),
      h("ul", { class: "liste karte knapp" }, nach[k].map(e => h("li", { class: "zeile klickbar", onclick: () => bearbeiten("kontakt", e) },
        h("span", { class: "haupt" }, h("span", { class: "titel" }, e.titel), h("span", { class: "unter" }, [e.daten.firma, e.daten.telefon].filter(Boolean).join(" · "))),
        h("span", { class: "rechts" }, sichtEtikett(e),
          e.daten.telefon ? h("a", { class: "knopf rund klein", href: "tel:" + e.daten.telefon.replace(/[^\d+]/g, ""), "aria-label": "Anrufen", onclick: ev => ev.stopPropagation() }, ic("telefon")) : null,
          e.daten.email ? h("a", { class: "knopf rund klein", href: "mailto:" + e.daten.email, "aria-label": "E-Mail", onclick: ev => ev.stopPropagation() }, ic("mail")) : null,
          e.daten.adresse ? h("a", { class: "knopf rund klein", href: "https://maps.apple.com/?q=" + encodeURIComponent(e.daten.adresse), target: "_blank", rel: "noopener", "aria-label": "Karte", onclick: ev => ev.stopPropagation() }, ic("ort")) : null))))])
      : leer("📇", such ? "Nichts gefunden." : "Noch keine Kontakte. Tipp: Kinderarzt, Tierarzt, Notfallnummern zuerst.")), () => bearbeiten("kontakt"));
};

/* ---------- Geburtstage ---------- */
FORMULARE.geburtstag = {
  titel: "Geburtstag",
  felder: () => [
    { key: "titel", text: "Name", pflicht: true },
    { key: "datum", text: "Geburtsdatum", art: "datum", pflicht: true, hilfe: "Jahr unbekannt? 1900 wählen – dann ohne Alter." },
    { key: "d.beziehung", text: "Wer ist das?", platz: "z. B. Gotte, Arbeitskollegin" },
    { key: "d.ideen", text: "Geschenkideen", art: "textarea", zeilen: 4 },
  ],
};
V.geburtstage = function () {
  const xs = geburtstagsListe();
  const monate = {};
  for (const g of xs) { const k = g.naechster.getFullYear() * 100 + g.naechster.getMonth(); (monate[k] = monate[k] || []).push(g); }
  const ohne = menschen().filter(p => !p.geburtstag);
  return mitPlus(seite(kopf("Geburtstage", [neuKnopf("Geburtstag", () => bearbeiten("geburtstag"))]),
    xs.length ? Object.entries(monate).map(([k, gs]) => [h("div", { class: "gruppe-titel" }, MONATE[k % 100] + " " + Math.floor(k / 100)),
      h("ul", { class: "liste karte knapp" }, gs.map(g => h("li", { class: "zeile klickbar", onclick: () => g.quelle === "eintrag" ? bearbeiten("geburtstag", g.obj) : g.quelle === "kontakt" ? bearbeiten("kontakt", g.obj) : location.hash = "#/mitglieder/" + g.obj.id },
        g.quelle === "person" ? ava(g.obj, "mini") : h("span", null, "🎂"),
        h("span", { class: "haupt" }, h("span", { class: "titel" }, g.name), h("span", { class: "unter" }, [WT[g.naechster.getDay()] + ", " + fmtDatum(iso(g.naechster), false),
          g.alter !== null ? `wird ${g.alter}` : null, g.obj.daten && g.obj.daten.beziehung, g.obj.daten && g.obj.daten.ideen ? "🎁 Ideen" : null].filter(Boolean).join(" · "))),
        h("span", { class: "etikett" + (g.tage === 0 ? " warn" : g.tage <= 7 ? " gelb" : "") }, g.tage === 0 ? "heute 🎉" : g.tage === 1 ? "morgen" : `in ${g.tage} Tagen`))))])
      : leer("🎂", "Noch keine Geburtstage."),
    ohne.length ? h("p", { class: "klein leise" }, "Noch ohne Geburtstag: ", ohne.map((p, i) => [i ? ", " : "", h("a", { href: "#/mitglieder/" + p.id }, p.name)])) : null,
    h("p", { class: "klein leise" }, "Erinnerung: eine Woche vorher und am Tag selbst (unter Hinweise).")), () => bearbeiten("geburtstag"));
};

/* ---------- Kalender ---------- */
FORMULARE.termin = {
  titel: "Termin",
  felder: e => [
    { key: "titel", text: "Was?", pflicht: true },
    { key: "d.ganztags", text: "Ganztägig", art: "haken", nachher: (el, els) => {
      const umschalten = () => { const an = el._cb.checked; els.forEach(([f, x]) => { if (f.key === "datum_z" || f.key === "d.ende_z") x.classList.toggle("versteckt", an); if (f.key === "datum_t" || f.key === "d.ende_t") x.classList.toggle("versteckt", !an); }); };
      el._cb.addEventListener("change", umschalten); setTimeout(umschalten, 0); } },
    { key: "datum_t", text: "Datum", art: "datum", halb: true, std: () => (e.datum || heuteIso()).slice(0, 10) },
    { key: "d.ende_t", text: "Bis (optional)", art: "datum", halb: true, std: () => e.daten.ende && e.daten.ende.slice(0, 10) },
    { key: "datum_z", text: "Beginn", art: "datumzeit", halb: true, std: () => e.datum && e.datum.length > 10 ? e.datum : (e.datum || heuteIso()).slice(0, 10) + "T" + String(Math.min(new Date().getHours() + 1, 23)).padStart(2, "0") + ":00" },
    { key: "d.ende_z", text: "Ende", art: "datumzeit", halb: true, std: () => e.daten.ende && e.daten.ende.length > 10 ? e.daten.ende : "" },
    { key: "d.ort", text: "Ort", halb: true },
    { key: "d.wiederholung", text: "Wiederholen", art: "auswahl", optionen: WIEDERHOLUNG, halb: true },
    { key: "d.wer", text: "Wer ist dabei?", art: "personen", optionen: () => aktive() },
    { key: "d.notiz", text: "Notiz", art: "textarea", zeilen: 3 },
  ],
  vorher: res => {
    const g = res.daten.ganztags;
    res.datum = g ? res.datum_t : res.datum_z; res.daten.ende = (g ? res.daten.ende_t : res.daten.ende_z) || null;
    delete res.datum_t; delete res.datum_z; res.daten.ende_t = null; res.daten.ende_z = null;
    if (!res.datum) throw meldung("Datum fehlt");
    if (res.datum.length > 16) res.datum = res.datum.slice(0, 16);
    if (res.daten.ende && res.daten.ende.length > 16) res.daten.ende = res.daten.ende.slice(0, 16);
    if (!g && res.daten.ende && res.daten.ende < res.datum) throw meldung("Ende liegt vor dem Beginn");
  },
};
// Der Formular-Kern kennt nur echte Felder; datum_t/datum_z werden in «vorher» zusammengeführt.
FORMULARE.termin.felder = (orig => e => orig(e).map(f => f.key === "d.ganztags" ? Object.assign(f, { std: e.id && e.datum ? e.datum.length <= 10 : false }) : f))(FORMULARE.termin.felder);
V.kalender = function (args, q) {
  const gew = q.get("tag") || heuteIso();
  const gd = alsDatum(gew);
  const monatStart = new Date(gd.getFullYear(), gd.getMonth(), 1);
  const rasterStart = montag(monatStart);
  const tage = [...Array(42)].map((_, i) => plusTage(rasterStart, i));
  const evs = ereignisse(tage[0], tage[41]);
  const nach = {};
  for (const x of evs) (nach[x.datum.slice(0, 10)] = nach[x.datum.slice(0, 10)] || []).push(x);
  const geh = d => location.hash = "#/kalender?tag=" + iso(d);
  const monatEl = h("div", { class: "monat" }, ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(w => h("div", { class: "wt" }, w)),
    tage.map(d => { const di = iso(d), xs = nach[di] || [];
      return h("div", { class: "tag" + (d.getMonth() !== gd.getMonth() ? " anders" : "") + (di === heuteIso() ? " heute" : "") + (di === gew ? " gewaehlt" : ""), onclick: () => geh(d), ondblclick: () => bearbeiten("termin", null, { datum: di }) },
        h("span", { class: "nr" }, d.getDate()), xs.slice(0, 4).map(x => h("div", { class: "ev" + (x.art === "geburtstag" ? " geb" : x.art === "aufgabe" ? " auf" : "") }, (zeitTeil(x.datum) ? zeitTeil(x.datum) + " " : "") + x.titel)),
        xs.length > 4 ? h("div", { class: "klein leise" }, "+" + (xs.length - 4)) : null); }));
  const tagEvs = nach[gew] || [];
  const tagKarte = h("div", { class: "karte" }, h("div", { class: "karte-kopf" }, h("h2", null, fmtLang(gew)), h("span", { class: "rechts" }, knopf("Termin", () => bearbeiten("termin", null, { datum: gew }), "klein", "plus"))),
    tagEvs.length ? h("ul", { class: "liste" }, tagEvs.map(x => h("li", { class: "zeile klickbar", onclick: () => x.art === "termin" ? bearbeiten("termin", x.e) : x.art === "aufgabe" ? bearbeiten("aufgabe", x.e) : location.hash = x.link },
      x.art === "aufgabe" ? checkKnopf(false, () => abhaken(x.e)) : h("span", { class: "etikett" + (x.art === "termin" ? " gut" : x.art === "geburtstag" ? " gelb" : "") }, zeitTeil(x.datum) || "ganztags"),
      h("span", { class: "haupt" }, h("span", { class: "titel" }, x.titel), x.e && x.e.daten ? h("span", { class: "unter" }, [x.e.daten.ort, x.e.daten.ende && x.e.daten.ende.length > 10 ? "bis " + zeitTeil(x.e.daten.ende) : null,
        x.e.daten.wiederholung ? "↻ " + WH_NAME[x.e.daten.wiederholung] : null, (x.e.daten.wer || []).map(name).join(", ")].filter(Boolean).join(" · ")) : null),
      x.e && x.art === "termin" ? h("span", { class: "rechts" }, sichtEtikett(x.e)) : null))) : leer("🌤", "Nichts geplant."));
  // Agenda: nächste 30 Tage
  const ag = ereignisse(alsDatum(heuteIso()), plusTage(alsDatum(heuteIso()), 30)).filter(x => x.art !== "aufgabe").slice(0, 12);
  const agenda = h("div", { class: "karte" }, h("h2", null, "Demnächst"), ag.length ? h("ul", { class: "liste" }, ag.map(x => h("li", { class: "zeile klickbar", onclick: () => geh(alsDatum(x.datum)) },
    h("span", { class: "etikett" }, fmtRelativ(x.datum.slice(0, 10))), h("span", { class: "haupt" }, h("span", { class: "titel" }, (zeitTeil(x.datum) ? zeitTeil(x.datum) + " " : "") + x.titel))))) : h("p", { class: "leise" }, "Nichts in den nächsten 30 Tagen."));
  return mitPlus(seite(kopf(MONATE[gd.getMonth()] + " " + gd.getFullYear(), [
    knopf("", () => geh(new Date(gd.getFullYear(), gd.getMonth() - 1, 1)), "rund", "links"), knopf("Heute", () => geh(new Date())),
    knopf("", () => geh(new Date(gd.getFullYear(), gd.getMonth() + 1, 1)), "rund", "rechts"), neuKnopf("Termin", () => bearbeiten("termin", null, { datum: gew }))]),
    h("div", { class: "zwei" }, h("div", null, monatEl, h("p", { class: "klein leise" }, "Termine, fällige Aufgaben, Geburtstage, MFK und Tierarzt-Erinnerungen an einem Ort. Kalender-Abo fürs iPhone: ", h("a", { href: "#/einstellungen" }, "Einstellungen"), ".")),
      h("div", { class: "stapel" }, tagKarte, agenda))), () => bearbeiten("termin", null, { datum: gew }));
};
