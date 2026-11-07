"""Hüsli-Rundgang: anmelden, alle Seiten öffnen, Fehler sammeln, Bildschirmfotos (WebKit iPhone/iPad, Chromium Mac)."""
import json, os, sys, time
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; OUT = sys.argv[2]; LOGIN, PW = sys.argv[3], sys.argv[4]
os.makedirs(OUT, exist_ok=True)
SEITEN = ["", "aufgaben", "kalender", "einkauf", "ausgaben", "projekte", "notizen", "rezepte", "rezepte?ansicht=plan", "haustiere", "geburtstage",
          "kontakte", "vorrat", "vorrat?art=gegenstand", "fahrzeuge", "mitglieder", "hinweise", "suche?s=kat", "module", "papierkorb", "einstellungen", "kurzbefehle", "mehr"]
GERAETE = [("iphone", "webkit", "iPhone 15"), ("ipad", "webkit", "iPad Pro 11"), ("mac", "webkit", "Desktop Safari"), ("firefox", "firefox", None)]
nur = sys.argv[5].split(",") if len(sys.argv) > 5 else None
bericht = []
with sync_playwright() as pw:
    for gname, engine, dev in GERAETE:
        if nur and gname not in nur: continue
        b = getattr(pw, engine).launch()
        opt = dict(pw.devices[dev]) if dev else dict(viewport={"width": 1440, "height": 900})
        opt.pop("default_browser_type", None)
        ctx = b.new_context(**opt, ignore_https_errors=True, reduced_motion="reduce")
        p = ctx.new_page()
        fehler = []
        p.on("console", lambda m: fehler.append(("console", m.type, m.text)) if m.type in ("error", "warning") and "Refused to apply a stylesheet" not in m.text else None)
        p.on("pageerror", lambda e: fehler.append(("pageerror", str(e))))
        p.goto(URL); p.wait_for_selector("input[autocomplete=username]")
        p.fill("input[autocomplete=username]", LOGIN); p.fill("input[type=password]", PW); p.click("button.haupt")
        p.wait_for_selector("#inhalt", timeout=10000)
        for s in SEITEN:
            vorher = len(fehler)
            p.goto(URL + "#/" + s); time.sleep(0.7)
            breite = p.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
            name = (s or "uebersicht").replace("?", "_").replace("=", "-")
            p.screenshot(path=f"{OUT}/{gname}-{name}.png", full_page=False)
            bericht.append({"geraet": gname, "seite": s, "fehler": fehler[vorher:], "ueberlauf": breite})
        b.close()
json.dump(bericht, open(f"{OUT}/bericht.json", "w"), ensure_ascii=False, indent=1)
probleme = [r for r in bericht if r["fehler"] or r["ueberlauf"]]
for r in probleme: print(r)
print(f"{len(bericht)} Seiten geprüft, {len(probleme)} mit Problemen")
