/* Hüsli – Vorrat, Fahrzeuge, Haustiere, Familie, Module, Hinweise, Papierkorb, Einstellungen, Suche, Mehr */
"use strict";

/* ---------- Vorrat ---------- */
const VORRAT_ORTE = ["Küche", "Kühlschrank", "Tiefkühler", "Keller", "Estrich", "Bad", "Garage", "Büro", "Kinderzimmer", "Sonstiges"];
FORMULARE.vorrat = {
  titel: "Vorrat / Gegenstand",
  felder: () => [
    { key: "titel", text: "Was?", pflicht: true, platz: "z. B. Katzenstreu, WC-Papier, Bohrmaschine" },
    { key: "d.ort", text: "Wo?", vorschlaege: () => [...new Set([...VORRAT_ORTE, ...alle("vorrat").map(e => e.daten.ort).filter(Boolean)])], halb: true, std: "Küche" },
    { key: "d.kategorie", text: "Art", art: "auswahl", optionen: [["vorrat", "Verbrauchsgut (Vorrat)"], ["gegenstand", "Gegenstand (Inventar)"]], halb: true },
    { key: "d.menge", text: "Menge", art: "zahl", halb: true, std: 1 },
    { key: "d.einheit", text: "Einheit", platz: "Stk, Pack, kg", halb: true },
    { key: "d.mindestens", text: "Mindestens (dann Hinweis)", art: "zahl", halb: true },
    { key: "d.ablauf", text: "Haltbar bis", art: "datum", halb: true },
    { key: "d.garantie", text: "Garantie bis", art: "datum", halb: true },
    { key: "d.preis", text: "Kaufpreis (CHF)", art: "zahl", halb: true },
    { key: "d.notiz", text: "Notiz", art: "textarea", zeilen: 2, platz: "z. B. Seriennummer, wo gekauft" },
  ],
};
function vorratKnapp(e) { const m = zahl(e.daten.mindestens); return m > 0 && zahl(e.daten.menge) < m; }
V.vorrat = function (args, q) {
  const such = q.get("s") || "", art = q.get("art") || "vorrat";
  let xs = alle("vorrat", e => (e.daten.kategorie || "vorrat") === art);
  if (such) xs = xs.filter(e => normal(e.titel + " " + e.daten.ort + " " + e.daten.notiz).includes(normal(such)));
  xs.sort((a, b) => a.titel.localeCompare(b.titel));
  const knapp = xs.filter(vorratKnapp);
  const nachOrt = {};
  for (const e of xs) (nachOrt[e.daten.ort || "Sonstiges"] = nachOrt[e.daten.ort || "Sonstiges"] || []).push(e);
  const menge = async (e, d) => { const n = Math.max(0, zahl(e.daten.menge) + d); await aendern(e.id, { daten: { menge: n } });
    const neuE = S.E.get(e.id); if (vorratKnapp(neuE) && !vorratKnapp(e)) meldung(`${e.titel} wird knapp`, "Auf die Einkaufsliste", () => aufEinkaufsliste(e.titel, null, "Vorrat")); };
  const sf = suchfeld(such, v => { clearTimeout(sf._t); sf._t = setTimeout(() => { history.replaceState(null, "", `#/vorrat?art=${art}&s=` + encodeURIComponent(v)); neuZeichnen(); setTimeout(() => { const i = document.querySelector(".suche input"); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } }, 30); }, 250); }, "Was suchst du?");
  const zeile = e => { const ab = tageBis(e.daten.ablauf), ga = tageBis(e.daten.garantie);
    return h("li", { class: "zeile klickbar", onclick: () => bearbeiten("vorrat", e) },
      h("span", { class: "haupt" }, h("span", { class: "titel" }, e.titel), h("span", { class: "unter" }, [e.daten.notiz, e.daten.preis ? chf(e.daten.preis) : null].filter(Boolean).join(" · "))),
      h("span", { class: "rechts" }, ab !== null && ab <= 14 ? h("span", { class: "etikett " + (ab < 0 ? "warn" : "gelb") }, ab < 0 ? "abgelaufen" : "bis " + fmtDatum(e.daten.ablauf, false)) : null,
        ga !== null && ga >= 0 && ga <= 60 ? h("span", { class: "etikett gelb" }, "Garantie bis " + fmtDatum(e.daten.garantie)) : null,
        vorratKnapp(e) ? h("span", { class: "etikett warn" }, "knapp") : null,
        art === "vorrat" ? [h("button", { class: "knopf rund klein", "aria-label": "Weniger", onclick: ev => { ev.stopPropagation(); menge(e, -1); } }, ic("minus")),
          h("b", { class: "betrag", style: { "min-width": "2.6em", "text-align": "center" } }, (zahl(e.daten.menge) || 0) + (e.daten.einheit ? " " + e.daten.einheit : "")),
          h("button", { class: "knopf rund klein", "aria-label": "Mehr", onclick: ev => { ev.stopPropagation(); menge(e, 1); } }, ic("plus"))] : null)); };
  return mitPlus(seite(kopf("Vorrat", [neuKnopf(art === "vorrat" ? "Vorrat" : "Gegenstand", () => bearbeiten("vorrat", null, { daten: { kategorie: art } }))]),
    h("div", { class: "segment", style: { "margin-bottom": "14px" } }, [["vorrat", "Vorrat"], ["gegenstand", "Inventar"]].map(([k, t]) => h("button", { class: art === k ? "an" : "", onclick: () => location.hash = "#/vorrat?art=" + k }, t))),
    sf,
    knapp.length ? h("div", { class: "karte", style: { "margin-bottom": "14px", background: "var(--warn-hell)" } }, h("div", { class: "karte-kopf" }, h("b", null, `${knapp.length} knapp: `),
      h("span", null, knapp.map(e => e.titel).join(", ")), h("span", { class: "rechts" }, knopf("Auf die Einkaufsliste", () => aufEinkaufsliste(knapp.map(e => ({ titel: e.titel })), null, "Vorrat"), "klein")))) : null,
    xs.length ? Object.keys(nachOrt).sort().map(o => [h("div", { class: "gruppe-titel" }, o), h("ul", { class: "liste karte knapp" }, nachOrt[o].map(zeile))])
      : leer("📦", art === "vorrat" ? "Vorräte erfassen und bei «knapp» direkt auf die Einkaufsliste." : "Wertsachen und Geräte mit Garantie und Kaufpreis – praktisch für die Hausratversicherung.")),
    () => bearbeiten("vorrat", null, { daten: { kategorie: art } }));
};

