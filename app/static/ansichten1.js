/* Hüsli – Übersicht, Aufgaben, Projekte, Einkauf, Ausgaben */
"use strict";

/* ---------- gemeinsame Auswertungen ---------- */
function naechstesDatum(d, w) {
  const x = new Date(d);
  if (w === "taeglich") x.setDate(x.getDate() + 1);
  else if (w === "woechentlich") x.setDate(x.getDate() + 7);
  else if (w === "zweiwoechentlich") x.setDate(x.getDate() + 14);
  else if (w === "monatlich" || w === "quartal" || w === "jaehrlich") {
    const n = w === "monatlich" ? 1 : w === "quartal" ? 3 : 12, tag = d.getDate();
    x.setDate(1); x.setMonth(x.getMonth() + n);
    x.setDate(Math.min(tag, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()));
  } else return null;
  return x;
}
function jahrestag(datumIso, ab) {
  const d = alsDatum(datumIso); if (!d) return null;
  for (const j of [ab.getFullYear(), ab.getFullYear() + 1]) {
    let x = new Date(j, d.getMonth(), d.getDate());
    if (x.getMonth() !== d.getMonth()) x = new Date(j, 1, 28);
    if (x >= ab) return x;
  }
  return null;
}
function geburtstagsListe() {
  const ab = alsDatum(heuteIso()), aus = [];
  const add = (nameT, datumIso, quelle, obj) => {
    const n = jahrestag(datumIso, ab); if (!n) return;
    const j = alsDatum(datumIso).getFullYear();
    aus.push({ name: nameT, datum: datumIso, naechster: n, tage: Math.round((n - ab) / 864e5), alter: j > 1900 ? n.getFullYear() - j : null, quelle, obj });
  };
  if (S.module.includes("geburtstage") || S.module.includes("kalender")) {
    for (const p of aktive()) if (p.geburtstag) add(p.name, p.geburtstag, "person", p);
    for (const e of alle("geburtstag")) if (e.datum) add(e.titel, e.datum, "eintrag", e);
    for (const e of alle("kontakt")) if (e.daten.geburtstag) add(e.titel, e.daten.geburtstag, "kontakt", e);
  }
  return aus.sort((a, b) => a.tage - b.tage);
}
/* Alle Ereignisse zwischen von und bis (Date, inkl.) → [{datum, titel, art, link, e, fertig}] */
function ereignisse(von, bis) {
  const aus = [], vonI = iso(von), bisI = iso(bis);
  const drin = s => s && s.slice(0, 10) >= vonI && s.slice(0, 10) <= bisI;
  for (const e of alle("termin")) {
    if (!e.datum) continue;
    const w = e.daten.wiederholung;
    let d = alsDatum(e.datum), n = 0;
    const zeit = e.datum.length > 10 ? e.datum.slice(10) : "";
    const ende = e.daten.bis_datum ? alsDatum(e.daten.bis_datum) : null;
    while (d && d <= bis && n < 800) {
      if (ende && d > ende) break;
      const s = iso(d) + zeit;
      if (drin(s) || (e.daten.ende && !w && s.slice(0, 10) < vonI && e.daten.ende.slice(0, 10) >= vonI)) aus.push({ datum: drin(s) ? s : vonI + zeit, titel: e.titel, art: "termin", link: "#/kalender?tag=" + iso(d), e });
      if (!w) break;
      d = naechstesDatum(d, w); n++;
    }
  }
  for (const e of alle("aufgabe")) if (!e.erledigt && drin(e.datum)) aus.push({ datum: e.datum, titel: e.titel, art: "aufgabe", link: "#/aufgaben", e });
  for (const g of geburtstagsListe()) {
    const s = iso(g.naechster);
    if (drin(s)) aus.push({ datum: s, titel: `🎂 ${g.name}` + (g.alter ? ` (${g.alter})` : ""), art: "geburtstag", link: "#/geburtstage" });
    // auch das Jahr danach (bei langen Bereichen)
    const s2 = iso(new Date(g.naechster.getFullYear() + 1, g.naechster.getMonth(), g.naechster.getDate()));
    if (drin(s2)) aus.push({ datum: s2, titel: `🎂 ${g.name}`, art: "geburtstag", link: "#/geburtstage" });
  }
  for (const e of alle("fahrzeug")) for (const [k, t] of [["mfk", "MFK"], ["service", "Service"], ["versicherung", "Versicherung"]])
    if (drin(e.daten[k])) aus.push({ datum: e.daten[k], titel: `🚗 ${t}: ${e.titel}`, art: "fahrzeug", link: "#/fahrzeuge/" + e.id });
  for (const e of alle("tier_eintrag")) if (!e.erledigt && drin(e.daten.naechstes))
    aus.push({ datum: e.daten.naechstes, titel: `🐾 ${e.titel} (${name(e.daten.tier_id)})`, art: "tier", link: "#/haustiere/" + e.daten.tier_id });
  for (const e of alle("menu")) if (drin(e.datum)) aus.push({ datum: e.datum, titel: "🍽 " + menuTitel(e), art: "menu", link: "#/rezepte?ansicht=plan" });
  return aus.sort((a, b) => (a.datum.length > 10 ? a.datum : a.datum + "T00:00") < (b.datum.length > 10 ? b.datum : b.datum + "T00:00") ? -1 : 1);
}
function menuTitel(e) { const r = e.daten.rezept_id && S.E.get(e.daten.rezept_id); return r ? r.titel : e.titel; }
function meineAufgabe(e) { return e.zugewiesen_id === S.ich.id || (!e.zugewiesen_id && (e.haushalt_id === S.ich.haushalt_id || e.besitzer_id === S.ich.id)); }

