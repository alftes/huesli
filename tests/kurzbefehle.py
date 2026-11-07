"""Tests für Siri/Teilen-Kurzbefehle (Test-Server 8092, frische Datenbank mit Passwort testtest1)."""
import json, sys, uuid, urllib.request, urllib.parse, http.cookiejar
sys.path.insert(0, "/mnt/data/familie/app")
B = "http://127.0.0.1:8092/familie"
ok = fail = 0
def pruef(bed, text, extra=""):
    global ok, fail
    if bed: ok += 1
    else: fail += 1; print("FEHLER:", text, extra)
def sitzung():
    cj = http.cookiejar.CookieJar(); op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    def rufe(m, p, k=None):
        r = urllib.request.Request(B + "/api" + p, method=m, data=json.dumps(k).encode() if k is not None else None,
                                   headers={"Content-Type": "application/json", "X-Huesli": "1"})
        try:
            with op.open(r) as a: return a.status, json.loads(a.read() or b"{}")
        except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"{}")
    return rufe
def post(pfad, body=b"", typ=None, methode="POST"):
    r = urllib.request.Request(B + pfad, method=methode, data=body if methode == "POST" else None, headers={"Content-Type": typ} if typ else {})
    try:
        with urllib.request.urlopen(r) as a: return a.status, a.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()
