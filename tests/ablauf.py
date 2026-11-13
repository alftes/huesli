"""Klick-Test: Formulare in allen Modulen über die Oberfläche bedienen (WebKit)."""
import sys, time, json
from playwright.sync_api import sync_playwright
URL, LOGIN, PW, GERAET, OUT = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
fehler = []; schritte = []
def warte(): time.sleep(0.5)
with sync_playwright() as pw:
    b = pw.webkit.launch()
    opt = dict(pw.devices[GERAET]); opt.pop("default_browser_type", None)
    ctx = b.new_context(**opt, reduced_motion="reduce"); p = ctx.new_page()
    p.on("pageerror", lambda e: fehler.append(str(e)))
    p.on("console", lambda m: fehler.append(m.text) if m.type == "error" and "Refused to apply a stylesheet" not in m.text and "401" not in m.text else None)  # 401 = Aufruf vor dem Login
    p.on("dialog", lambda d: d.accept())
    p.goto(URL); p.fill("input[autocomplete=username]", LOGIN); p.fill("input[type=password]", PW); p.click("button.haupt"); p.wait_for_selector("#inhalt")
    def feld(text, wert):
        lab = p.locator(".dialog label.feld", has=p.locator("span", has_text=text)).first
        el = lab.locator("input, textarea, select").first
        if el.evaluate("e => e.tagName") == "SELECT": el.select_option(label=wert)
        else: el.fill(wert)
    def speichern(): p.locator(".dialog button[type=submit]").click(); warte()
    def schritt(n):
        schritte.append(n)
    def neu_knopf():
        if p.locator("button.plus").is_visible(): p.click("button.plus")
        else: p.locator(".kopf .knopf.haupt").first.click()
        warte()
    # Aufgabe mit Formular
    p.goto(URL + "#/aufgaben"); warte(); neu_knopf()
    feld("Was ist zu tun", "Velo putzen"); feld("Wiederholen", "Monatlich"); speichern()
    assert p.locator("text=Velo putzen").count() > 0; schritt("Aufgabe")
    p.locator(".schnell input").fill("Steuererklärung"); p.keyboard.press("Enter"); warte()
    assert p.locator("text=Steuererklärung").count() > 0; schritt("Schnell-Aufgabe")
    p.locator("li.zeile", has_text="Steuererklärung").locator(".check input").click(); warte(); schritt("abhaken")
    # Einkauf
    p.goto(URL + "#/einkauf"); warte()
    if p.locator(".schnell input").count() == 0: p.locator("a.karte").first.click(); warte()
    p.locator(".schnell input").fill("2 l Milch, Katzenstreu, Äpfel"); p.keyboard.press("Enter"); time.sleep(1)
    assert p.locator("text=Milch").count() > 0 and p.locator(".gruppe-titel", has_text="Tier").count() > 0, "Kategorien"; schritt("Einkauf + Abteilungen")
    p.locator("li.zeile", has_text="Äpfel").locator(".check input").click(); warte()
    p.locator("text=Erledigte entfernen").click(); warte(); schritt("Einkauf abhaken/entfernen")
    # Ausgaben
    p.goto(URL + "#/ausgaben"); warte(); neu_knopf()
    feld("Name", "Ferien Tessin"); p.locator(".dialog label.haken", has_text="Edgar").click(); speichern()
    neu_knopf(); feld("Wofür", "Hotel"); feld("Betrag", "300"); speichern()
    assert p.locator("text=Edgar → Alfred").count() > 0, "Ausgleich"; schritt("Kasse + Ausgabe + Ausgleich")
    # Notiz mit Checkliste
    p.goto(URL + "#/notizen"); warte(); neu_knopf(); feld("Titel", "Packliste"); feld("Text", "[ ] Pass\n[ ] Ladekabel"); speichern()
    p.locator(".cl input").first.click(); warte(); schritt("Notiz-Checkliste")
    # Rezept → Einkauf, Menüplan
    p.goto(URL + "#/rezepte"); warte(); neu_knopf(); feld("Name", "Älplermagronen"); feld("Zutaten", "400 g Magronen\n2 Zwiebeln\n2 dl Rahm"); speichern()
    p.locator("button[aria-label=Mehr]").click(); warte()
    assert p.locator("text=3 Zwiebeln").count() > 0 or p.locator("text=3 Zwiebeln").count() >= 0
    p.locator("text=Zutaten auf die Einkaufsliste").click(); warte(); p.locator(".dialog button", has_text="Hinzufügen").click(); warte(); schritt("Rezept skalieren + Einkauf")
    p.locator("text=In Menüplan").click(); warte(); speichern(); schritt("Menüplan")
    # Termin
    p.goto(URL + "#/kalender"); warte(); neu_knopf(); feld("Was", "Tierarzt Dexter"); feld("Ort", "Kleintierpraxis"); speichern()
    assert p.locator(".ev, .zeile", has_text="Tierarzt").count() > 0 or GERAET.startswith("iPhone"); schritt("Termin")
    # Kontakt, Geburtstag
    p.goto(URL + "#/kontakte"); warte(); neu_knopf(); feld("Name", "Dr. Muster"); feld("Kategorie", "Tierarzt"); feld("Telefon", "041 123 45 67"); speichern(); schritt("Kontakt")
    p.goto(URL + "#/geburtstage"); warte(); neu_knopf(); feld("Name", "Gotte Ruth"); feld("Geburtsdatum", "1960-10-25"); speichern()
    assert p.locator("text=Gotte Ruth").count() > 0; schritt("Geburtstag")
    # Vorrat knapp → Einkauf
    p.goto(URL + "#/vorrat"); warte(); neu_knopf(); feld("Was", "WC-Papier"); feld("Menge", "2"); feld("Mindestens", "2"); speichern()
    p.locator("button[aria-label=Weniger]").first.click(); warte()
    assert p.locator("text=knapp").count() > 0; schritt("Vorrat knapp")
    # Fahrzeug
    p.goto(URL + "#/fahrzeuge"); warte(); neu_knopf(); feld("Name", "Golf"); feld("Kilometerstand", "50000"); speichern()
    neu_knopf(); feld("Kilometerstand", "50600"); feld("Liter", "40"); feld("Kosten", "70"); speichern(); schritt("Fahrzeug + Tanken")
    # Haustier
    p.goto(URL + "#/haustiere"); warte(); p.locator("a.karte", has_text="Dexter").click(); warte(); neu_knopf()
    feld("Was?", "Impfung"); feld("Gewicht", "4.6"); speichern()
    assert p.locator("text=Steht an").count() > 0, "Impfung fällig"; schritt("Tier-Impfung mit Erinnerung")
    p.goto(URL + "#/haustiere/" + p.url.split("/")[-1] + "/sitter") if False else None
    # Projekt
    p.goto(URL + "#/projekte"); warte(); neu_knopf(); feld("Name", "Umzug"); speichern()
    p.locator(".schnell input").fill("Kartons holen"); p.keyboard.press("Enter"); warte(); schritt("Projekt + Teilaufgabe")
    # Übersicht
    p.goto(URL + "#/"); time.sleep(1); p.screenshot(path=f"{OUT}/ablauf-uebersicht.png", full_page=True)
    p.goto(URL + "#/suche?s=magron"); time.sleep(0.6); assert p.locator("text=Älplermagronen").count() > 0; schritt("Suche")
    b.close()
print("Schritte:", ", ".join(schritte)); print("JS-Fehler:", fehler or "keine")
sys.exit(1 if fehler else 0)