/* ---------- Übersicht ---------- */
function gruss() {
  const s = new Date().getHours();
  return s < 5 ? "Gute Nacht" : s < 11 ? "Guten Morgen" : s < 14 ? "Grüezi" : s < 18 ? "Guten Nachmittag" : "Guten Abend";
}
V.uebersicht = function () {
  const heute = heuteIso(), jetztD = alsDatum(heute);
  const offen = S.module.includes("aufgaben") ? alle("aufgabe", e => !e.erledigt && meineAufgabe(e)) : [];
  const ueber = offen.filter(e => e.datum && e.datum.slice(0, 10) < heute).sort((a, b) => a.datum < b.datum ? -1 : 1);
  const heuteA = offen.filter(e => e.datum && e.datum.slice(0, 10) === heute);
  const evHeute = ereignisse(jetztD, jetztD).filter(x => x.art !== "aufgabe");
  const woche = ereignisse(plusTage(jetztD, 1), plusTage(jetztD, 7));
  const einkauf = S.module.includes("einkauf") ? alle("einkauf", e => !e.erledigt).length : 0;
  const kacheln = h("div", { class: "kacheln" },
    S.module.includes("aufgaben") ? h("a", { class: "kachel" + (ueber.length ? " warn" : ""), href: "#/aufgaben" }, h("span", { class: "zahl" }, ueber.length + heuteA.length), h("span", { class: "text" }, ueber.length ? `fällig, ${ueber.length} überfällig` : "heute fällig")) : null,
    S.module.includes("kalender") ? h("a", { class: "kachel", href: "#/kalender" }, h("span", { class: "zahl" }, evHeute.length), h("span", { class: "text" }, "Termine heute")) : null,
    S.module.includes("einkauf") ? h("a", { class: "kachel", href: "#/einkauf" }, h("span", { class: "zahl" }, einkauf), h("span", { class: "text" }, "auf der Einkaufsliste")) : null,
    S.module.includes("ausgaben") ? ausgabenKachel() : null,
    h("a", { class: "kachel" + (S.hinweise ? " warn" : ""), href: "#/hinweise" }, h("span", { class: "zahl" }, S.hinweise), h("span", { class: "text" }, "neue Hinweise")));

  const zeileAufgabe = e => h("li", { class: "zeile" }, checkKnopf(false, () => abhaken(e)),
    h("span", { class: "haupt" }, h("span", { class: "titel" }, e.titel),
      h("span", { class: "unter" }, [e.datum ? fmtRelativ(e.datum) : "", e.daten.wiederholung ? " · ↻ " + WH_NAME[e.daten.wiederholung] : "", e.zugewiesen_id && e.zugewiesen_id !== S.ich.id ? " · " + name(e.zugewiesen_id) : ""].join(""))),
    e.datum && e.datum.slice(0, 10) < heute ? h("span", { class: "etikett warn" }, "überfällig") : null);
  const zeileEv = x => h("li", { class: "zeile klickbar", onclick: () => location.hash = x.link },
    h("span", { class: "etikett" + (x.art === "geburtstag" ? " gelb" : x.art === "termin" ? " gut" : "") }, zeitTeil(x.datum) || (x.art === "aufgabe" ? "☐" : x.art === "menu" ? "Essen" : "ganztags")),
    h("span", { class: "haupt" }, h("span", { class: "titel" }, x.titel), x.e && x.e.daten && x.e.daten.ort ? h("span", { class: "unter" }, x.e.daten.ort) : null));

  const heuteKarte = h("section", { class: "karte" }, h("div", { class: "karte-kopf" }, h("h2", null, "Heute"), h("span", { class: "leise klein" }, fmtLang(heute))),
    (ueber.length + heuteA.length + evHeute.length) === 0 ? leer("☀️", "Nichts fällig heute. Schön!") :
      h("ul", { class: "liste" }, evHeute.map(zeileEv), ueber.map(zeileAufgabe), heuteA.map(zeileAufgabe)));
  const wocheGruppen = {};
  for (const x of woche) (wocheGruppen[x.datum.slice(0, 10)] = wocheGruppen[x.datum.slice(0, 10)] || []).push(x);
  const wocheKarte = h("section", { class: "karte" }, h("div", { class: "karte-kopf" }, h("h2", null, "Die nächsten 7 Tage"), h("a", { class: "rechts klein", href: "#/kalender" }, "Kalender")),
    woche.length ? Object.entries(wocheGruppen).map(([d, xs]) => [h("div", { class: "gruppe-titel" }, fmtRelativ(d) === "morgen" ? "Morgen" : fmtLang(d)), h("ul", { class: "liste" }, xs.map(zeileEv))]) : leer("🗓", "Keine Termine in den nächsten Tagen."));

  const gebs = geburtstagsListe().slice(0, 4);
  const gebKarte = S.module.includes("geburtstage") && gebs.length ? h("section", { class: "karte" }, h("div", { class: "karte-kopf" }, h("h2", null, "Geburtstage"), h("a", { class: "rechts klein", href: "#/geburtstage" }, "Alle")),
    h("ul", { class: "liste" }, gebs.map(g => h("li", { class: "zeile" }, h("span", { class: "haupt" }, h("span", { class: "titel" }, g.name), h("span", { class: "unter" }, fmtDatum(iso(g.naechster), false) + (g.alter ? ` · wird ${g.alter}` : ""))),
      h("span", { class: "etikett" + (g.tage <= 7 ? " gelb" : "") }, g.tage === 0 ? "heute 🎉" : g.tage === 1 ? "morgen" : `in ${g.tage} T.`))))) : null;

  const listen = S.module.includes("einkauf") ? alle("einkauf_liste") : [];
  const einkaufKarte = listen.length ? h("section", { class: "karte" }, h("div", { class: "karte-kopf" }, h("h2", null, "Einkauf")),
    h("ul", { class: "liste" }, listen.map(l => { const n = kinder(l.id, "einkauf").filter(x => !x.erledigt);
      return h("li", { class: "zeile klickbar", onclick: () => location.hash = "#/einkauf/" + l.id }, h("span", null, l.daten.emoji || "🛒"),
        h("span", { class: "haupt" }, h("span", { class: "titel" }, l.titel), h("span", { class: "unter" }, n.slice(0, 5).map(x => x.titel).join(", ") || "leer")),
        h("span", { class: "etikett" }, n.length)); }))) : null;

  const tierKarte = S.module.includes("haustiere") && tiere().length ? h("section", { class: "karte" }, h("div", { class: "karte-kopf" }, h("h2", null, "Haustiere"), h("a", { class: "rechts klein", href: "#/haustiere" }, "Öffnen")),
    h("div", { class: "familie-reihe" }, tiere().map(t => { const f = tierFaellig(t.id)[0];
      return h("a", { class: "mitglied", href: "#/haustiere/" + t.id, style: { width: "auto", "flex-direction": "row", gap: "8px" } }, ava(t), h("span", { style: { "text-align": "left" } }, h("b", null, t.name), h("br"),
        h("span", { class: "klein leise" }, f ? `${f.titel} ${fmtRelativ(f.daten.naechstes)}` : "nichts fällig"))); }))) : null;

  const akt = h("section", { class: "karte" }, h("div", { class: "karte-kopf" }, h("h2", null, "Zuletzt in der Familie")), h("div", { class: "leise klein" }, "Lädt …"));
  api("GET", "/aktivitaet").then(d => {
    const xs = d.aktivitaet.slice(0, 8);
    akt.lastChild.replaceWith(xs.length ? h("ul", { class: "liste" }, xs.map(a => h("li", { class: "zeile klickbar", onclick: () => location.hash = linkFuer(a) },
      ava(person(a.person_id), "mini"), h("span", { class: "haupt" }, h("span", { class: "titel" }, a.titel || TYP_NAME[a.typ] || a.typ),
        h("span", { class: "unter" }, `${name(a.person_id)} · ${a.aktion} · ${TYP_NAME[a.typ] || ""} · ${fmtVor(a.zeit)}`))))) : leer("🌱", "Noch nichts passiert."));
  }).catch(() => {});

  const familie = h("section", { class: "karte" }, h("div", { class: "karte-kopf" }, h("h2", null, "Familie"), h("a", { class: "rechts klein", href: "#/mitglieder" }, "Alle")),
    S.haushalte.map(hh => { const ps = aktive().filter(p => p.haushalt_id === hh.id); if (!ps.length) return null;
      return [h("div", { class: "gruppe-titel" }, hh.emoji + " " + hh.name), h("div", { class: "familie-reihe" }, ps.map(p => h("a", { class: "mitglied", href: "#/mitglieder/" + p.id }, ava(p), p.name)))]; }));

  return mitPlus(seite(
    h("div", { class: "gruss" }, h("h1", null, `${gruss()}, ${S.ich.name}`)), h("div", { class: "leise" }, fmtLang(heute)),
    kacheln,
    h("div", { class: "zwei" }, h("div", { class: "stapel" }, heuteKarte, wocheKarte, akt), h("div", { class: "stapel" }, einkaufKarte, gebKarte, tierKarte, familie))), schnellNeu);
};
const TYP_NAME = { aufgabe: "Aufgabe", projekt: "Projekt", einkauf_liste: "Einkaufsliste", einkauf: "Einkauf", ausgaben_topf: "Kasse", ausgabe: "Ausgabe",
  notiz: "Notiz", rezept: "Rezept", menu: "Menüplan", kontakt: "Kontakt", geburtstag: "Geburtstag", termin: "Termin", vorrat: "Vorrat",
  fahrzeug: "Fahrzeug", fahrzeug_eintrag: "Fahrtenbuch", tier_eintrag: "Haustier" };