def form(pfad, **f): return post(pfad, urllib.parse.urlencode(f).encode(), "application/x-www-form-urlencoded")
def multipart(pfad, felder, datei=None):
    g = uuid.uuid4().hex; teile = []
    for k, v in felder.items():
        teile.append(f'--{g}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    if datei:
        teile.append(f'--{g}\r\nContent-Disposition: form-data; name="text"; filename="bild.jpg"\r\nContent-Type: image/jpeg\r\n\r\n'.encode() + b"\xff\xd8\xff" + b"\r\n")
    return post(pfad, b"".join(teile) + f"--{g}--\r\n".encode(), f"multipart/form-data; boundary={g}")

# Einheit: Zerlegen
from server import einkauf_zerlegen
fall = {"2 l Milch": [("2 l", "Milch")], "zwei Liter Milch und Katzenstreu": [("2 l", "Milch"), ("", "Katzenstreu")],
        "milch, brot; eier": [("", "Milch"), ("", "Brot"), ("", "Eier")], "eine Gurke": [("", "Gurke")], "Ein Kilo Äpfel.": [("1 kg", "Äpfel")],
        "2 Gurken": [("2", "Gurken")], "3 x Joghurt": [("3 x", "Joghurt")], "Einkaufstasche": [("", "Einkaufstasche")], "Hundefutter": [("", "Hundefutter")],
        "500 g Hackfleisch\n- [ ] Rahm\n• Brot": [("500 g", "Hackfleisch"), ("", "Rahm"), ("", "Brot")], "  ,, und ": [], "1,5 kg Mehl": [("1,5 kg", "Mehl")]}
for t, soll in fall.items():
    ist = einkauf_zerlegen(t); pruef(ist == soll, f"zerlegen {t!r}", f"{ist} statt {soll}")

A = sitzung(); A("POST", "/anmelden", {"login": "alfred", "passwort": "testtest1"})
pruef(A("GET", "/kurzbefehl")[1]["aktiv"] is False, "anfangs kein Schlüssel")
s, d = A("POST", "/kurzbefehl/neu", {}); T = d["token"]; pruef(s == 200 and len(T) >= 40, "Schlüssel erzeugen")
K = "/k/" + T
pruef(post(K, methode="GET")[0] == 200 and "Alfred" in post(K, methode="GET")[1], "GET Test")
s, t = form(K + "/einkauf", text="zwei Liter Milch und Katzenstreu"); pruef(s == 200 and "Milch" in t and "Katzenstreu" in t, "Siri Einkauf (Formular)", t)
s, t = form(K + "/einkauf", text="Milch"); pruef(s == 200 and "Schon drauf: Milch" in t, "Doppelt erkannt", t)
s, t = multipart(K + "/einkauf", {"text": "Brot"}); pruef(s == 200 and "Brot" in t, "Multipart", t)
s, t = post(K + "/einkauf", json.dumps({"text": "Eier"}).encode(), "application/json"); pruef(s == 200 and "Eier" in t, "JSON", t)
s, t = post(K + "/einkauf", "Butter".encode(), "text/plain"); pruef(s == 200 and "Butter" in t, "Reiner Text", t)
s, t = form(K + "/Aufgabe", text="steuererklärung machen"); pruef(s == 200 and "Steuererklärung machen" in t, "Aufgabe (Gross-/Kleinschreibung Ziel)", t)
s, t = multipart(K, {"text": "Ferienideen\nTessin\nEngadin", "ziel": "Notiz"}); pruef(s == 200 and "Ferienideen" in t, "Teilen → Notiz über Feld ziel", t)
s, t = multipart(K, {"text": "https://www.migros.ch/rezept", "ziel": "Notiz"}); pruef(s == 200, "Link als Notiz", t)
s, t = multipart(K, {"text": "x", "ziel": "Notiz"}, datei=True); pruef(s == 415 and "Nur Text" in t, "Bild abgelehnt", t)
s, t = form(K + "/einkauf", text=""); pruef(s == 400, "leer", t)
s, t = form(K + "/foo", text="x"); pruef(s == 400, "falsches Ziel", t)
s, t = form(K, text="x"); pruef(s == 400, "ohne Ziel", t)
s, t = form("/k/" + "A" * 43 + "/einkauf", text="x"); pruef(s == 404, "falscher Schlüssel", t)
s, t = form("/k/../api/ich", text="x"); pruef(s == 404, "Pfad-Trick", t)
pruef(post(K + "/einkauf", b"x", "text/plain", methode="DELETE")[0] == 405, "DELETE nicht erlaubt")
# Daten prüfen
alle = A("GET", "/daten")[1]["eintraege"]
ek = {e["titel"]: e for e in alle if e["typ"] == "einkauf"}
pruef(ek.get("Milch", {}).get("daten", {}).get("menge") == "2 l", "Menge gespeichert")
pruef(sum(1 for e in alle if e["typ"] == "einkauf" and e["titel"] == "Milch") == 1, "Milch nur einmal")
liste = [e for e in alle if e["typ"] == "einkauf_liste"][0]
pruef(all(e["eltern_id"] == liste["id"] and e["sicht"] == "haushalt" for e in ek.values()), "auf eigener Haushaltsliste")
au = [e for e in alle if e["typ"] == "aufgabe" and e["titel"] == "Steuererklärung machen"]
pruef(au and au[0]["zugewiesen_id"] == 1 and au[0]["sicht"] == "haushalt", "Aufgabe mir zugewiesen")
no = [e for e in alle if e["typ"] == "notiz" and e["titel"] == "Ferienideen"]
pruef(no and no[0]["sicht"] == "privat" and no[0]["daten"]["text"] == "Tessin\nEngadin", "Notiz privat mit Text", str(no))
# andere sehen Alfreds Notiz nicht, aber den Einkauf nur im eigenen Haushalt
P = {p["name"]: p for p in A("GET", "/ich")[1]["personen"]}
code = A("POST", f"/personen/{P['Edgar']['id']}/einladung")[1]["code"]
E = sitzung(); E("POST", "/einladung", {"code": code, "passwort": "edgar-test-1"})
te = {e["titel"] for e in E("GET", "/daten")[1]["eintraege"]}
pruef("Ferienideen" not in te and "Katzenstreu" not in te, "Edgar sieht nichts davon")
# Edgars eigener Schlüssel landet auf Edgars Liste
TE = E("POST", "/kurzbefehl/neu", {})[1]["token"]
s, t = form(f"/k/{TE}/einkauf", text="Windeln"); pruef(s == 200 and "Windeln" in t, "Edgar Einkauf", t)
pruef("Windeln" not in {e["titel"] for e in A("GET", "/daten")[1]["eintraege"]}, "Windeln nicht bei Alfred")
# Liste wählen per Name
A("POST", "/eintraege", {"typ": "einkauf_liste", "titel": "Apotheke", "sicht": "haushalt"})
s, t = form(K + "/einkauf", text="Pflaster", liste="apotheke"); pruef("«Apotheke»" in t, "Liste per Name", t)
# Modul aus
A("PATCH", f"/haushalte/{P['Alfred']['haushalt_id']}", {"module": ["aufgaben", "notizen"]})
s, t = form(K + "/einkauf", text="x"); pruef(s == 403 and "ausgeschaltet" in t, "Modul aus", t)
A("PATCH", f"/haushalte/{P['Alfred']['haushalt_id']}", {"module": A("GET", "/ich")[1]["alle_module"]})
# Neu erzeugen sperrt alten Schlüssel, Löschen sperrt
T2 = A("POST", "/kurzbefehl/neu", {})[1]["token"]
pruef(form(K + "/einkauf", text="x")[0] == 404, "alter Schlüssel gesperrt")
pruef(form(f"/k/{T2}/einkauf", text="Zucker")[0] == 200, "neuer Schlüssel geht")
A("DELETE", "/kurzbefehl"); pruef(form(f"/k/{T2}/einkauf", text="x")[0] == 404, "gelöscht gesperrt")
# Deaktivierte Person
A("DELETE", f"/personen/{P['Edgar']['id']}"); pruef(form(f"/k/{TE}/einkauf", text="x")[0] == 404, "deaktiviert gesperrt")
# Gast
s, g = A("POST", "/personen", {"name": "Sitterin", "rolle": "gast", "haushalt_id": P["Alfred"]["haushalt_id"], "daten": {"module": ["einkauf"]}})
c = A("POST", f"/personen/{g['id']}/einladung")[1]["code"]; G = sitzung(); G("POST", "/einladung", {"code": c, "passwort": "sitter-test-1"})
pruef(G("POST", "/kurzbefehl/neu", {})[0] == 403, "Gast kein Schlüssel")
pruef(A("GET", "/kurzbefehl")[1]["aktiv"] is False, "Status nach Löschen")
# Schlüssel nicht in Personendaten sichtbar
pruef("kurzbefehl" not in json.dumps(A("GET", "/ich")[1]["personen"]), "Schlüssel nicht in Personendaten")
print(f"{ok} ok, {fail} Fehler"); sys.exit(1 if fail else 0)