/* ---------- Fahrzeuge ---------- */
FORMULARE.fahrzeug = {
  titel: "Fahrzeug",
  felder: () => [
    { key: "titel", text: "Name", pflicht: true, platz: "z. B. Golf, Velo, Roller" },
    { key: "d.kennzeichen", text: "Kennzeichen", platz: "LU 123 456", halb: true },
    { key: "d.modell", text: "Marke / Modell", halb: true },
    { key: "d.jahrgang", text: "Jahrgang", art: "zahl", halb: true },
    { key: "d.km", text: "Kilometerstand", art: "zahl", halb: true },
    { key: "d.mfk", text: "Nächste MFK", art: "datum", halb: true },
    { key: "d.service", text: "Nächster Service", art: "datum", halb: true },
    { key: "d.versicherung", text: "Versicherung erneuern", art: "datum", halb: true },
    { key: "d.vignette", text: "Vignette gültig für", art: "zahl", platz: String(new Date().getFullYear()), halb: true },
    { key: "d.reifen", text: "Montiert", art: "auswahl", optionen: [["", "—"], ["sommer", "Sommerreifen"], ["winter", "Winterreifen"], ["ganzjahr", "Ganzjahresreifen"]], halb: true },
    { key: "d.reifen_ort", text: "Andere Reifen lagern bei", halb: true },
    { key: "d.notiz", text: "Notiz", art: "textarea", zeilen: 2, platz: "Versicherungsnummer, Pannendienst …" },
  ],
  danach: n => { location.hash = "#/fahrzeuge/" + n.id; },
};
const FZ_ARTEN = [["tanken", "⛽ Tanken / Laden"], ["service", "🔧 Service"], ["reparatur", "🛠 Reparatur"], ["reifen", "🛞 Reifenwechsel"], ["mfk", "✅ MFK"], ["sonst", "📝 Sonstiges"]];
FORMULARE.fahrzeug_eintrag = {
  titel: "Fahrtenbuch", sicht: false,
  felder: () => [
    { key: "d.art", text: "Was?", art: "auswahl", optionen: FZ_ARTEN, halb: true },
    { key: "datum", text: "Datum", art: "datum", std: heuteIso, halb: true },
    { key: "d.km", text: "Kilometerstand", art: "zahl", halb: true },
    { key: "d.kosten", text: "Kosten (CHF)", art: "zahl", halb: true },
    { key: "d.liter", text: "Liter / kWh (beim Tanken)", art: "zahl", halb: true },
    { key: "d.voll", text: "Vollgetankt", art: "haken", std: true, halb: true },
    { key: "d.notiz", text: "Notiz", platz: "z. B. Garage, was gemacht wurde" },
  ],
  vorher: res => { res.titel = (FZ_ARTEN.find(a => a[0] === (res.daten.art || "tanken")) || [0, "Eintrag"])[1].replace(/^\S+\s/, ""); },
  danach: async n => { const f = S.E.get(n.eltern_id); if (f && zahl(n.daten.km) > zahl(f.daten.km)) await aendern(f.id, { daten: { km: zahl(n.daten.km) } }); },
};
function verbrauch(fid) {
  const t = kinder(fid, "fahrzeug_eintrag").filter(e => (e.daten.art || "tanken") === "tanken" && zahl(e.daten.km) && zahl(e.daten.liter)).sort((a, b) => zahl(a.daten.km) - zahl(b.daten.km));
  const voll = t.filter(e => e.daten.voll !== false);
  if (voll.length < 2) return null;
  const a = voll[0], b = voll[voll.length - 1];
  const liter = t.filter(e => zahl(e.daten.km) > zahl(a.daten.km) && zahl(e.daten.km) <= zahl(b.daten.km)).reduce((s, e) => s + zahl(e.daten.liter), 0);
  const km = zahl(b.daten.km) - zahl(a.daten.km);
  return km > 0 ? Math.round(liter / km * 1000) / 10 : null;
}
function fzFaellig(e) {
  const aus = [];
  for (const [k, t] of [["mfk", "MFK"], ["service", "Service"], ["versicherung", "Versicherung"]]) { const n = tageBis(e.daten[k]); if (n !== null) aus.push({ t, n, d: e.daten[k] }); }
  if (e.daten.vignette && Number(e.daten.vignette) < new Date().getFullYear() + (new Date().getMonth() === 11 ? 1 : 0)) aus.push({ t: "Vignette " + (new Date().getFullYear() + (new Date().getMonth() === 11 ? 1 : 0)), n: 0, d: null });
  const m = new Date().getMonth();
  if (e.daten.reifen === "sommer" && (m === 9 || m === 10)) aus.push({ t: "Winterreifen (O bis O)", n: 0, d: null });
  if (e.daten.reifen === "winter" && (m === 3 || m === 4)) aus.push({ t: "Sommerreifen (O bis O)", n: 0, d: null });
  return aus.sort((a, b) => a.n - b.n);
}
V.fahrzeuge = function (args) {
  if (args[0]) return fahrzeugDetail(Number(args[0]));
  const xs = alle("fahrzeug");
  return mitPlus(seite(kopf("Fahrzeuge", [neuKnopf("Fahrzeug", () => bearbeiten("fahrzeug"))]),
    xs.length ? h("div", { class: "raster" }, xs.map(e => h("a", { class: "karte", href: "#/fahrzeuge/" + e.id, style: { color: "var(--text)" } },
      h("div", { class: "karte-kopf" }, h("span", { style: { "font-size": "1.5rem" } }, "🚗"), h("h2", null, e.titel), h("span", { class: "rechts" }, sichtEtikett(e))),
      h("div", { class: "klein leise" }, [e.daten.kennzeichen, e.daten.modell, e.daten.km ? Number(e.daten.km).toLocaleString("de-CH") + " km" : null].filter(Boolean).join(" · ")),
      h("div", { class: "chips", style: { "margin-top": "8px" } }, fzFaellig(e).slice(0, 3).map(f => h("span", { class: "etikett" + (f.n < 0 ? " warn" : f.n <= 30 ? " gelb" : "") }, f.t + (f.d ? " " + fmtRelativ(f.d) : "")))))))
      : leer("🚗", "Auto, Velo oder Roller erfassen – mit MFK, Service, Vignette und Reifenwechsel-Erinnerung.")), () => bearbeiten("fahrzeug"));
}
function fahrzeugDetail(id) {
  const e = S.E.get(id);
  if (!e) return leer("🤷", "Fahrzeug nicht gefunden.");
  const log = kinder(id, "fahrzeug_eintrag").sort((a, b) => (b.datum || "") < (a.datum || "") ? -1 : 1);
  const v = verbrauch(id);
  const jahr = String(new Date().getFullYear());
  const kostenJahr = log.filter(x => (x.datum || "").startsWith(jahr)).reduce((s, x) => s + zahl(x.daten.kosten), 0);
  return mitPlus(seite(kopf("🚗 " + e.titel, [neuKnopf("Eintrag", () => bearbeiten("fahrzeug_eintrag", null, { eltern_id: id })), knopf("", () => bearbeiten("fahrzeug", e), "rund", "stift")], ["#/fahrzeuge", "Fahrzeuge"]),
    h("div", { class: "zwei" }, h("div", null, h("h2", null, "Fahrtenbuch"),
      log.length ? h("ul", { class: "liste karte knapp" }, log.map(x => h("li", { class: "zeile klickbar", onclick: () => bearbeiten("fahrzeug_eintrag", x) },
        h("span", null, (FZ_ARTEN.find(a => a[0] === (x.daten.art || "tanken")) || ["", "📝"])[1].split(" ")[0]),
        h("span", { class: "haupt" }, h("span", { class: "titel" }, x.titel), h("span", { class: "unter" }, [fmtDatum(x.datum), x.daten.km ? Number(x.daten.km).toLocaleString("de-CH") + " km" : null, x.daten.liter ? x.daten.liter + " l" : null, x.daten.notiz].filter(Boolean).join(" · "))),
        x.daten.kosten ? h("span", { class: "betrag" }, chf(x.daten.kosten)) : null))) : leer("⛽", "Noch keine Einträge.")),
      h("div", { class: "stapel" }, h("div", { class: "karte" }, h("h2", null, "Fällig"), fzFaellig(e).length ? h("ul", { class: "liste" }, fzFaellig(e).map(f => h("li", { class: "zeile" },
        h("span", { class: "haupt" }, f.t), h("span", { class: "etikett" + (f.n < 0 ? " warn" : f.n <= 30 ? " gelb" : "") }, f.d ? fmtDatum(f.d) : "jetzt")))) : h("p", { class: "leise" }, "Nichts eingetragen.")),
        h("div", { class: "karte" }, h("h2", null, "Angaben"), h("dl", { class: "eigenschaften" },
          [["Kennzeichen", e.daten.kennzeichen], ["Modell", e.daten.modell], ["Jahrgang", e.daten.jahrgang], ["Kilometer", e.daten.km ? Number(e.daten.km).toLocaleString("de-CH") : null],
            ["Verbrauch", v ? v + " l/100 km" : null], ["Kosten " + jahr, kostenJahr ? chf(kostenJahr) : null], ["Vignette", e.daten.vignette],
            ["Reifen", { sommer: "Sommer", winter: "Winter", ganzjahr: "Ganzjahr" }[e.daten.reifen]], ["Andere Reifen", e.daten.reifen_ort]].filter(x => x[1]).map(([a, b]) => [h("dt", null, a), h("dd", null, String(b))])),
          e.daten.notiz ? h("p", { class: "klein", style: { "white-space": "pre-wrap" } }, e.daten.notiz) : null)))), () => bearbeiten("fahrzeug_eintrag", null, { eltern_id: id }));
}