function linkFuer(a) {
  const e = S.E.get(a.eintrag_id) || a;
  switch (a.typ) {
    case "einkauf": return "#/einkauf/" + (e.eltern_id || "");
    case "einkauf_liste": return "#/einkauf/" + a.eintrag_id;
    case "ausgabe": return "#/ausgaben/" + (e.eltern_id || "");
    case "ausgaben_topf": return "#/ausgaben/" + a.eintrag_id;
    case "aufgabe": return e.eltern_id ? "#/projekte/" + e.eltern_id : "#/aufgaben";
    case "projekt": return "#/projekte/" + a.eintrag_id;
    case "rezept": return "#/rezepte/" + a.eintrag_id;
    case "fahrzeug": return "#/fahrzeuge/" + a.eintrag_id;
    case "fahrzeug_eintrag": return "#/fahrzeuge/" + (e.eltern_id || "");
    case "tier_eintrag": return "#/haustiere/" + ((e.daten && e.daten.tier_id) || "");
    case "menu": return "#/rezepte?ansicht=plan";
    case "termin": return "#/kalender";
    default: return "#/" + ({ notiz: "notizen", kontakt: "kontakte", geburtstag: "geburtstage", vorrat: "vorrat" }[a.typ] || "");
  }
}
function schnellNeu() {
  const wahl = [["aufgabe", "✅ Aufgabe", "aufgaben"], ["termin", "📅 Termin", "kalender"], ["einkauf", "🛒 Auf die Einkaufsliste", "einkauf"],
    ["ausgabe", "💸 Ausgabe", "ausgaben"], ["notiz", "📝 Notiz", "notizen"], ["geburtstag", "🎂 Geburtstag", "geburtstage"], ["kontakt", "📇 Kontakt", "kontakte"]]
    .filter(w => S.module.includes(w[2]));
  const zu = dialog("Neu", h("div", { class: "stapel" }, wahl.map(([t, n]) => h("button", { class: "knopf", type: "button", style: { width: "100%", "justify-content": "flex-start" },
    onclick: () => { zu(); if (t === "einkauf") { const l = alle("einkauf_liste")[0]; if (l) location.hash = "#/einkauf/" + l.id; else bearbeiten("einkauf_liste"); }
      else if (t === "ausgabe") { const k = alle("ausgaben_topf")[0]; if (k) ausgabeNeu(k); else bearbeiten("ausgaben_topf"); } else bearbeiten(t); } }, n))));
}
function ausgabenKachel() {
  let summe = 0;
  for (const t of alle("ausgaben_topf")) summe += (salden(t).netto[S.ich.id] || 0);
  return h("a", { class: "kachel", href: "#/ausgaben" }, h("span", { class: "zahl " + (summe < -0.004 ? "minus-betrag" : summe > 0.004 ? "plus-betrag" : "") }, chf(summe).replace("CHF ", "")),
    h("span", { class: "text" }, summe < -0.004 ? "CHF schuldest du" : summe > 0.004 ? "CHF bekommst du" : "CHF – alles ausgeglichen"));
}

/* ---------- Aufgaben ---------- */
const PRIO = [["", "Normal"], ["hoch", "Wichtig"], ["tief", "Irgendwann"]];
FORMULARE.aufgabe = {
  titel: "Aufgabe",
  felder: e => [
    { key: "titel", text: "Was ist zu tun?", pflicht: true, max: 300 },
    { key: "datum", text: "Fällig am", art: "datum", halb: true },
    { key: "zugewiesen_id", text: "Wer?", art: "auswahl", zahlen: true, halb: true, optionen: () => [["", "Niemand bestimmt"], ...menschen().map(p => [p.id, p.name + (p.haushalt_id !== S.ich.haushalt_id ? " (" + (haushalt(p.haushalt_id) || {}).name + ")" : "")])] },
    { key: "d.wiederholung", text: "Wiederholen", art: "auswahl", optionen: WIEDERHOLUNG, halb: true },
    { key: "d.prioritaet", text: "Wichtigkeit", art: "auswahl", optionen: PRIO, halb: true },
    { key: "d.reihum", text: "Reihum (Ämtli) – nach dem Erledigen ist der/die Nächste dran", art: "personen", optionen: () => menschen().filter(p => p.rolle !== "kind") },
    { key: "eltern_id", text: "Projekt", art: "auswahl", zahlen: true, optionen: () => [["", "Kein Projekt"], ...alle("projekt", p => p.daten.status !== "fertig").map(p => [p.id, p.titel])], zeigen: x => !x || !x.id },
    { key: "d.tier_id", text: "Betrifft Haustier", art: "auswahl", zahlen: true, optionen: () => [["", "—"], ...tiere().map(p => [p.id, p.name])], zeigen: () => tiere().length > 0 },
    { key: "d.notiz", text: "Notiz", art: "textarea", zeilen: 3 },
  ],
  vorher: (res, start) => { if (res.eltern_id) { /* erbt Sichtbarkeit vom Projekt */ } else delete res.eltern_id; if (start.id) delete res.eltern_id; },
};
V.aufgaben = function (args, q) {
  const filter = q.get("f") || "meine";
  const such = q.get("s") || "";
  let xs = alle("aufgabe");
  const heute = heuteIso();
  if (filter === "meine") xs = xs.filter(meineAufgabe);
  else if (filter === "haushalt") xs = xs.filter(e => e.haushalt_id === S.ich.haushalt_id);
  if (such) xs = xs.filter(e => normal(e.titel + " " + (e.daten.notiz || "")).includes(normal(such)));
  const offen = xs.filter(e => !e.erledigt), fertig = xs.filter(e => e.erledigt).sort((a, b) => (b.daten.erledigt_am || "") < (a.daten.erledigt_am || "") ? -1 : 1);
  const gruppen = [["Überfällig", e => e.datum && e.datum.slice(0, 10) < heute], ["Heute", e => e.datum && e.datum.slice(0, 10) === heute],
    ["Morgen", e => e.datum && tageBis(e.datum) === 1], ["Diese Woche", e => e.datum && tageBis(e.datum) > 1 && tageBis(e.datum) <= 7],
    ["Später", e => e.datum && tageBis(e.datum) > 7], ["Ohne Datum", e => !e.datum]];
  const sortiert = a => a.sort((x, y) => (x.daten.prioritaet === "hoch" ? 0 : 1) - (y.daten.prioritaet === "hoch" ? 0 : 1) || ((x.datum || "9") < (y.datum || "9") ? -1 : 1));
  const zeile = e => h("li", { class: "zeile klickbar" + (e.erledigt ? " fertig" : ""), onclick: () => bearbeiten("aufgabe", e) },
    checkKnopf(!!e.erledigt, () => abhaken(e)),
    h("span", { class: "haupt" }, h("span", { class: "titel" }, e.daten.prioritaet === "hoch" ? "❗ " : "", e.titel),
      h("span", { class: "unter" }, [e.datum ? fmtRelativ(e.datum) : null, e.daten.wiederholung ? "↻ " + WH_NAME[e.daten.wiederholung] : null,
        e.daten.reihum && e.daten.reihum.length ? "reihum" : null, e.eltern_id && S.E.get(e.eltern_id) ? "📁 " + S.E.get(e.eltern_id).titel : null,
        e.erledigt && e.daten.erledigt_von ? `erledigt von ${name(e.daten.erledigt_von)} ${fmtVor(e.daten.erledigt_am)}` : null].filter(Boolean).join(" · "))),
    h("span", { class: "rechts" }, sichtEtikett(e), e.zugewiesen_id ? ava(person(e.zugewiesen_id), "mini") : null));
  const setz = (k, v) => { const p = new URLSearchParams(q); p.set(k, v); location.hash = "#/aufgaben?" + p; };
  const inhalt = offen.length || fertig.length ? h("div", null,
    gruppen.map(([t, f]) => { const g = sortiert(offen.filter(f)); return g.length ? [h("div", { class: "gruppe-titel" }, t + " · " + g.length), h("ul", { class: "liste karte knapp" }, g.map(zeile))] : null; }),
    fertig.length ? h("details", { style: { "margin-top": "14px" } }, h("summary", { class: "leise" }, `Erledigt (${fertig.length})`), h("ul", { class: "liste karte knapp" }, fertig.slice(0, 50).map(zeile))) : null)
    : leer("✅", "Keine Aufgaben. Leg eine an – z. B. ein Ämtli, das reihum geht.");
  const schnell = h("input", { class: "eingabe", placeholder: "Schnell hinzufügen … (Enter)", onkeydown: async ev => {
    if (ev.key === "Enter" && schnell.value.trim()) { ev.preventDefault(); const t = schnell.value.trim(); schnell.value = "";
      await neu("aufgabe", { titel: t, sicht: "haushalt", zugewiesen_id: filter === "meine" ? S.ich.id : null, daten: {} }); setTimeout(() => document.querySelector(".schnell input")?.focus(), 50); } } });
  return mitPlus(seite(kopf("Aufgaben", [neuKnopf("Aufgabe", () => bearbeiten("aufgabe"))]),
    h("div", { class: "kopf" }, h("div", { class: "segment" }, [["meine", "Meine"], ["haushalt", "Haushalt"], ["alle", "Alle"]].map(([k, t]) =>
      h("button", { class: filter === k ? "an" : "", onclick: () => setz("f", k) }, t)))),
    h("div", { class: "schnell" }, schnell), inhalt), () => bearbeiten("aufgabe"));
};

