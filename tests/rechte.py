"""Rechte-Tests über die API (Test-Server auf 8092, frische Datenbank)."""
import json, sys, urllib.request, http.cookiejar
B = "http://127.0.0.1:8092/familie/api"
def sitzung():
    cj = http.cookiejar.CookieJar(); op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    def rufe(m, p, k=None, kopf=True):
        r = urllib.request.Request(B + p, method=m, data=json.dumps(k).encode() if k is not None else None,
                                   headers={"Content-Type": "application/json", **({"X-Huesli": "1"} if kopf else {})})
        try:
            with op.open(r) as a: return a.status, json.loads(a.read() or b"{}")
        except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"{}")
    return rufe
ok = 0; fail = 0
def pruef(bed, text):
    global ok, fail
    if bed: ok += 1
    else: fail += 1; print("FEHLER:", text)
A = sitzung()
pruef(A("POST", "/anmelden", {"login": "alfred", "passwort": "falsch"})[0] == 401, "falsches Passwort")
pruef(A("POST", "/anmelden", {"login": "alfred", "passwort": "testtest1"})[0] == 200, "Anmeldung Alfred")
pruef(A("POST", "/eintraege", {"typ": "notiz", "titel": "x"}, kopf=False)[0] == 403, "ohne Schutz-Header")
ich = A("GET", "/ich")[1]; P = {p["name"]: p for p in ich["personen"]}
# Edgar und Mama einladen
for n in ("Edgar", "Mama"):
    s, d = A("POST", f"/personen/{P[n]['id']}/einladung"); pruef(s == 200, "Einladung " + n)
    globals()["code_" + n] = d["code"]
