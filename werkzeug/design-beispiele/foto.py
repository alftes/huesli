import sys
from playwright.sync_api import sync_playwright
out = sys.argv[1]
with sync_playwright() as p:
    b = p.webkit.launch()
    for v in "abc":
        pg = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        fehler = []
        pg.on("requestfailed", lambda r: fehler.append(r.url)); pg.on("console", lambda m: m.type == "error" and fehler.append(m.text))
        pg.goto(f"http://127.0.0.1:8080/qa/huesli-design/{v}.html"); pg.wait_for_load_state("networkidle")
        pg.evaluate("document.fonts.ready")
        print(v, "Schrift:", pg.evaluate("document.fonts.check('600 16px \"Inter Tight\"') && document.fonts.check('600 16px \"IBM Plex Mono\"')"),
              "quer:", pg.evaluate("document.documentElement.scrollWidth > innerWidth"), "Fehler:", fehler)
        pg.screenshot(path=f"{out}/{v}.png")
    b.close()