/* ---------- Projekte ---------- */
const PROJEKT_STATUS = [["aktiv", "Aktiv"], ["geplant", "Geplant"], ["pausiert", "Pausiert"], ["fertig", "Fertig"]];
FORMULARE.projekt = {
  titel: "Projekt",
  felder: () => [
    { key: "titel", text: "Name", pflicht: true, platz: "z. B. Umzug, Ferien Tessin, Kinderzimmer" },
    { key: "d.status", text: "Status", art: "auswahl", optionen: PROJEKT_STATUS, std: "aktiv", halb: true },
    { key: "datum", text: "Ziel bis", art: "datum", halb: true },
    { key: "d.emoji", text: "Symbol", platz: "📦", halb: true, max: 8 },
    { key: "d.budget", text: "Budget (CHF)", art: "zahl", halb: true },
    { key: "d.beschreibung", text: "Beschreibung", art: "textarea", zeilen: 4 },
  ],
  danach: n => { location.hash = "#/projekte/" + n.id; },
};
V.projekte = function (args) {
  if (args[0]) return projektDetail(Number(args[0]));
  const xs = alle("projekt");
  const karte = p => { const t = kinder(p.id, "aufgabe"), f = t.filter(x => x.erledigt).length;
    return h("a", { class: "karte", href: "#/projekte/" + p.id, style: { color: "var(--text)" } },
      h("div", { class: "karte-kopf" }, h("span", { style: { "font-size": "1.5rem" } }, p.daten.emoji || "📁"), h("h2", null, p.titel), h("span", { class: "rechts" }, sichtEtikett(p))),
      h("div", { class: "klein leise" }, (PROJEKT_STATUS.find(s => s[0] === (p.daten.status || "aktiv")) || [])[1], p.datum ? " · bis " + fmtDatum(p.datum) : "", ` · ${f}/${t.length} erledigt`),
      h("div", { class: "balken", style: { "margin-top": "8px" } }, h("i", { style: { width: (t.length ? Math.round(100 * f / t.length) : 0) + "%" } }))); };
  const aktiv = xs.filter(p => p.daten.status !== "fertig"), fertig = xs.filter(p => p.daten.status === "fertig");
  return mitPlus(seite(kopf("Projekte", [neuKnopf("Projekt", () => bearbeiten("projekt"))]),
    xs.length ? [h("div", { class: "raster" }, aktiv.map(karte)), fertig.length ? [h("div", { class: "gruppe-titel" }, "Abgeschlossen"), h("div", { class: "raster" }, fertig.map(karte))] : null]
      : leer("📁", "Noch keine Projekte. Gut für Umzug, Ferienplanung, Renovation …")), () => bearbeiten("projekt"));
};
function projektDetail(id) {
  const p = S.E.get(id);
  if (!p) return leer("🤷", "Projekt nicht gefunden.");
  const t = kinder(id, "aufgabe").sort((a, b) => a.erledigt - b.erledigt || ((a.datum || "9") < (b.datum || "9") ? -1 : 1));
  const schnell = h("input", { class: "eingabe", placeholder: "Teilaufgabe hinzufügen … (Enter)", onkeydown: async ev => {
    if (ev.key === "Enter" && schnell.value.trim()) { ev.preventDefault(); const v = schnell.value.trim(); schnell.value = ""; await neu("aufgabe", { titel: v, eltern_id: id, daten: {} }); setTimeout(() => document.querySelector(".schnell input")?.focus(), 50); } } });
  const f = t.filter(x => x.erledigt).length;
  return mitPlus(seite(kopf((p.daten.emoji || "📁") + " " + p.titel, [knopf("Bearbeiten", () => bearbeiten("projekt", p), "", "stift")], ["#/projekte", "Projekte"]),
    h("div", { class: "zwei" }, h("div", null, h("div", { class: "schnell" }, schnell),
      t.length ? h("ul", { class: "liste karte knapp" }, t.map(e => h("li", { class: "zeile klickbar" + (e.erledigt ? " fertig" : ""), onclick: () => bearbeiten("aufgabe", e) },
        checkKnopf(!!e.erledigt, () => abhaken(e)), h("span", { class: "haupt" }, h("span", { class: "titel" }, e.titel), h("span", { class: "unter" }, e.datum ? fmtRelativ(e.datum) : "")),
        e.zugewiesen_id ? ava(person(e.zugewiesen_id), "mini") : null))) : leer("🧩", "Noch keine Teilaufgaben.")),
      h("div", { class: "karte" }, h("h2", null, "Übersicht"), h("div", { class: "balken" }, h("i", { style: { width: (t.length ? Math.round(100 * f / t.length) : 0) + "%" } })),
        h("p", { class: "leise klein" }, `${f} von ${t.length} erledigt`),
        h("dl", { class: "eigenschaften" }, h("dt", null, "Status"), h("dd", null, (PROJEKT_STATUS.find(s => s[0] === (p.daten.status || "aktiv")) || [])[1]),
          p.datum ? [h("dt", null, "Ziel"), h("dd", null, fmtDatum(p.datum))] : null, p.daten.budget ? [h("dt", null, "Budget"), h("dd", null, chf(p.daten.budget))] : null,
          h("dt", null, "Sichtbar"), h("dd", null, SICHT_NAME[p.sicht])),
        p.daten.beschreibung ? h("p", { style: { "white-space": "pre-wrap" } }, p.daten.beschreibung) : null))), () => bearbeiten("aufgabe", null, { eltern_id: id }));
}