E = sitzung(); M = sitzung()
pruef(E("POST", "/einladung", {"code": code_Edgar, "passwort": "kurz"})[0] == 400, "kurzes Passwort")
pruef(E("POST", "/einladung", {"code": code_Edgar, "passwort": "edgar-test-1"})[0] == 200, "Einladung annehmen")
pruef(E("POST", "/einladung", {"code": code_Edgar, "passwort": "edgar-test-1"})[0] == 404, "Einladung nur einmal")
pruef(M("POST", "/einladung", {"code": code_Mama, "passwort": "mama-test-12"})[0] == 200, "Mama")
# Einträge von Alfred
_, privat = A("POST", "/eintraege", {"typ": "notiz", "titel": "Geheim", "sicht": "privat"})
_, hh = A("POST", "/eintraege", {"typ": "notiz", "titel": "Haushalt Alfred", "sicht": "haushalt"})
_, fam = A("POST", "/eintraege", {"typ": "notiz", "titel": "Für alle", "sicht": "familie"})
_, pers = A("POST", "/eintraege", {"typ": "notiz", "titel": "Nur Edgar", "sicht": "personen", "freigabe": [P["Edgar"]["id"]]})
_, topf = A("POST", "/eintraege", {"typ": "ausgaben_topf", "titel": "Ferien", "sicht": "personen", "freigabe": [P["Edgar"]["id"]], "daten": {"teilnehmer": [P["Alfred"]["id"], P["Edgar"]["id"]]}})
_, ausg = A("POST", "/eintraege", {"typ": "ausgabe", "eltern_id": topf["id"], "titel": "Hotel", "daten": {"betrag": 200}})
pruef(ausg["sicht"] == "personen" and ausg["freigabe"] == [P["Edgar"]["id"]], "Ausgabe erbt Sichtbarkeit")
def titel(s): return {e["titel"] for e in s("GET", "/daten")[1]["eintraege"]}
te, tm, ta = titel(E), titel(M), titel(A)
pruef("Geheim" not in te and "Geheim" not in tm and "Geheim" in ta, "privat")
pruef("Haushalt Alfred" not in te and "Haushalt Alfred" not in tm, "Haushalt fremd unsichtbar")
pruef("Für alle" in te and "Für alle" in tm, "Familie sichtbar")
pruef("Nur Edgar" in te and "Nur Edgar" not in tm, "Freigabe Person")
pruef("Hotel" in te and "Hotel" not in tm, "Kind-Eintrag erbt")
pruef(E("PATCH", f"/eintraege/{privat['id']}", {"titel": "gehackt"})[0] == 404, "fremdes Privates ändern")
pruef(E("DELETE", f"/eintraege/{privat['id']}")[0] == 403, "fremdes Privates löschen")
pruef(M("PATCH", f"/eintraege/{pers['id']}", {"titel": "x"})[0] == 404, "nicht freigegeben ändern")
pruef(E("PATCH", f"/eintraege/{pers['id']}", {"sicht": "privat"})[0] == 403, "Edgar darf Alfreds Eintrag nicht privat machen")
pruef(E("POST", "/eintraege", {"typ": "ausgabe", "eltern_id": privat["id"], "titel": "x"})[0] == 404, "Kind an fremdem Privaten")
# Rechte Personen
pruef(E("PATCH", f"/personen/{P['Alfred']['id']}", {"name": "X"})[0] == 403, "Edgar ändert Alfred")
pruef(E("PATCH", f"/personen/{P['Aiden']['id']}", {"geburtstag": "2024-05-01"})[0] == 200, "Edgar pflegt Aiden")
pruef(E("PATCH", f"/personen/{P['Vista']['id']}", {"name": "X"})[0] == 403, "Edgar ändert Vista (anderer Haushalt)")
pruef(E("PATCH", f"/personen/{P['Edgar']['id']}", {"rolle": "admin"})[1].get("rolle") == "erwachsen", "Selbst-Beförderung ignoriert")
pruef(E("POST", "/personen", {"name": "Fremd", "rolle": "erwachsen"})[0] == 403, "Edgar legt Erwachsenen an")
pruef(E("POST", f"/personen/{P['Sara']['id']}/einladung")[0] == 403, "Edgar lädt ein")
pruef(E("GET", "/sicherung")[0] == 403, "Sicherung nur Admin")
pruef(A("PATCH", f"/personen/{P['Alfred']['id']}", {"rolle": "erwachsen"})[0] == 400, "Admin entmachtet sich nicht")
# Module pro Haushalt
pruef(E("PATCH", f"/haushalte/{P['Alfred']['haushalt_id']}", {"module": []})[0] == 403, "fremden Haushalt ändern")
s, h2 = E("PATCH", f"/haushalte/{P['Edgar']['haushalt_id']}", {"module": ["aufgaben", "einkauf", "notizen"]})
pruef(s == 200 and "ausgaben" not in E("GET", "/ich")[1]["module"], "Modul aus")
pruef("Hotel" not in titel(E), "Ausgeschaltetes Modul unsichtbar")
pruef(E("POST", "/eintraege", {"typ": "ausgaben_topf", "titel": "x"})[0] == 400, "Ausgeschaltetes Modul anlegen")
E("PATCH", f"/haushalte/{P['Edgar']['haushalt_id']}", {"module": ich["alle_module"]})
# Gast
s, g = A("POST", "/personen", {"name": "Katzensitterin", "rolle": "gast", "haushalt_id": P["Alfred"]["haushalt_id"], "daten": {"module": ["aufgaben", "notizen"]}})
pruef(s == 201, "Gast anlegen")
c = A("POST", f"/personen/{g['id']}/einladung")[1]["code"]
G = sitzung(); G("POST", "/einladung", {"code": c, "passwort": "sitter-test-1"})
tg = titel(G)
pruef("Haushalt Alfred" in tg and "Geheim" not in tg and "Hotel" not in tg, "Gast sieht nur Haushalt + Module")
pruef(G("POST", "/eintraege", {"typ": "notiz", "titel": "x"})[0] == 403, "Gast legt nichts an")
_, auf = A("POST", "/eintraege", {"typ": "aufgabe", "titel": "Futter geben", "sicht": "haushalt"})
pruef(G("PATCH", f"/eintraege/{auf['id']}", {"erledigt": True})[0] == 200, "Gast hakt ab")
pruef(G("PATCH", f"/eintraege/{auf['id']}", {"titel": "x"})[0] == 403, "Gast ändert nicht")
pruef(len([p for p in G("GET", "/ich")[1]["personen"]]) <= 4, "Gast sieht nur eigenen Haushalt")
# iCal fremd
pruef(A("GET", "/ich")[1]["personen"][2].get("ical") is None, "iCal-Token anderer nicht sichtbar")
# Papierkorb
A("DELETE", f"/eintraege/{topf['id']}")
pruef("Hotel" not in titel(E), "Löschen mit Kindern")
pruef(any(e["id"] == topf["id"] for e in A("GET", "/papierkorb")[1]["eintraege"]), "Papierkorb")
pruef(not any(e["id"] == topf["id"] for e in M("GET", "/papierkorb")[1]["eintraege"]), "fremder Papierkorb")
A("POST", f"/eintraege/{topf['id']}/wiederherstellen")
pruef("Hotel" in titel(E), "Wiederherstellen mit Kindern")
# Reihum
_, r = A("POST", "/eintraege", {"typ": "aufgabe", "titel": "Abfall", "datum": "2026-10-01", "zugewiesen_id": P["Alfred"]["id"], "sicht": "familie",
                                "daten": {"wiederholung": "woechentlich", "reihum": [P["Alfred"]["id"], P["Edgar"]["id"]]}})
_, r2 = A("PATCH", f"/eintraege/{r['id']}", {"erledigt": True})
pruef(r2["zugewiesen_id"] == P["Edgar"]["id"] and r2["datum"] > "2026-10-22" and r2["erledigt"] == 0, "Reihum + nächster Termin")
# Abmelden
A("POST", "/abmelden"); pruef(A("GET", "/ich")[0] == 401, "abgemeldet")
print(f"{ok} ok, {fail} Fehler"); sys.exit(1 if fail else 0)