/* ---------- Haustiere ---------- */
const TIER_ARTEN = [["impfung", "💉 Impfung"], ["entwurmung", "🪱 Entwurmung"], ["parasiten", "🕷 Floh-/Zeckenschutz"], ["tierarzt", "🩺 Tierarzt"], ["gewicht", "⚖️ Gewicht"],
  ["krallen", "✂️ Krallen / Pflege"], ["futter", "🥣 Futter gekauft"], ["sonst", "📝 Sonstiges"]];
const TIER_INTERVALL = { impfung: 365, entwurmung: 90, parasiten: 30 };
FORMULARE.tier_eintrag = {
  titel: "Haustier-Eintrag",
  felder: e => [
    { key: "d.tier_id", text: "Tier", art: "auswahl", zahlen: true, optionen: () => tiere().map(t => [t.id, t.name]), halb: true },
    { key: "d.art", text: "Was?", art: "auswahl", optionen: TIER_ARTEN, halb: true, nachher: (el, els) => {
      el._el.addEventListener("change", () => { const n = els.find(([f]) => f.key === "d.naechstes"), d = els.find(([f]) => f.key === "datum");
        const tage = TIER_INTERVALL[el._el.value]; if (n && d && tage && !n[1]._el.value) n[1]._el.value = iso(plusTage(alsDatum(d[1]._el.value || heuteIso()), tage)); }); } },
    { key: "datum", text: "Datum", art: "datum", std: heuteIso, halb: true },
    { key: "d.naechstes", text: "Nächstes Mal (Erinnerung)", art: "datum", halb: true },
    { key: "d.gewicht", text: "Gewicht (kg)", art: "zahl", halb: true },
    { key: "d.kosten", text: "Kosten (CHF)", art: "zahl", halb: true },
    { key: "d.notiz", text: "Notiz", art: "textarea", zeilen: 2, platz: "z. B. Impfstoff, Mittel, Befund" },
  ],
  vorher: res => { if (!res.daten.tier_id) throw meldung("Tier wählen"); res.titel = (TIER_ARTEN.find(a => a[0] === (res.daten.art || "impfung")) || [0, "Eintrag"])[1].replace(/^\S+\s/, ""); },
};
function tierEintraege(tid) { return alle("tier_eintrag", e => e.daten.tier_id === tid).sort((a, b) => (b.datum || "") < (a.datum || "") ? -1 : 1); }
function tierFaellig(tid) {
  // pro Art nur der neuste Eintrag zählt
  const neuste = {};
  for (const e of tierEintraege(tid)) if (!neuste[e.daten.art]) neuste[e.daten.art] = e;
  return Object.values(neuste).filter(e => e.daten.naechstes && !e.erledigt).sort((a, b) => a.daten.naechstes < b.daten.naechstes ? -1 : 1);
}
V.haustiere = function (args) {
  if (args[0]) return tierDetail(Number(args[0]), args[1]);
  const ts = tiere();
  return mitPlus(seite(kopf("Haustiere", [S.ich.rolle !== "gast" ? neuKnopf("Haustier", () => personDialog(null, "tier")) : null]),
    ts.length ? h("div", { class: "raster" }, ts.map(t => { const f = tierFaellig(t.id), hh = haushalt(t.haushalt_id);
      return h("a", { class: "karte", href: "#/haustiere/" + t.id, style: { color: "var(--text)" } }, h("div", { class: "profil", style: { "margin-bottom": "6px" } }, ava(t, "gross"),
        h("div", null, h("h2", { style: { margin: 0 } }, t.name), h("div", { class: "leise klein" }, [t.daten.tierart, t.daten.rasse, alterText(t.geburtstag), hh ? hh.emoji + " " + hh.name : null].filter(Boolean).join(" · ")))),
        f.length ? h("div", { class: "chips" }, f.slice(0, 3).map(e => h("span", { class: "etikett" + (tageBis(e.daten.naechstes) < 0 ? " warn" : tageBis(e.daten.naechstes) <= 14 ? " gelb" : "") }, `${e.titel} ${fmtRelativ(e.daten.naechstes)}`))) : h("div", { class: "leise klein" }, "Nichts fällig ✓")); }))
      : leer("🐾", "Noch keine Haustiere.")), () => bearbeiten("tier_eintrag", null, { daten: { tier_id: (ts[0] || {}).id } }));
};
function alterText(g) {
  const d = alsDatum(g); if (!d || d.getFullYear() <= 1900) return null;
  const h0 = new Date(); let j = h0.getFullYear() - d.getFullYear(); let m = h0.getMonth() - d.getMonth();
  if (h0.getDate() < d.getDate()) m--; if (m < 0) { j--; m += 12; }
  return j >= 2 ? `${j} Jahre` : j === 1 ? `1 Jahr${m ? " " + m + " Mt." : ""}` : `${m} Monate`;
}
function tierDetail(tid, modus) {
  const t = person(tid);
  if (!t || t.rolle !== "tier") return leer("🤷", "Tier nicht gefunden.");
  const es = tierEintraege(tid), f = tierFaellig(tid);
  const gew = es.filter(e => zahl(e.daten.gewicht)).slice(0, 12).reverse();
  const tierarzt = t.daten.tierarzt_id && S.E.get(t.daten.tierarzt_id);
  const darf = S.ich.rolle === "admin" || (S.ich.rolle === "erwachsen" && t.haushalt_id === S.ich.haushalt_id);
  const info = h("div", { class: "karte" }, h("div", { class: "profil" }, ava(t, "gross"), h("div", null, h("h2", { style: { margin: 0 } }, t.name),
    h("div", { class: "leise" }, [t.daten.tierart, t.daten.rasse, alterText(t.geburtstag)].filter(Boolean).join(" · ")))),
    h("dl", { class: "eigenschaften" }, [["Geburtstag", t.geburtstag ? fmtDatum(t.geburtstag) : null], ["Chip-Nr.", t.daten.chip], ["Futter", t.daten.futter], ["Menge / Tag", t.daten.futtermenge],
      ["Tierarzt", tierarzt ? [tierarzt.titel, tierarzt.daten.telefon ? h("a", { href: "tel:" + tierarzt.daten.telefon.replace(/[^\d+]/g, "") }, " " + tierarzt.daten.telefon) : null] : t.daten.tierarzt],
      ["Versicherung", t.daten.versicherung], ["Gewicht", gew.length ? zahl(gew[gew.length - 1].daten.gewicht) + " kg" : null]].filter(x => x[1]).map(([a, b]) => [h("dt", null, a), h("dd", null, b)])),
    t.daten.notiz ? h("div", { style: { "margin-top": "10px" } }, h("h3", null, "Gut zu wissen"), h("p", { style: { "white-space": "pre-wrap", margin: 0 } }, t.daten.notiz)) : null);
  if (modus === "sitter") {
    const notfall = alle("kontakt", k => k.daten.kategorie === "Notfall" || k.daten.kategorie === "Tierarzt");
    const besitzer = aktive().filter(p => p.haushalt_id === t.haushalt_id && mitLogin(p));
    const notizen = alle("notiz", n => n.daten.tier_id === tid);
    return seite(kopf("Katzensitter-Blatt: " + t.name, [knopf("Drucken", () => print(), "haupt", "drucken")], ["#/haustiere/" + tid, t.name]), h("div", { class: "stapel" }, info,
      notizen.map(n => h("div", { class: "karte" }, h("h2", null, n.titel), notizText(n, false))),
      f.length ? h("div", { class: "karte" }, h("h2", null, "Steht an"), h("ul", { class: "liste" }, f.map(e => h("li", { class: "zeile" }, h("span", { class: "haupt" }, e.titel), fmtDatum(e.daten.naechstes))))) : null,
      h("div", { class: "karte" }, h("h2", null, "Kontakte"), h("ul", { class: "liste" }, besitzer.map(p => h("li", { class: "zeile" }, h("span", { class: "haupt" }, p.name + " (Familie)"), p.daten.telefon || "")),
        notfall.map(k => h("li", { class: "zeile" }, h("span", { class: "haupt" }, `${k.titel} (${k.daten.kategorie})`), k.daten.telefon || ""))))));
  }
  return mitPlus(seite(kopf(t.name, [neuKnopf("Eintrag", () => bearbeiten("tier_eintrag", null, { daten: { tier_id: tid } })),
    h("a", { class: "knopf", href: `#/haustiere/${tid}/sitter` }, ic("drucken"), "Sitter-Blatt"), darf ? knopf("", () => personDialog(t), "rund", "stift") : null], ["#/haustiere", "Haustiere"]),
    h("div", { class: "zwei" }, h("div", { class: "stapel" },
      f.length ? h("div", { class: "karte" }, h("h2", null, "Steht an"), h("ul", { class: "liste" }, f.map(e => h("li", { class: "zeile" },
        h("span", { class: "haupt" }, h("span", { class: "titel" }, e.titel), h("span", { class: "unter" }, "zuletzt " + fmtDatum(e.datum))),
        h("span", { class: "etikett" + (tageBis(e.daten.naechstes) < 0 ? " warn" : tageBis(e.daten.naechstes) <= 14 ? " gelb" : "") }, fmtRelativ(e.daten.naechstes)),
        S.ich.rolle !== "gast" ? knopf("Erledigt", () => bearbeiten("tier_eintrag", null, { daten: { tier_id: tid, art: e.daten.art, naechstes: TIER_INTERVALL[e.daten.art] ? iso(plusTage(new Date(), TIER_INTERVALL[e.daten.art])) : null } }), "klein") : null)))) : null,
      h("div", null, h("h2", null, "Verlauf"), es.length ? h("ul", { class: "liste karte knapp" }, es.map(e => h("li", { class: "zeile klickbar", onclick: () => bearbeiten("tier_eintrag", e) },
        h("span", null, (TIER_ARTEN.find(a => a[0] === e.daten.art) || ["", "📝"])[1].split(" ")[0]),
        h("span", { class: "haupt" }, h("span", { class: "titel" }, e.titel + (e.daten.gewicht ? `: ${e.daten.gewicht} kg` : "")), h("span", { class: "unter" }, [fmtDatum(e.datum), e.daten.notiz, e.daten.naechstes ? "nächstes " + fmtDatum(e.daten.naechstes) : null].filter(Boolean).join(" · "))),
        e.daten.kosten ? h("span", { class: "betrag" }, chf(e.daten.kosten)) : null))) : leer("📋", "Noch keine Einträge. Impfungen, Entwurmung, Tierarzt, Gewicht …"))),
      h("div", { class: "stapel" }, info, gew.length > 1 ? gewichtKurve(gew) : null))), () => bearbeiten("tier_eintrag", null, { daten: { tier_id: tid } }));
}
function gewichtKurve(gew) {
  const w = 300, hh = 90, vs = gew.map(e => zahl(e.daten.gewicht)), min = Math.min(...vs), max = Math.max(...vs), sp = max - min || 1;
  const pts = vs.map((v, i) => [10 + i * (w - 20) / Math.max(1, vs.length - 1), hh - 12 - (v - min) / sp * (hh - 30)]);
  const s = document.createElementNS(SVGNS, "svg"); s.setAttribute("viewBox", `0 0 ${w} ${hh}`); s.setAttribute("width", "100%");
  const p = document.createElementNS(SVGNS, "polyline"); p.setAttribute("points", pts.map(x => x.join(",")).join(" "));
  p.setAttribute("fill", "none"); p.setAttribute("stroke", "currentColor"); p.setAttribute("stroke-width", "2"); s.append(p);
  pts.forEach(([x, y], i) => { const c = document.createElementNS(SVGNS, "circle"); c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", 3); c.setAttribute("fill", "currentColor"); s.append(c);
    const t = document.createElementNS(SVGNS, "text"); t.setAttribute("x", x); t.setAttribute("y", y - 6); t.setAttribute("font-size", "9"); t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", "currentColor"); t.textContent = vs[i]; s.append(t); });
  return h("div", { class: "karte", style: { color: "var(--akzent)" } }, h("h2", { style: { color: "var(--text)" } }, "Gewicht (kg)"), s,
    h("div", { class: "klein leise", style: { display: "flex", "justify-content": "space-between" } }, h("span", null, fmtDatum(gew[0].datum)), h("span", null, fmtDatum(gew[gew.length - 1].datum))));
}

/* ---------- Familie (Mitglieder, Haushalte) ---------- */
const FARBEN = ["#2f7d6d", "#3b6fb6", "#b54a7a", "#c47f2c", "#7a5cc0", "#4c7a2f", "#b5532f", "#5b7c99", "#e0a100", "#6d6d6d"];
function personDialog(p, rolleNeu) {
  const admin = S.ich.rolle === "admin";
  const neuP = !p;
  const rolle = p ? p.rolle : rolleNeu || "erwachsen";
  const tier = rolle === "tier";
  const kontakte = alle("kontakt").filter(k => ["Tierarzt", "Arzt"].includes(k.daten.kategorie) || tier);
  const felder = [
    { key: "name", text: "Name", pflicht: true },
    { key: "emoji", text: "Symbol (Emoji)", halb: true, max: 8, std: tier ? "🐈" : "🙂" },
    { key: "farbe", text: "Farbe", art: "auswahl", halb: true, optionen: FARBEN.map(f => [f, f]), std: FARBEN[Math.floor(Math.random() * FARBEN.length)] },
    { key: "geburtstag", text: "Geburtstag", art: "datum", halb: true },
  ];
  if (admin) {
    felder.push({ key: "rolle", text: "Rolle", art: "auswahl", halb: true, std: rolle, optionen: [["erwachsen", "Erwachsen (mit Zugang)"], ["gast", "Gast (eingeschränkt)"], ["kind", "Kind (ohne Zugang)"], ["tier", "Haustier"], ["admin", "Admin"]] });
    felder.push({ key: "haushalt_id", text: "Haushalt", art: "auswahl", zahlen: true, halb: true, std: S.ich.haushalt_id, optionen: () => S.haushalte.map(x => [x.id, x.emoji + " " + x.name]) });
  }
  if (!tier) felder.push({ key: "d.telefon", text: "Telefon", typ: "tel", halb: true });
  if (tier) felder.push({ key: "d.tierart", text: "Tierart", halb: true, std: "Katze" }, { key: "d.rasse", text: "Rasse", halb: true }, { key: "d.chip", text: "Chip-Nr.", halb: true },
    { key: "d.versicherung", text: "Versicherung", halb: true }, { key: "d.futter", text: "Futter", halb: true }, { key: "d.futtermenge", text: "Menge pro Tag", halb: true },
    { key: "d.tierarzt_id", text: "Tierarzt (aus Kontakten)", art: "auswahl", zahlen: true, optionen: [["", "—"], ...kontakte.map(k => [k.id, k.titel])] });
  if (admin && (p ? p.rolle === "gast" : rolle === "gast")) felder.push({ key: "d.module", text: "Gast darf sehen", art: "personen", optionen: S.alleModule.map((m, i) => ({ id: m, name: MODUL_INFO[m][0], farbe: "#888", emoji: "" })) });
  felder.push({ key: "d.notiz", text: tier ? "Gut zu wissen (für Sitter)" : "Notiz", art: "textarea", zeilen: 3 });
  const start = p ? Object.assign({}, p) : { rolle, daten: {} };
  formular(neuP ? (tier ? "Neues Haustier" : "Neue Person") : p.name + " bearbeiten", felder, start, async res => {
    const k = Object.assign({}, res); k.daten = res.daten;
    if (k.daten && k.daten.module) k.daten.module = k.daten.module.map(String);
    if (!admin) { delete k.rolle; delete k.haushalt_id; }
    if (neuP) { k.rolle = admin ? k.rolle || rolle : rolle; await api("POST", "/personen", k); }
    else await api("PATCH", "/personen/" + p.id, k);
    await laden(); neuZeichnen();
  }, { loeschen: !neuP && admin && p.id !== S.ich.id ? async () => { if (await bestaetigen(`${p.name} deaktivieren? Einträge bleiben erhalten, Zugang wird gesperrt.`, "Deaktivieren")) { await api("DELETE", "/personen/" + p.id); await laden(); neuZeichnen(); } } : null });
}
// «personen»-Feld wird hier auch für Modul-Auswahl (Text-IDs) benutzt
async function einladen(p) {
  const d = await api("POST", `/personen/${p.id}/einladung`);
  const url = location.origin + "/familie/#/einladung/" + d.code;
  const feld = h("input", { class: "eingabe", value: url, readonly: true, onclick: () => feld.select() });
  dialog("Einladung für " + p.name, h("div", null, h("p", null, `Schick diesen Link an ${p.name} (7 Tage gültig, nur einmal). ${p.name} braucht Tailscale mit Zugriff auf den Pi.`), feld,
    h("p", { class: "klein leise" }, "Anmeldename: ", h("b", null, p.login || "—"))), [
    { text: "Kopieren", tun: async () => { try { await navigator.clipboard.writeText(url); meldung("Kopiert"); } catch (e) { feld.select(); document.execCommand("copy"); meldung("Kopiert"); } return false; }, schliesst: false },
    navigator.share ? { text: "Teilen", tun: async () => { try { await navigator.share({ title: "Hüsli", text: `Hallo ${p.name}, hier dein Zugang zum Hüsli:`, url }); } catch (e) { } return false; } } : null,
    { text: "Fertig", art: "haupt", tun: () => true }].filter(Boolean));
}
function haushaltDialog(hh) {
  formular(hh ? "Haushalt bearbeiten" : "Neuer Haushalt", [{ key: "name", text: "Name", pflicht: true }, { key: "emoji", text: "Symbol", std: "🏠", max: 8 }], hh || {}, async res => {
    if (hh) await api("PATCH", "/haushalte/" + hh.id, res); else await api("POST", "/haushalte", res);
    await laden(); neuZeichnen();
  }, { loeschen: hh && S.ich.rolle === "admin" ? async () => { await api("DELETE", "/haushalte/" + hh.id); await laden(); neuZeichnen(); } : null });
}
V.mitglieder = function (args) {
  if (args[0]) return personDetail(Number(args[0]));
  const admin = S.ich.rolle === "admin";
  return mitPlus(seite(kopf("Familie", [admin ? neuKnopf("Person", () => personDialog(null)) : S.ich.rolle === "erwachsen" ? neuKnopf("Kind / Tier", () => personDialog(null, "kind")) : null,
    admin ? knopf("Haushalt", () => haushaltDialog(null), "", "plus") : null]),
    h("div", { class: "raster" }, S.haushalte.map(hh => { const ps = S.personen.filter(p => p.haushalt_id === hh.id && p.aktiv);
      return h("section", { class: "karte" }, h("div", { class: "karte-kopf" }, h("span", { style: { "font-size": "1.4rem" } }, hh.emoji), h("h2", null, hh.name),
        h("span", { class: "rechts" }, admin || hh.id === S.ich.haushalt_id && S.ich.rolle === "erwachsen" ? knopf("", () => haushaltDialog(hh), "rund klein", "stift") : null)),
        h("ul", { class: "liste" }, ps.map(p => h("li", { class: "zeile klickbar", onclick: () => location.hash = "#/mitglieder/" + p.id }, ava(p),
          h("span", { class: "haupt" }, h("span", { class: "titel" }, p.name, p.id === S.ich.id ? " (du)" : ""), h("span", { class: "unter" }, [ROLLE_NAME[p.rolle], p.rolle === "tier" ? p.daten.tierart : null,
            mitLogin(p) ? (p.hat_login ? "hat Zugang" : "noch nicht eingeladen") : null].filter(Boolean).join(" · "))),
          admin && mitLogin(p) && p.id !== S.ich.id ? knopf(p.hat_login ? "Neuer Link" : "Einladen", ev => { ev.stopPropagation(); einladen(p); }, "klein") : null))),
        !ps.length ? h("p", { class: "leise" }, "Noch niemand.") : null); })),
    S.ich.rolle === "admin" && S.personen.some(p => !p.aktiv) ? h("details", { style: { "margin-top": "14px" } }, h("summary", { class: "leise" }, "Deaktiviert"),
      h("ul", { class: "liste karte knapp" }, S.personen.filter(p => !p.aktiv).map(p => h("li", { class: "zeile" }, ava(p, "mini"), h("span", { class: "haupt" }, p.name),
        knopf("Reaktivieren", async () => { await api("PATCH", "/personen/" + p.id, { aktiv: true }); await laden(); neuZeichnen(); }, "klein"))))) : null,
    h("div", { class: "karte", style: { "margin-top": "14px" } }, h("h2", null, "So funktionieren die Rechte"),
      h("ul", { class: "klein", style: { "padding-left": "1.2rem", margin: 0 } },
        h("li", null, h("b", null, "Jeder Eintrag"), " hat eine Sichtbarkeit: «Nur ich», «Ausgewählte» Personen, «Mein Haushalt» oder «Ganze Familie»."),
        h("li", null, h("b", null, "Admin"), " (Alfred) verwaltet Personen, Haushalte und Einladungen – sieht aber keine privaten Einträge anderer."),
        h("li", null, h("b", null, "Erwachsene"), " sehen und bearbeiten alles, was mit ihnen geteilt ist, und verwalten Kinder und Haustiere im eigenen Haushalt."),
        h("li", null, h("b", null, "Gäste"), " (z. B. Katzensitter, Babysitter) sehen nur ausgewählte Module ihres Haushalts und dürfen nur abhaken."),
        h("li", null, h("b", null, "Kinder und Haustiere"), " haben keinen Zugang – sie können aber Aufgaben, Terminen und Einträgen zugeordnet werden.")))), admin ? () => personDialog(null) : null);
};
function personDetail(pid) {
  const p = person(pid);
  if (!p) return leer("🤷", "Person nicht gefunden.");
  if (p.rolle === "tier" && S.module.includes("haustiere")) { setTimeout(() => location.replace("#/haustiere/" + pid), 0); return h("div"); }
  const darf = S.ich.rolle === "admin" || p.id === S.ich.id || (S.ich.rolle === "erwachsen" && ["kind", "tier"].includes(p.rolle) && p.haushalt_id === S.ich.haushalt_id);
  const auf = alle("aufgabe", e => !e.erledigt && e.zugewiesen_id === pid);
  const ter = ereignisse(alsDatum(heuteIso()), plusTage(alsDatum(heuteIso()), 30)).filter(x => x.art === "termin" && (x.e.daten.wer || []).includes(pid));
  const hh = haushalt(p.haushalt_id);
  return seite(kopf(p.name, [darf ? knopf("Bearbeiten", () => personDialog(p), "", "stift") : null, S.ich.rolle === "admin" && mitLogin(p) && p.id !== S.ich.id ? knopf("Einladungslink", () => einladen(p)) : null], ["#/mitglieder", "Familie"]),
    h("div", { class: "zwei" }, h("div", { class: "karte" }, h("div", { class: "profil" }, ava(p, "gross"), h("div", null, h("h2", { style: { margin: 0 } }, p.name), h("div", { class: "leise" }, ROLLE_NAME[p.rolle] + (hh ? " · " + hh.emoji + " " + hh.name : "")))),
      h("dl", { class: "eigenschaften" }, [["Geburtstag", p.geburtstag ? fmtDatum(p.geburtstag) + (alterText(p.geburtstag) ? " (" + alterText(p.geburtstag) + ")" : "") : null], ["Telefon", p.daten.telefon ? h("a", { href: "tel:" + p.daten.telefon.replace(/[^\d+]/g, "") }, p.daten.telefon) : null],
        ["Anmeldename", mitLogin(p) && S.ich.rolle === "admin" ? p.login : null], ["Zugang", mitLogin(p) ? (p.hat_login ? "aktiv" : "noch nicht eingeladen") : "kein Zugang (" + ROLLE_NAME[p.rolle] + ")"]].filter(x => x[1]).map(([a, b]) => [h("dt", null, a), h("dd", null, b)])),
      p.daten.notiz ? h("p", { style: { "white-space": "pre-wrap" } }, p.daten.notiz) : null),
      h("div", { class: "stapel" }, h("div", { class: "karte" }, h("h2", null, "Offene Aufgaben"), auf.length ? h("ul", { class: "liste" }, auf.map(e => h("li", { class: "zeile" }, checkKnopf(false, () => abhaken(e)), h("span", { class: "haupt" }, e.titel), e.datum ? h("span", { class: "etikett" }, fmtRelativ(e.datum)) : null))) : h("p", { class: "leise" }, "Keine.")),
        h("div", { class: "karte" }, h("h2", null, "Termine (30 Tage)"), ter.length ? h("ul", { class: "liste" }, ter.map(x => h("li", { class: "zeile" }, h("span", { class: "etikett" }, fmtRelativ(x.datum)), h("span", { class: "haupt" }, x.titel)))) : h("p", { class: "leise" }, "Keine.")))));
}

/* ---------- Module ---------- */
V.module = function () {
  const admin = S.ich.rolle === "admin";
  const hhs = S.haushalte.filter(x => admin || x.id === S.ich.haushalt_id);
  return seite(kopf("Module"), h("p", { class: "leise" }, "Funktionen ein- oder ausschalten – pro Haushalt. Ausgeschaltetes verschwindet aus dem Menü, die Daten bleiben erhalten."),
    h("div", { class: "raster" }, hhs.map(hh => h("section", { class: "karte" }, h("div", { class: "karte-kopf" }, h("span", { style: { "font-size": "1.3rem" } }, hh.emoji), h("h2", null, hh.name)),
      S.alleModule.map(m => { const an = hh.module.includes(m);
        return h("label", { class: "haken", style: { "align-items": "flex-start" } }, h("input", { type: "checkbox", checked: an, disabled: S.ich.rolle === "gast" || null, onchange: async ev => {
          const neuM = ev.target.checked ? [...hh.module, m] : hh.module.filter(x => x !== m);
          await api("PATCH", "/haushalte/" + hh.id, { module: neuM }); await laden(); neuZeichnen(); } }),
          h("span", null, h("b", null, MODUL_INFO[m][0]), h("br"), h("span", { class: "klein leise" }, MODUL_INFO[m][1]))); })))));
};

/* ---------- Hinweise ---------- */
V.hinweise = function () {
  const box = h("div", null, h("p", { class: "leise" }, "Lädt …"));
  api("GET", "/hinweise").then(d => {
    const xs = d.hinweise;
    box.replaceChildren(xs.length ? h("ul", { class: "liste karte knapp" }, xs.map(x => h("li", { class: "zeile klickbar", style: x.gelesen ? null : { "font-weight": "600" }, onclick: async () => {
      if (!x.gelesen) { await api("POST", "/hinweise/gelesen", { id: x.id }); S.hinweise = Math.max(0, S.hinweise - 1); } if (x.link) location.hash = x.link; else neuZeichnen(); } },
      x.gelesen ? null : h("span", { class: "ava mini", style: { background: "var(--warn)", width: "10px", height: "10px" } }),
      h("span", { class: "haupt" }, h("span", { class: "titel" }, x.text), h("span", { class: "unter" }, fmtVor(x.zeit)))))) : leer("🔔", "Keine Hinweise. Erinnerungen an Fälliges, Geburtstage, MFK, Impfungen und Zuweisungen erscheinen hier."));
  });
  return seite(kopf("Hinweise", [knopf("Alle gelesen", async () => { await api("POST", "/hinweise/gelesen", { alle: true }); S.hinweise = 0; neuZeichnen(); })]), box);
};

/* ---------- Papierkorb ---------- */
V.papierkorb = function () {
  const box = h("div", null, h("p", { class: "leise" }, "Lädt …"));
  const laden2 = () => api("GET", "/papierkorb").then(d => {
    box.replaceChildren(d.eintraege.length ? h("ul", { class: "liste karte knapp" }, d.eintraege.map(e => h("li", { class: "zeile" },
      h("span", { class: "haupt" }, h("span", { class: "titel" }, e.titel || "(ohne Titel)"), h("span", { class: "unter" }, `${TYP_NAME[e.typ] || e.typ} · gelöscht ${fmtVor(e.geloescht)} von ${name(e.geaendert_von)}`)),
      knopf("Wiederherstellen", async () => { await api("POST", `/eintraege/${e.id}/wiederherstellen`); await laden(); laden2(); meldung("Wiederhergestellt"); }, "klein"),
      knopf("", async () => { if (await bestaetigen(`«${e.titel}» endgültig löschen?`)) { await api("DELETE", `/eintraege/${e.id}?endgueltig=1`); laden2(); } }, "klein rund gefahr", "x"))))
      : leer("🗑", "Der Papierkorb ist leer."));
  });
  laden2();
  return seite(kopf("Papierkorb"), h("p", { class: "leise" }, "Gelöschtes bleibt 30 Tage hier und wird dann automatisch entfernt."), box);
};

/* ---------- Suche ---------- */
V.suche = function (args, q) {
  const s = q.get("s") || "";
  const n = normal(s);
  const treffer = n.length < 2 ? [] : [...S.E.values()].filter(e => !e.geloescht && normal(e.titel + " " + Object.values(e.daten).filter(v => typeof v === "string").join(" ")).includes(n)).slice(0, 80);
  const pers = n.length < 2 ? [] : aktive().filter(p => normal(p.name).includes(n));
  const sf = suchfeld(s, v => { clearTimeout(sf._t); sf._t = setTimeout(() => { history.replaceState(null, "", "#/suche?s=" + encodeURIComponent(v)); neuZeichnen(); setTimeout(() => { const i = document.querySelector(".suche input"); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } }, 30); }, 200); }, "Alles durchsuchen …");
  setTimeout(() => { const i = document.querySelector(".suche input"); if (i && !s) i.focus(); }, 50);
  return seite(kopf("Suche"), sf, n.length < 2 ? h("p", { class: "leise" }, "Mindestens zwei Buchstaben.") :
    (treffer.length || pers.length) ? h("ul", { class: "liste karte knapp" }, pers.map(p => h("li", { class: "zeile klickbar", onclick: () => location.hash = "#/mitglieder/" + p.id }, ava(p, "mini"), h("span", { class: "haupt" }, p.name), h("span", { class: "etikett" }, ROLLE_NAME[p.rolle]))),
      treffer.map(e => h("li", { class: "zeile klickbar", onclick: () => { const l = linkFuer({ typ: e.typ, eintrag_id: e.id }); if (["aufgabe", "notiz", "kontakt", "termin", "vorrat", "geburtstag"].includes(e.typ)) { location.hash = l; setTimeout(() => bearbeiten(e.typ, e), 80); } else location.hash = l; } },
        h("span", { class: "haupt" }, h("span", { class: "titel" }, e.titel || "(ohne Titel)"), h("span", { class: "unter" }, TYP_NAME[e.typ] + (e.eltern_id && S.E.get(e.eltern_id) ? " · " + S.E.get(e.eltern_id).titel : ""))), sichtEtikett(e))))
      : leer("🔍", "Nichts gefunden."));
};

/* ---------- Mehr (Handy) ---------- */
V.mehr = function () {
  const wahl = leisteWahl();
  const setze = async k => {
    let neuW = wahl.includes(k) ? wahl.filter(x => x !== k) : [...wahl, k];
    if (neuW.length > 4) { meldung("Höchstens 4 – zuerst eine Nadel entfernen"); return; }
    await api("PATCH", "/personen/" + S.ich.id, { daten: { leiste: neuW } }); S.ich.daten.leiste = neuW; neuZeichnen();
  };
  return seite(kopf("Mehr"), h("p", { class: "leise klein" }, "📌 antippen, um bis zu vier Abkürzungen für die untere Leiste zu wählen."),
    h("ul", { class: "liste karte knapp" }, navSichtbar().filter(n => !n.trenner).map(n => h("li", { class: "zeile klickbar", onclick: () => location.hash = n.p },
      ic(n.i), h("span", { class: "haupt" }, n.n, n.k === "hinweise" && S.hinweise ? h("span", { class: "etikett warn", style: { "margin-left": "6px" } }, S.hinweise) : null),
      h("button", { class: "knopf rund klein" + (wahl.includes(n.k) ? " haupt" : ""), "aria-label": "Für die Leiste anheften", onclick: ev => { ev.stopPropagation(); setze(n.k); } }, ic("nadel"))))));
};

/* ---------- Einstellungen ---------- */
V.einstellungen = function () {
  const ich = S.ich;
  const icalUrl = location.origin + "/familie/ical/" + ich.ical + ".ics";
  const themaJetzt = localStorage.getItem("huesli-thema") || "auto";
  const sitz = h("div", { class: "leise klein" }, "Lädt …");
  api("GET", "/sitzungen").then(d => sitz.replaceChildren(h("ul", { class: "liste" }, d.sitzungen.map(s => h("li", { class: "zeile" }, h("span", { class: "haupt" },
    h("span", { class: "titel klein" }, geraetName(s.geraet)), h("span", { class: "unter" }, "seit " + fmtDatum(s.erstellt))))))));
  return seite(kopf("Einstellungen"), h("div", { class: "raster" },
    h("section", { class: "karte" }, h("h2", null, "Profil"), h("div", { class: "profil" }, ava(ich, "gross"), h("div", null, h("b", null, ich.name), h("div", { class: "leise klein" }, ROLLE_NAME[ich.rolle] + " · Anmeldename " + ich.login))),
      knopf("Profil bearbeiten", () => personDialog(ich), "", "stift")),
    h("section", { class: "karte" }, h("h2", null, "Darstellung"), h("div", { class: "segment" }, [["auto", "Automatisch"], ["hell", "Hell"], ["dunkel", "Dunkel"]].map(([k, t]) =>
      h("button", { class: themaJetzt === k ? "an" : "", onclick: () => { if (k === "auto") localStorage.removeItem("huesli-thema"); else localStorage.setItem("huesli-thema", k); thema(); neuZeichnen(); } }, t))),
      h("p", { class: "klein leise" }, "Tipp fürs iPhone/iPad: In Safari «Teilen → Zum Home-Bildschirm», dann startet Hüsli wie eine App.")),
    S.module.includes("kalender") ? h("section", { class: "karte" }, h("h2", null, "Kalender-Abo"), h("p", { class: "klein" }, "Deine Termine, Aufgaben und Geburtstage im iPhone-/Mac-Kalender (nur lesen, aktualisiert sich selbst)."),
      h("div", { class: "stapel" }, h("a", { class: "knopf haupt", href: icalUrl.replace(/^https:/, "webcal:") }, "Im Kalender abonnieren"),
        knopf("Link kopieren", async () => { try { await navigator.clipboard.writeText(icalUrl); meldung("Kopiert"); } catch (e) { meldung(icalUrl); } }),
        knopf("Neuen Link erzeugen (alten sperren)", async () => { if (await bestaetigen("Der bisherige Abo-Link funktioniert danach nicht mehr.", "Neu erzeugen")) { await api("POST", "/ical/neu"); await laden(); neuZeichnen(); } }, "klein")),
      h("p", { class: "klein leise" }, "Funktioniert, solange das Gerät mit Tailscale verbunden ist. Den Link nicht weitergeben.")) : null,
    h("section", { class: "karte" }, h("h2", null, "Passwort"), knopf("Passwort ändern", passwortDialog)),
    ich.rolle !== "gast" ? h("section", { class: "karte" }, h("h2", null, "Siri & Kurzbefehle"),
      h("p", { class: "klein" }, "Mit Siri auf die Einkaufsliste oder Aufgaben diktieren, aus Notizen und Safari per «Teilen» an Hüsli senden."),
      h("a", { class: "knopf haupt", href: "#/kurzbefehle" }, "Einrichten")) : null,
    ich.login === "alfred" ? h("section", { class: "karte" }, h("h2", null, "Telegram"), h("label", { class: "haken" }, h("input", { type: "checkbox", checked: !!ich.daten.telegram,
      onchange: async ev => { await api("PATCH", "/personen/" + ich.id, { daten: { telegram: ev.target.checked } }); await laden(); meldung(ev.target.checked ? "Morgen-Übersicht um 7 Uhr an" : "Aus"); } }),
      "Jeden Morgen um 7 Uhr die neuen Hinweise per Telegram (@alfred_pi400_bot)")) : null,
    h("section", { class: "karte" }, h("h2", null, "Angemeldete Geräte"), sitz, knopf("Überall abmelden", async () => { if (await bestaetigen("Auf allen Geräten abmelden (auch hier)?", "Abmelden")) { await api("DELETE", "/sitzungen/alle"); location.reload(); } }, "gefahr klein")),
    h("section", { class: "karte" }, h("h2", null, "Daten"), h("div", { class: "stapel" },
      h("a", { class: "knopf", href: "/familie/api/export", download: "huesli-export.json" }, ic("import"), "Meine Daten exportieren (JSON)"),
      ich.rolle === "admin" ? h("a", { class: "knopf", href: "/familie/api/sicherung", download: "" }, "Ganze Datenbank sichern (Admin)") : null,
      ich.rolle !== "gast" ? h("a", { class: "knopf", href: "#/papierkorb" }, ic("papierkorb"), "Papierkorb") : null),
      h("p", { class: "klein leise" }, "Der Pi macht jede Nacht automatisch eine Sicherung (14 Tage).")),
    h("section", { class: "karte" }, h("h2", null, "Abmelden"), knopf("Abmelden", async () => { await api("POST", "/abmelden"); location.hash = "#/"; location.reload(); }, "", "abmelden"),
      h("p", { class: "klein leise" }, "Hüsli · eigene Entwicklung für die Familie Tessmann · läuft auf dem Pi 400, nur im eigenen Tailnet."))));
};
function geraetName(ua) {
  ua = ua || "";
  const g = /iPad/.test(ua) ? "iPad" : /iPhone/.test(ua) ? "iPhone" : /Macintosh/.test(ua) ? "Mac" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : "Gerät";
  const b = /CriOS|Chrome/.test(ua) ? "Chrome" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "";
  return g + (b ? " · " + b : "");
}
function passwortDialog() {
  formular("Passwort ändern", [{ key: "alt", text: "Bisheriges Passwort", typ: "password", pflicht: true }, { key: "neu", text: "Neues Passwort (mind. 8 Zeichen)", typ: "password", pflicht: true },
    { key: "neu2", text: "Nochmals", typ: "password", pflicht: true }], {}, async res => {
    if (res.neu !== res.neu2) { meldung("Die neuen Passwörter sind nicht gleich"); throw new Error(); }
    await api("POST", "/passwort", { alt: res.alt, neu: res.neu }); meldung("Passwort geändert");
  });
}

/* ---------- Siri & Kurzbefehle (Einrichtung) ---------- */
function kopierFeld(wert) {
  const i = h("input", { class: "eingabe", value: wert, readonly: true, onclick: () => i.select() });
  return h("div", { class: "schnell", style: { "margin-bottom": "6px" } }, i, knopf("Kopieren", async () => {
    try { await navigator.clipboard.writeText(wert); meldung("Kopiert ✓"); } catch (e) { i.select(); document.execCommand("copy"); meldung("Kopiert ✓"); } }, "klein"));
}
V.kurzbefehle = function () {
  const box = h("div", null, h("p", { class: "leise" }, "Lädt …"));
  const zeigen = st => {
    if (!st.aktiv) {
      box.replaceChildren(h("div", { class: "karte" }, h("h2", null, "1. Persönlichen Schlüssel erzeugen"),
        h("p", null, "Die Kurzbefehle auf deinem iPhone melden sich mit diesem Schlüssel bei Hüsli an – so steht dein Passwort nirgends drin. Du kannst ihn jederzeit sperren."),
        knopf("Schlüssel erzeugen", async () => { await api("POST", "/kurzbefehl/neu"); laden3(); }, "haupt")));
      return;
    }
    const basis = location.origin + "/familie/k/" + st.token;
    const schritt = (nr, ...inhalt) => h("li", { style: { "margin-bottom": "10px" } }, ...inhalt);
    const b = t => h("b", null, t);
    box.replaceChildren(
      h("div", { class: "karte", style: { "margin-bottom": "14px" } }, h("h2", null, "Vorbereitung (einmal)"),
        h("ol", { style: { "padding-left": "1.2rem", margin: 0 } },
          schritt(1, "In der ", b("Tailscale-App"), " → Einstellungen ", b("VPN On Demand"), " einschalten. Dann ist das iPhone immer mit dem Pi verbunden, auch wenn Siri den Kurzbefehl startet."),
          schritt(2, "Die App ", b("Kurzbefehle"), " öffnen (ist auf jedem iPhone und iPad vorinstalliert)."),
          schritt(3, "Diese Seite am besten auf dem ", b("iPhone"), " offen lassen – dann kannst du die Adressen direkt kopieren.")),
        h("p", { class: "klein leise" }, `Schlüssel erstellt am ${fmtDatum(st.erstellt)}` + (st.benutzt ? ` · zuletzt benutzt ${fmtVor(st.benutzt)}` : " · noch nie benutzt"))),
      h("div", { class: "raster" },
        h("section", { class: "karte" }, h("h2", null, "🛒 «Familieneinkauf» (Siri)"),
          h("p", { class: "klein" }, "«Hey Siri, Familieneinkauf» → Siri fragt «Was brauchst du?» → «Zwei Liter Milch und Katzenstreu»."),
          h("ol", { class: "klein", style: { "padding-left": "1.2rem" } },
            schritt(1, "Oben rechts ", b("+"), " → oben auf den Namen tippen → ", b("Umbenennen"), ": ", b("Familieneinkauf"), "."),
            schritt(2, b("Aktion hinzufügen"), " → suchen: ", b("Nach Eingabe fragen"), ". Bei «Eingabeaufforderung» schreiben: ", b("Was brauchst du?")),
            schritt(3, "Aktion ", b("Inhalte von URL abrufen"), " hinzufügen. Auf das blaue ", b("URL"), " tippen und diese Adresse einfügen:"),
            kopierFeld(basis + "/einkauf"),
            schritt(4, "In derselben Aktion auf den Pfeil ", b("›"), " tippen: ", b("Methode"), " → ", b("POST"), ". ", b("Anfragetext"), " → ", b("Formular"), ". ",
              b("Neues Feld hinzufügen"), " → ", b("Text"), ". Schlüssel: ", b("text"), " – Wert: antippen und oben über der Tastatur ", b("Gefragte Eingabe"), " wählen."),
            schritt(5, "Aktion ", b("Ergebnis anzeigen"), " hinzufügen (sie übernimmt automatisch «Inhalte von URL»). So sagt Siri, was eingetragen wurde."),
            schritt(6, b("Fertig"), " tippen. Testen: Kurzbefehl antippen und «Testmilch» eingeben – dann in Hüsli wieder löschen."))),
        h("section", { class: "karte" }, h("h2", null, "✅ «Familienaufgabe» (Siri)"),
          h("p", { class: "klein" }, "«Hey Siri, Familienaufgabe» → «Was ist zu tun?» → «Steuererklärung machen». Die Aufgabe ist dir zugewiesen und für deinen Haushalt sichtbar."),
          h("ol", { class: "klein", style: { "padding-left": "1.2rem" } },
            schritt(1, "Den Kurzbefehl «Familieneinkauf» lange drücken → ", b("Duplizieren"), ". Den neuen öffnen und umbenennen in ", b("Familienaufgabe"), "."),
            schritt(2, "Frage ändern in ", b("Was ist zu tun?")),
            schritt(3, "Bei «Inhalte von URL abrufen» die Adresse ersetzen durch:"),
            kopierFeld(basis + "/aufgabe"),
            schritt(4, "Alles andere bleibt gleich. ", b("Fertig"), "."))),
        h("section", { class: "karte" }, h("h2", null, "📤 «An Hüsli» (Teilen)"),
          h("p", { class: "klein" }, "In Notizen, Safari, Mail … auf ", b("Teilen"), " → ", b("An Hüsli"), " → wählen, ob es eine Notiz, Aufgabe oder Einkauf wird. Bei «Einkauf» wird jede Zeile ein Artikel."),
          h("ol", { class: "klein", style: { "padding-left": "1.2rem" } },
            schritt(1, b("+"), " → Name: ", b("An Hüsli"), ". Unten auf ", b("ⓘ"), " (Details) → ", b("Im Share-Sheet anzeigen"), " einschalten → ", b("Fertig"), "."),
            schritt(2, "Aktion ", b("Liste"), " hinzufügen und drei Einträge eintippen: ", b("Notiz"), ", ", b("Aufgabe"), ", ", b("Einkauf"), "."),
            schritt(3, "Aktion ", b("Aus Liste auswählen"), " hinzufügen (übernimmt automatisch die Liste)."),
            schritt(4, "Aktion ", b("Inhalte von URL abrufen"), " mit dieser Adresse:"),
            kopierFeld(basis),
            schritt(5, "Pfeil ", b("›"), ": ", b("Methode POST"), ", ", b("Anfragetext Formular"), ". Zwei Felder vom Typ ", b("Text"), ": ",
              b("text"), " = Variable ", b("Kurzbefehleingabe"), " und ", b("ziel"), " = Variable ", b("Ausgewähltes Objekt"), "."),
            schritt(6, "Aktion ", b("Ergebnis anzeigen"), ". ", b("Fertig"), "."),
            schritt(7, "Test: In der Notizen-App eine Notiz öffnen → ", b("Teilen"), " (Pfeil-Symbol, ggf. «Kopie senden») → ", b("An Hüsli"), ".")))),
      h("div", { class: "karte", style: { "margin-top": "14px" } }, h("h2", null, "Gut zu wissen"),
        h("ul", { class: "klein", style: { "padding-left": "1.2rem", margin: 0 } },
          h("li", null, "Mehrere Artikel mit «und», Komma oder neuer Zeile trennen. Mengen wie «zwei Liter» oder «500 g» werden erkannt; was schon auf der Liste steht, kommt nicht doppelt."),
          h("li", null, "Geteilte Notizen sind zuerst ", b("privat"), " – in Hüsli kannst du sie danach mit dem Haushalt oder der Familie teilen."),
          h("li", null, "Siri antwortet «Keine Verbindung»? → Tailscale ist nicht verbunden (Vorbereitung Schritt 1)."),
          h("li", null, "Nur Text wird übernommen, keine Bilder oder Dateien."),
          h("li", null, "Handy verloren? Hier den Schlüssel sperren – die Kurzbefehle funktionieren dann nicht mehr."))),
      h("div", { class: "kopf", style: { "margin-top": "14px" } },
        knopf("Neuen Schlüssel erzeugen", async () => { if (await bestaetigen("Der alte Schlüssel wird gesperrt. Du musst die Adresse danach in allen drei Kurzbefehlen ersetzen.", "Neu erzeugen")) { await api("POST", "/kurzbefehl/neu"); laden3(); } }, "klein"),
        knopf("Schlüssel sperren", async () => { if (await bestaetigen("Alle Kurzbefehle hören auf zu funktionieren.", "Sperren")) { await api("DELETE", "/kurzbefehl"); laden3(); } }, "klein gefahr")));
  };
  const laden3 = () => api("GET", "/kurzbefehl").then(zeigen);
  laden3();
  return seite(kopf("Siri & Kurzbefehle", [], ["#/einstellungen", "Einstellungen"]), box);
};