/* ---------- Einkauf ---------- */
const KATEGORIEN = [
  ["Früchte & Gemüse", "apfel banane birne orange zitrone trauben beeren erdbeer himbeer heidelbeer kiwi mango ananas salat gurke tomate peperoni zwiebel knoblauch kartoffel karotte rüebli lauch zucchetti zucchini aubergine broccoli blumenkohl spinat kohl pilze champignon avocado ingwer kräuter petersilie basilikum schnittlauch obst gemüse randen sellerie fenchel kürbis lime"],
  ["Milch & Käse", "milch joghurt jogurt käse butter rahm quark mozzarella feta eier ei mascarpone hüttenkäse gruyere emmentaler parmesan sbrinz raclette fondue frischkäse skyr"],
  ["Brot & Backwaren", "brot zopf gipfeli brötchen toast knäcke weggli baguette tortilla wraps kuchen"],
  ["Fleisch & Fisch", "fleisch poulet huhn hackfleisch rind schwein wurst cervelat schinken speck lachs fisch thon thunfisch crevetten salami bratwurst aufschnitt trockenfleisch"],
  ["Vorrat", "mehl zucker salz pfeffer reis pasta spaghetti nudeln teigwaren magronen hörnli penne fusilli lasagne öl olivenöl essig konserven tomatenpüree passata linsen bohnen kichererbsen haferflocken müesli cornflakes honig konfi marmelade senf ketchup mayo bouillon gewürz backpulver hefe nüsse schokolade kaffee tee kakao sauce polenta couscous"],
  ["Getränke", "wasser mineral sirup saft orangensaft bier wein prosecco cola rivella eistee"],
  ["Tiefkühl", "tiefkühl glace pizza erbsen gefroren tk"],
  ["Haushalt & Drogerie", "wc-papier toilettenpapier haushaltpapier taschentücher abwaschmittel spülmittel waschmittel weichspüler putzmittel kehrichtsack abfallsack zahnpasta zahnbürste shampoo duschgel seife deo windeln feuchttücher batterien glühbirne alufolie frischhaltefolie backpapier schwamm"],
  ["Tier", "katzenfutter katzenstreu streu futter nassfutter trockenfutter leckerli tierfutter"],
  ["Baby & Kind", "babybrei schoppen nuggi pre milchpulver kinder"],
];
function kategorieVon(text) {
  const t = normal(text);
  for (const [k, w] of KATEGORIEN) for (const x of w.split(" ")) if (t.split(/[\s,]+/).some(teil => teil.startsWith(normal(x)) || normal(x).length > 4 && teil.includes(normal(x)))) return k;
  return "Sonstiges";
}
function mengeTrennen(text) {
  const m = text.match(/^\s*(\d+(?:[.,]\d+)?\s*(?:x|stk|stück|kg|g|l|dl|cl|ml|pkt|packung|pack|bund|dose|dosen|flasche|flaschen|becher|glas)?\.?)\s+(.+)$/i);
  return m ? { menge: m[1].trim(), titel: m[2].trim() } : { menge: "", titel: text.trim() };
}
FORMULARE.einkauf_liste = {
  titel: "Einkaufsliste",
  felder: () => [{ key: "titel", text: "Name", pflicht: true, platz: "z. B. Migros, Coop, Landi, Apotheke" }, { key: "d.emoji", text: "Symbol", platz: "🛒", max: 8 }],
  danach: n => { location.hash = "#/einkauf/" + n.id; },
};
FORMULARE.einkauf = {
  titel: "Artikel", sicht: false,
  felder: () => [{ key: "titel", text: "Artikel", pflicht: true }, { key: "d.menge", text: "Menge", halb: true },
    { key: "d.kategorie", text: "Abteilung", art: "auswahl", halb: true, optionen: [["", "Automatisch"], ...KATEGORIEN.map(k => [k[0], k[0]]), ["Sonstiges", "Sonstiges"]] },
    { key: "d.notiz", text: "Notiz", platz: "z. B. Bio, die grosse Packung" }],
};
V.einkauf = function (args) {
  const listen = alle("einkauf_liste");
  if (args[0]) return einkaufListe(Number(args[0]));
  if (listen.length === 1 && !sessionStorage.getItem("einkauf-uebersicht")) { sessionStorage.setItem("einkauf-uebersicht", "1"); setTimeout(() => location.replace("#/einkauf/" + listen[0].id), 0); }
  return mitPlus(seite(kopf("Einkauf", [neuKnopf("Liste", () => bearbeiten("einkauf_liste"))]),
    listen.length ? h("div", { class: "raster" }, listen.map(l => { const n = kinder(l.id, "einkauf").filter(x => !x.erledigt);
      return h("a", { class: "karte", href: "#/einkauf/" + l.id, style: { color: "var(--text)" } }, h("div", { class: "karte-kopf" }, h("span", { style: { "font-size": "1.5rem" } }, l.daten.emoji || "🛒"),
        h("h2", null, l.titel), h("span", { class: "rechts" }, sichtEtikett(l))), h("div", { class: "leise klein" }, n.length ? `${n.length} offen: ` + n.slice(0, 6).map(x => x.titel).join(", ") : "Alles eingekauft 🎉")); }))
      : leer("🛒", "Noch keine Einkaufsliste.", knopf("Liste anlegen", () => bearbeiten("einkauf_liste"), "haupt"))), () => bearbeiten("einkauf_liste"));
};
function einkaufListe(id) {
  const l = S.E.get(id);
  if (!l) return leer("🤷", "Liste nicht gefunden.");
  const xs = kinder(id, "einkauf");
  const offen = xs.filter(x => !x.erledigt), fertig = xs.filter(x => x.erledigt);
  const bekannt = [...new Set(alle("einkauf").map(x => x.titel))].slice(0, 300);
  const eingabe = h("input", { class: "eingabe", placeholder: "Artikel hinzufügen, z. B. «2 l Milch» (Enter)", list: "ek-vorschlag", autocomplete: "off", enterkeyhint: "done",
    onkeydown: async ev => {
      if (ev.key !== "Enter" || !eingabe.value.trim()) return; ev.preventDefault();
      const teile = eingabe.value.split(/\s*[;,]\s*(?=\D)/).filter(Boolean); eingabe.value = "";
      const neue = teile.map(t => { const m = mengeTrennen(t); return { typ: "einkauf", eltern_id: id, titel: m.titel, daten: { menge: m.menge || null, kategorie: kategorieVon(m.titel) } }; });
      // Gleichen offenen Artikel nicht doppelt
      const doppelt = neue.filter(n => offen.some(o => normal(o.titel) === normal(n.titel)));
      const wirklich = neue.filter(n => !doppelt.includes(n));
      if (wirklich.length) { const d = await api("POST", "/eintraege/mehrere", { eintraege: wirklich }); d.eintraege.forEach(merken); }
      for (const n of doppelt) { const o = offen.find(o => normal(o.titel) === normal(n.titel)); meldung(`«${o.titel}» steht schon drauf`); }
      // wieder auf die Liste: erledigte gleiche Artikel entfernen
      for (const n of wirklich) { const f = fertig.find(o => normal(o.titel) === normal(n.titel)); if (f) { await api("DELETE", "/eintraege/" + f.id); S.E.delete(f.id); } }
      neuZeichnen(); setTimeout(() => document.querySelector(".schnell input")?.focus(), 60);
    } });
  const nachKat = {};
  for (const x of offen) { const k = x.daten.kategorie || kategorieVon(x.titel); (nachKat[k] = nachKat[k] || []).push(x); }
  const ordnung = [...KATEGORIEN.map(k => k[0]), "Sonstiges"];
  const zeile = x => h("li", { class: "zeile klickbar" + (x.erledigt ? " fertig" : ""), onclick: () => aendern(x.id, { erledigt: !x.erledigt }) },
    checkKnopf(!!x.erledigt, () => aendern(x.id, { erledigt: !x.erledigt }), true),
    h("span", { class: "haupt" }, h("span", { class: "titel" }, x.daten.menge ? h("b", null, x.daten.menge + " ") : null, x.titel),
      x.daten.notiz || (x.besitzer_id !== S.ich.id) ? h("span", { class: "unter" }, [x.daten.notiz, x.besitzer_id !== S.ich.id ? "von " + name(x.besitzer_id) : ""].filter(Boolean).join(" · ")) : null),
    h("button", { class: "knopf rund klein", "aria-label": "Bearbeiten", onclick: ev => { ev.stopPropagation(); bearbeiten("einkauf", x); } }, ic("stift")));
  return mitPlus(seite(kopf((l.daten.emoji || "🛒") + " " + l.titel, [
    alle("einkauf_liste").length > 1 ? h("a", { class: "knopf", href: "#/einkauf" }, "Alle Listen") : null,
    knopf("", () => bearbeiten("einkauf_liste", l), "rund", "stift")], ["#/einkauf", "Einkauf"]),
    h("div", { class: "schnell" }, eingabe, h("datalist", { id: "ek-vorschlag" }, bekannt.map(b => h("option", { value: b })))),
    offen.length ? ordnung.filter(k => nachKat[k]).map(k => [h("div", { class: "gruppe-titel" }, k), h("ul", { class: "liste karte knapp" }, nachKat[k].map(zeile))])
      : leer("🎉", "Alles eingekauft."),
    fertig.length ? h("div", { style: { "margin-top": "16px" } }, h("div", { class: "kopf" }, h("div", { class: "gruppe-titel", style: { margin: "0" } }, `Im Wagen (${fertig.length})`),
      h("div", { class: "rechts" }, knopf("Erledigte entfernen", async () => {
        for (const x of fertig) { await api("DELETE", "/eintraege/" + x.id); S.E.delete(x.id); } neuZeichnen(); meldung(`${fertig.length} Artikel entfernt`); }, "klein"))),
      h("ul", { class: "liste karte knapp" }, fertig.map(zeile))) : null,
    h("p", { class: "klein leise" }, "Tipp: mehrere Artikel mit Komma trennen. Artikel unter Minimum im Vorrat und Rezept-Zutaten lassen sich direkt hierher schicken.")),
    () => eingabe.focus());
}
async function aufEinkaufsliste(titel, menge, quelle) {
  const listen = alle("einkauf_liste", l => l.haushalt_id === S.ich.haushalt_id).concat(alle("einkauf_liste", l => l.haushalt_id !== S.ich.haushalt_id));
  if (!listen.length) { meldung("Zuerst eine Einkaufsliste anlegen"); return; }
  const senden = async l => {
    const vorhanden = kinder(l.id, "einkauf").filter(x => !x.erledigt).map(x => normal(x.titel));
    const posten = (Array.isArray(titel) ? titel : [{ titel, menge }]).filter(x => !vorhanden.includes(normal(x.titel)));
    if (!posten.length) { meldung("Steht schon auf der Liste"); return; }
    const d = await api("POST", "/eintraege/mehrere", { eintraege: posten.map(x => ({ typ: "einkauf", eltern_id: l.id, titel: x.titel, daten: { menge: x.menge || null, kategorie: kategorieVon(x.titel), notiz: quelle || null } })) });
    d.eintraege.forEach(merken); neuZeichnen(); meldung(`${posten.length} auf «${l.titel}»`, "Öffnen", () => location.hash = "#/einkauf/" + l.id);
  };
  if (listen.length === 1) return senden(listen[0]);
  const zu = dialog("Auf welche Liste?", h("div", { class: "stapel" }, listen.map(l => h("button", { class: "knopf", type: "button", style: { width: "100%" }, onclick: () => { zu(); senden(l); } }, (l.daten.emoji || "🛒") + " " + l.titel))));
}

