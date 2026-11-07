"""UI-Test der Seite «Siri & Kurzbefehle» + Ende-zu-Ende über die angezeigte Adresse (WebKit iPhone/iPad)."""
import sys, time, urllib.request, urllib.parse
from playwright.sync_api import sync_playwright
URL, PW, GERAET = sys.argv[1], sys.argv[2], sys.argv[3]
fehler = []
with sync_playwright() as pw:
    b = pw.webkit.launch(); o = dict(pw.devices[GERAET]); o.pop("default_browser_type", None)
    p = b.new_context(**o, reduced_motion="reduce").new_page()
    p.on("pageerror", lambda e: fehler.append(str(e)))
    p.goto(URL); p.fill("input[autocomplete=username]", "alfred"); p.fill("input[type=password]", PW); p.click("button.haupt"); p.wait_for_selector("#inhalt")
    p.goto(URL + "#/einstellungen"); time.sleep(0.6); p.click("text=Einrichten"); time.sleep(0.8)
    p.locator("button", has_text="Schlüssel erzeugen").click(); p.wait_for_selector(".schnell input", timeout=8000); time.sleep(0.4)
    felder = [x.input_value() for x in p.locator(".schnell input").all()]
    assert len(felder) == 3 and felder[0].endswith("/einkauf") and felder[1].endswith("/aufgabe") and "/familie/k/" in felder[2], felder
    p.screenshot(path="/tmp/htest/shots/kurzbefehle-" + GERAET.replace(" ", "") + ".png", full_page=True)
    ueber = p.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
    # wie der Kurzbefehl: Formular-POST an die angezeigte Adresse (lokal umgeleitet)
    lokal = lambda u: "http://127.0.0.1:8092" + u[u.index("/familie/"):]
    antwort = urllib.request.urlopen(urllib.request.Request(lokal(felder[0]), data=urllib.parse.urlencode({"text": "zwei Liter Milch und Katzenstreu"}).encode(), method="POST")).read().decode()
    antwort2 = urllib.request.urlopen(urllib.request.Request(lokal(felder[2]), data=urllib.parse.urlencode({"text": "Idee\nZweite Zeile", "ziel": "Notiz"}).encode(), method="POST")).read().decode()
    p.goto(URL + "#/einkauf"); time.sleep(0.8)
    if p.locator(".schnell input").count() == 0: p.locator("a.karte").first.click(); time.sleep(0.6)
    ok_kat = p.locator(".gruppe-titel", has_text="Milch & Käse").count() == 1 and p.locator(".gruppe-titel", has_text="Tier").count() == 1
    ok_menge = p.locator("li.zeile", has_text="Milch").locator("b", has_text="2 l").count() == 1
    p.goto(URL + "#/notizen"); time.sleep(0.6); ok_notiz = p.locator("text=Idee").count() > 0
    p.goto(URL + "#/kurzbefehle"); time.sleep(0.8); ok_benutzt = p.locator("text=zuletzt benutzt").count() == 1
    b.close()
print("Antworten:", antwort.strip(), "|", antwort2.strip())
print("Abteilungen", ok_kat, "Menge", ok_menge, "Notiz", ok_notiz, "benutzt", ok_benutzt, "Überlauf", ueber, "JS-Fehler", fehler or "keine")
sys.exit(0 if ok_kat and ok_menge and ok_notiz and ok_benutzt and not ueber and not fehler else 1)
