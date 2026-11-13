import pathlib
Z = pathlib.Path("/mnt/data/apps/qa/huesli-design")
I = {
 "haus": '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
 "aufg": '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
 "kal": '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',
 "korb": '<path d="M4 9h16l-1.5 10h-13z"/><path d="M8 9l4-5 4 5"/>',
 "mehr": '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
 "plus": '<path d="M12 5v14M5 12h14"/>',
 "torte": '<path d="M4 20h16v-7H4z"/><path d="M12 13V9M12 6v.5"/>',
 "geld": '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10h4a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3h4"/>',
}
ic = lambda n: f'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">{I[n]}</svg>'
def leiste():
    p = [("haus","Übersicht",1),("aufg","Aufgaben",0),("kal","Kalender",0),("korb","Einkauf",0),("mehr","Mehr",0)]
    return '<div class="leiste"><nav>' + "".join(f'<a href="#" class="{"an" if a else ""}">{ic(i)}{n}</a>' for i,n,a in p) + '</nav></div>'
def seite(name, titel, inhalt, nacht=False, plus=False):
    html = f'''<!doctype html><html lang="de-CH"{' class="nacht"' if nacht else ''}><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Hüsli – {titel}</title>
<link rel="stylesheet" href="stil.css"></head><body><main class="blatt">
<div class="kopf"><div class="marke">Hüsli<span>.</span></div><button class="person" aria-label="Profil">AT</button></div>
{inhalt}</main>{'<button class="plus" aria-label="Neu">'+ic("plus")+'</button>' if plus else ''}{leiste()}</body></html>'''
    (Z / f"{name}.html").write_text(html, encoding="utf-8")

kopf = '<div class="auge">Freitag · 13. November</div><h1>Guten Abend,<br>Alfred</h1>'
def zeile(links, t, klein="", rechts=""):
    return f'<div class="zeile">{links}<div class="t">{t}{"<small>"+klein+"</small>" if klein else ""}</div>{rechts}</div>'
hk = '<span class="haken"></span>'; hr = '<span class="haken rund"></span>'

heute = '<section class="karte"><header><h2>Heute</h2><a href="#">Kalender</a></header>' + \
    zeile('<span class="zeit">18:30</span>', "Abendessen mit Edgar", "Zuhause") + \
    zeile('<span class="zeit">20:00</span>', "Wäsche aufhängen", "Aufgabe · Alfred") + '</section>'
aufg = '<section class="karte"><header><h2>Aufgaben</h2><a href="#">Alle 5</a></header>' + \
    zeile(hk, "Altpapier bündeln", "Abfuhr am Dienstag", '<span class="marke-klein">DI</span>') + \
    zeile(hk, "Vignette bestellen", "", '<span class="marke-klein warn">FÄLLIG</span>') + \
    zeile(hk, "Winterreifen-Termin", "Auto") + '</section>'
eink = '<section class="karte"><header><h2>Einkauf</h2><a href="#">Liste öffnen</a></header>' + \
    zeile(hr, "Milch", "", '<span class="menge">2 l</span>') + zeile(hr, "Brot") + \
    zeile(hr, "Tomaten", "", '<span class="menge">500 g</span>') + '</section>'

# A – Tagesblatt: alles untereinander, wie ein Blatt
seite("a", "Tagesblatt", kopf + heute + aufg + eink, plus=True)

# B – Kacheln: grosse Zahlen
def kachel(i, n, zahl, unten, kl=""):
    return f'<a class="kachel {kl}" href="#"><div class="oben"><span class="auge">{n}</span>{ic(i)}</div><div class="zahl">{zahl}</div><div class="unten">{unten}</div></a>'
kacheln = '<div class="kacheln">' + \
    kachel("aufg", "Aufgaben", "5", "1 fällig · Vignette", "haupt") + \
    kachel("korb", "Einkauf", "7", "Milch, Brot, Tomaten …") + \
    kachel("kal", "Heute", "18<small>:30</small>", "Abendessen mit Edgar") + \
    kachel("geld", "Ausgaben", "412<small> CHF</small>", "November bisher") + \
    f'<a class="kachel breit" href="#">{ic("torte")}<div style="flex:1"><div style="font-weight:600">Mama hat Geburtstag</div><div class="unten">in 6 Tagen · Donnerstag, 19.11.</div></div><span class="marke-klein">6 T</span></a></div>'
seite("b", "Kacheln", kopf + kacheln + aufg, plus=True)

# C – Nachtdienst: dunkel, Eingabe zuoberst, Gelb für die Hauptaktion
eingabe = '<div class="auge">Freitag · 13. November</div><h1>Was brauchst du?</h1>' \
    '<label class="eingabe"><input type="text" placeholder="Milch, Brot und Eier" aria-label="Schnell erfassen"><button type="button">Dazu</button></label>' \
    '<div class="ziele"><span class="ziel an">Einkauf</span><span class="ziel">Aufgabe</span><span class="ziel">Notiz</span></div>'
seite("c", "Nachtdienst", eingabe + eink + heute + aufg, nacht=True)

(Z / "index.html").write_text('''<!doctype html><html lang="de-CH"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hüsli – Design-Beispiele</title><link rel="stylesheet" href="stil.css">
<style>.wahl{max-width:430px;margin:0 auto;padding:24px 16px}.wahl a{display:block;text-decoration:none;color:inherit;padding:16px}.wahl small{color:var(--muted)}</style></head>
<body><main class="wahl"><div class="auge">Hüsli · Vorschau</div><h1>Drei Beispiele</h1>
<a class="karte" href="a.html"><b>A – Tagesblatt</b><br><small>Alles untereinander, ruhig wie eine Liste</small></a>
<a class="karte" href="b.html"><b>B – Kacheln</b><br><small>Grosse Zahlen, ein Blick genügt</small></a>
<a class="karte" href="c.html"><b>C – Nachtdienst</b><br><small>Dunkel, Eingabefeld zuoberst, Gelb für die Hauptaktion</small></a>
<p><small>Nur Vorschau mit erfundenen Beispielen. Das echte Hüsli ist unverändert.</small></p></main></body></html>''', encoding="utf-8")