/* ---------- Ausgaben ---------- */
const AUSGABE_KAT = ["Lebensmittel", "Restaurant", "Haushalt", "Wohnen", "Ferien", "Ausflug", "Geschenke", "Transport", "Gesundheit", "Haustier", "Kind", "Sonstiges"];
FORMULARE.ausgaben_topf = {
  titel: "Kasse", sicht: false,
  felder: e => [
    { key: "titel", text: "Name", pflicht: true, platz: "z. B. Ferien Tessin, Geschenk Mama, WG-Kasse" },
    { key: "d.emoji", text: "Symbol", platz: "💰", halb: true, max: 8 },
    { key: "d.waehrung", text: "Währung", art: "auswahl", optionen: [["CHF", "CHF"], ["EUR", "EUR"]], std: "CHF", halb: true },
    { key: "d.teilnehmer", text: "Wer macht mit?", art: "personen", optionen: () => menschen(), std: [S.ich.id] },
  ],
  vorher: (res, start) => {
    const t = new Set(res.daten.teilnehmer || []); t.add(start.besitzer_id || S.ich.id); res.daten.teilnehmer = [...t];
    res.sicht = "personen"; res.freigabe = [...t].filter(i => i !== (start.besitzer_id || S.ich.id) && person(i) && mitLogin(person(i)));
  },
  danach: n => { location.hash = "#/ausgaben/" + n.id; },
};
function topfTeilnehmer(t) { return (t.daten.teilnehmer || [t.besitzer_id]).filter(i => person(i)); }
FORMULARE.ausgabe = {
  titel: "Ausgabe", sicht: false,
  felder: e => { const t = S.E.get(e.eltern_id) || {}; const tn = () => topfTeilnehmer(t).map(person);
    return [
      { key: "titel", text: "Wofür?", pflicht: true, platz: "z. B. Znacht, Benzin, Hotel" },
      { key: "d.betrag", text: `Betrag (${(t.daten || {}).waehrung || "CHF"})`, art: "zahl", pflicht: true, halb: true, platz: "0.00" },
      { key: "datum", text: "Datum", art: "datum", std: heuteIso, halb: true },
      { key: "d.bezahlt_von", text: "Bezahlt von", art: "auswahl", zahlen: true, optionen: () => tn().map(p => [p.id, p.name]), std: S.ich.id, halb: true },
      { key: "d.kategorie", text: "Kategorie", art: "auswahl", optionen: AUSGABE_KAT.map(k => [k, k]), halb: true },
      { key: "d.geteilt", text: "Geteilt unter (gleichmässig)", art: "personen", optionen: tn, std: topfTeilnehmer(t) },
      { key: "d.notiz", text: "Notiz", platz: "optional" }];
  },
  vorher: res => { if (!res.daten.geteilt || !res.daten.geteilt.length) res.daten.geteilt = [res.daten.bezahlt_von]; if (!res.daten.betrag) throw meldung("Betrag fehlt"); },
};
function ausgabeNeu(t) { bearbeiten("ausgabe", null, { eltern_id: t.id }); }
function salden(t) {
  const netto = {}; let total = 0; const proKat = {}; const proMonat = {};
  for (const i of topfTeilnehmer(t)) netto[i] = 0;
  for (const a of kinder(t.id, "ausgabe")) {
    const b = zahl(a.daten.betrag), von = a.daten.bezahlt_von, an = (a.daten.geteilt || []).filter(Boolean);
    if (!b || !von || !an.length) continue;
    netto[von] = (netto[von] || 0) + b;
    for (const p of an) netto[p] = (netto[p] || 0) - b / an.length;
    if (!a.daten.rueckzahlung) { total += b; proKat[a.daten.kategorie || "Sonstiges"] = (proKat[a.daten.kategorie || "Sonstiges"] || 0) + b;
      const m = (a.datum || "").slice(0, 7); if (m) proMonat[m] = (proMonat[m] || 0) + b; }
  }
  // Wer zahlt wem: die grössten Schulden mit den grössten Guthaben verrechnen
  const plus = Object.entries(netto).filter(x => x[1] > 0.004).map(x => [Number(x[0]), x[1]]).sort((a, b) => b[1] - a[1]);
  const minus = Object.entries(netto).filter(x => x[1] < -0.004).map(x => [Number(x[0]), -x[1]]).sort((a, b) => b[1] - a[1]);
  const zahlungen = [];
  let i = 0, j = 0;
  while (i < minus.length && j < plus.length) {
    const b = Math.min(minus[i][1], plus[j][1]);
    zahlungen.push({ von: minus[i][0], an: plus[j][0], betrag: Math.round(b * 100) / 100 });
    minus[i][1] -= b; plus[j][1] -= b;
    if (minus[i][1] < 0.005) i++; if (plus[j][1] < 0.005) j++;
  }
  return { netto, total, proKat, proMonat, zahlungen };
}
V.ausgaben = function (args, q) {
  if (args[0] === "import") return ausgabenImport(Number(args[1]));
  if (args[0]) return topfDetail(Number(args[0]), q);
  const toepfe = alle("ausgaben_topf");
  return mitPlus(seite(kopf("Ausgaben", [neuKnopf("Kasse", () => bearbeiten("ausgaben_topf"))]),
    toepfe.length ? h("div", { class: "raster" }, toepfe.map(t => { const s = salden(t), m = s.netto[S.ich.id] || 0, w = t.daten.waehrung || "CHF";
      return h("a", { class: "karte", href: "#/ausgaben/" + t.id, style: { color: "var(--text)" } }, h("div", { class: "karte-kopf" }, h("span", { style: { "font-size": "1.5rem" } }, t.daten.emoji || "💰"), h("h2", null, t.titel),
        h("span", { class: "rechts avas" }, topfTeilnehmer(t).map(i => ava(person(i), "mini")))),
        h("div", { class: "leise klein" }, "Total ", chf(s.total, w)),
        h("div", { class: "betrag " + (m > 0.004 ? "plus-betrag" : m < -0.004 ? "minus-betrag" : "") }, m > 0.004 ? `Du bekommst ${chf(m, w)}` : m < -0.004 ? `Du schuldest ${chf(-m, w)}` : "Ausgeglichen ✓")); }))
      : leer("💰", "Gemeinsame Kassen für Ferien, Geschenke oder den Haushalt – Hüsli rechnet aus, wer wem wie viel schuldet.", knopf("Kasse anlegen", () => bearbeiten("ausgaben_topf"), "haupt"))),
    () => bearbeiten("ausgaben_topf"));
};
function topfDetail(id, q) {
  const t = S.E.get(id);
  if (!t) return leer("🤷", "Kasse nicht gefunden.");
  const w = t.daten.waehrung || "CHF";
  const s = salden(t);
  const ansicht = q.get("a") || "liste";
  const xs = kinder(id, "ausgabe").sort((a, b) => (b.datum || "") < (a.datum || "") ? -1 : (b.datum || "") > (a.datum || "") ? 1 : b.id - a.id);
  const max = Math.max(1, ...Object.values(s.proKat));
  const saldoKarte = h("div", { class: "karte" }, h("h2", null, "Stand"),
    h("ul", { class: "liste" }, Object.entries(s.netto).map(([i, v]) => h("li", { class: "zeile" }, ava(person(Number(i)), "mini"), h("span", { class: "haupt" }, name(Number(i))),
      h("span", { class: "betrag " + (v > 0.004 ? "plus-betrag" : v < -0.004 ? "minus-betrag" : "") }, (v > 0.004 ? "+" : "") + chf(v, w))))),
    s.zahlungen.length ? [h("h3", { style: { "margin-top": "14px" } }, "So wird ausgeglichen"), h("ul", { class: "liste" }, s.zahlungen.map(z => h("li", { class: "zeile" },
      h("span", { class: "haupt" }, `${name(z.von)} → ${name(z.an)}`), h("span", { class: "betrag" }, chf(z.betrag, w)),
      h("button", { class: "knopf klein", onclick: async () => { if (await bestaetigen(`${name(z.von)} hat ${name(z.an)} ${chf(z.betrag, w)} bezahlt?`, "Ja, ausgeglichen"))
        neu("ausgabe", { eltern_id: id, titel: "Ausgleich", datum: heuteIso(), daten: { betrag: z.betrag, bezahlt_von: z.von, geteilt: [z.an], rueckzahlung: true, kategorie: "Ausgleich" } }); } }, "Erledigt"))))]
      : h("p", { class: "leise" }, "Alles ausgeglichen ✓"));
  const statKarte = h("div", { class: "karte" }, h("h2", null, "Nach Kategorie"), h("p", { class: "leise klein" }, "Total ", chf(s.total, w)),
    Object.entries(s.proKat).sort((a, b) => b[1] - a[1]).map(([k, v]) => h("div", { style: { "margin-bottom": "8px" } },
      h("div", { class: "klein", style: { display: "flex" } }, h("span", null, k), h("span", { class: "betrag", style: { "margin-left": "auto" } }, chf(v, w))),
      h("div", { class: "balken" }, h("i", { style: { width: Math.round(100 * v / max) + "%" } })))),
    Object.keys(s.proMonat).length > 1 ? [h("h3", { style: { "margin-top": "14px" } }, "Pro Monat"), Object.entries(s.proMonat).sort().reverse().slice(0, 12).map(([m, v]) =>
      h("div", { class: "klein", style: { display: "flex" } }, h("span", null, MONATE[Number(m.slice(5)) - 1] + " " + m.slice(0, 4)), h("span", { class: "betrag", style: { "margin-left": "auto" } }, chf(v, w))))] : null);
  const liste = xs.length ? h("ul", { class: "liste karte knapp" }, xs.map(a => h("li", { class: "zeile klickbar", onclick: () => bearbeiten("ausgabe", a) },
    ava(person(a.daten.bezahlt_von), "mini"),
    h("span", { class: "haupt" }, h("span", { class: "titel" }, a.daten.rueckzahlung ? "↔ " : "", a.titel),
      h("span", { class: "unter" }, `${fmtDatum(a.datum)} · ${name(a.daten.bezahlt_von)} · ${a.daten.rueckzahlung ? "an " + (a.daten.geteilt || []).map(name).join(", ") : (a.daten.kategorie || "") + " · " + ((a.daten.geteilt || []).length === topfTeilnehmer(t).length ? "alle" : (a.daten.geteilt || []).map(name).join(", "))}`)),
    h("span", { class: "betrag" }, chf(a.daten.betrag, w))))) : leer("🧾", "Noch keine Ausgaben.", knopf("Erste Ausgabe", () => ausgabeNeu(t), "haupt"));
  return mitPlus(seite(kopf((t.daten.emoji || "💰") + " " + t.titel, [neuKnopf("Ausgabe", () => ausgabeNeu(t)),
    h("a", { class: "knopf", href: "#/ausgaben/import/" + id }, ic("import"), "Import"), knopf("", () => bearbeiten("ausgaben_topf", t), "rund", "stift")], ["#/ausgaben", "Ausgaben"]),
    h("div", { class: "zwei" }, h("div", null, liste), h("div", { class: "stapel" }, saldoKarte, statKarte))), () => ausgabeNeu(t));
}
/* CSV-Import (z. B. Export aus E-Banking oder Kreditkarte) */
function csvLesen(text) {
  text = text.replace(/^﻿/, "");
  const erste = text.split(/\r?\n/).find(z => z.trim()) || "";
  const trenner = [";", "\t", ","].map(t => [t, erste.split(t).length]).sort((a, b) => b[1] - a[1])[0][0];
  const zeilen = []; let feld = "", zeile = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"' && text[i + 1] === '"') { feld += '"'; i++; } else if (c === '"') inQ = false; else feld += c; }
    else if (c === '"') inQ = true;
    else if (c === trenner) { zeile.push(feld); feld = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; zeile.push(feld); feld = ""; if (zeile.some(x => x.trim())) zeilen.push(zeile); zeile = []; }
    else feld += c;
  }
  zeile.push(feld); if (zeile.some(x => x.trim())) zeilen.push(zeile);
  return zeilen;
}
function datumLesen(s) {
  s = String(s || "").trim();
  let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (m) { const j = m[3].length === 2 ? "20" + m[3] : m[3]; return `${j}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0];
  return null;
}
function ausgabenImport(id) {
  const t = S.E.get(id);
  if (!t) return leer("🤷", "Kasse nicht gefunden.");
  const box = h("div");
  const datei = h("input", { type: "file", accept: ".csv,.txt,text/csv", onchange: async () => { const f = datei.files[0]; if (f) { let txt = await f.text(); if (txt.includes("�")) txt = new TextDecoder("windows-1252").decode(await f.arrayBuffer()); zeige(txt); } } });
  const feld = h("textarea", { class: "eingabe", rows: 6, placeholder: "…oder CSV-Text hier einfügen" });
  function zeige(text) {
    const z = csvLesen(text);
    if (z.length < 2) { meldung("Keine Zeilen erkannt"); return; }
    const kopfZ = z[0], daten = z.slice(1);
    const raten = re => Math.max(0, kopfZ.findIndex(k => re.test(normal(k))));
    let cD = raten(/datum|date|buchung|valuta/), cT = raten(/text|beschreibung|buchungstext|description|zahlungsempf|details|mitteilung/), cB = raten(/betrag|amount|belastung|debit|soll/);
    const wahl = (wert, setz) => { const s = h("select", { class: "eingabe", onchange: () => { setz(Number(s.value)); vorschau(); } }, kopfZ.map((k, i) => h("option", { value: i }, k || "Spalte " + (i + 1)))); s.value = wert; return s; };
    const nurAusgaben = h("input", { type: "checkbox", checked: true, onchange: () => vorschau() });
    const tab = h("div", { class: "tabellen-rahmen" });
    const gewaehlt = new Set();
    let zeilen = [];
    function vorschau() {
      zeilen = daten.map((r, i) => ({ i, datum: datumLesen(r[cD]), titel: (r[cT] || "").trim().slice(0, 120), betrag: zahl(r[cB]) })).filter(r => r.datum && r.betrag);
      if (nurAusgaben.checked && zeilen.some(r => r.betrag < 0)) zeilen = zeilen.filter(r => r.betrag < 0);
      gewaehlt.clear(); zeilen.forEach(r => gewaehlt.add(r.i));
      tab.replaceChildren(h("table", { class: "tabelle" }, h("tr", null, h("th", null, ""), h("th", null, "Datum"), h("th", null, "Text"), h("th", null, "Betrag")),
        zeilen.map(r => h("tr", null, h("td", null, h("input", { type: "checkbox", checked: true, onchange: ev => ev.target.checked ? gewaehlt.add(r.i) : gewaehlt.delete(r.i) })),
          h("td", null, fmtDatum(r.datum)), h("td", null, r.titel), h("td", { class: "betrag" }, chf(Math.abs(r.betrag), t.daten.waehrung || "CHF"))))));
    }
    vorschau();
    box.replaceChildren(h("div", { class: "felder2" }, h("label", { class: "feld" }, h("span", null, "Datum-Spalte"), wahl(cD, v => cD = v)),
      h("label", { class: "feld" }, h("span", null, "Text-Spalte"), wahl(cT, v => cT = v)), h("label", { class: "feld" }, h("span", null, "Betrag-Spalte"), wahl(cB, v => cB = v)),
      h("label", { class: "haken" }, nurAusgaben, "Nur Belastungen (negative Beträge)")), tab,
      h("div", { class: "kopf", style: { "margin-top": "12px" } }, h("span", { class: "leise klein" }, "Bezahlt von dir, geteilt unter allen Teilnehmenden. Danach einzeln anpassbar."),
        h("div", { class: "rechts" }, knopf("Importieren", async () => {
          const wahlZ = zeilen.filter(r => gewaehlt.has(r.i));
          if (!wahlZ.length) return meldung("Nichts ausgewählt");
          for (let k = 0; k < wahlZ.length; k += 400) {
            const d = await api("POST", "/eintraege/mehrere", { eintraege: wahlZ.slice(k, k + 400).map(r => ({ typ: "ausgabe", eltern_id: id, titel: r.titel || "Import", datum: r.datum,
              daten: { betrag: Math.abs(r.betrag), bezahlt_von: S.ich.id, geteilt: topfTeilnehmer(t), kategorie: kategorieAusgabe(r.titel), importiert: true } })) });
            d.eintraege.forEach(merken);
          }
          meldung(`${wahlZ.length} Ausgaben importiert`); location.hash = "#/ausgaben/" + id;
        }, "haupt"))));
  }
  box.append(h("div", { class: "karte stapel" }, h("p", { style: { margin: 0 } }, "CSV-Datei aus dem E-Banking oder der Kreditkarten-Abrechnung wählen. Die Datei bleibt auf dem Pi."),
    datei, feld, knopf("Text lesen", () => feld.value.trim() && zeige(feld.value))));
  return seite(kopf("Ausgaben importieren", [], ["#/ausgaben/" + id, t.titel]), box);
}
function kategorieAusgabe(text) {
  const t = normal(text);
  const regeln = [["Lebensmittel", /migros|coop|denner|aldi|lidl|volg|spar|manor food|landi/], ["Restaurant", /restaurant|pizzeria|cafe|bar |mcdonald|burger|take ?away|eat\.ch|just eat/],
    ["Transport", /sbb|tankstelle|shell|avia|bp |esso|agrola|parking|parkhaus|uber|taxi|postauto/], ["Haustier", /fressnapf|qualipet|tierarzt|zoo/],
    ["Gesundheit", /apotheke|drogerie|amavita|sunstore|arzt|zahnarzt/], ["Haushalt", /ikea|jumbo|hornbach|bauhaus|do it|obi|interdiscount|digitec|galaxus/],
    ["Ferien", /hotel|booking|airbnb|swiss|easyjet|edelweiss/]];
  for (const [k, re] of regeln) if (re.test(t)) return k;
  return "Sonstiges";
}
