#!/usr/bin/python3
"""Hüsli – Familien-Organizer für den Pi 400 (nur Tailnet).
Standardbibliothek + SQLite. Start: python3 server.py  (Port 8082, nur 127.0.0.1)
Eigene Entwicklung – kein Code oder Design von Drittanbietern übernommen."""
import base64, calendar, datetime as dt, hashlib, hmac, json, os, re, secrets, shutil, sqlite3
import threading, time, urllib.parse, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HIER = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(HIER, "static")
DATEN = os.environ.get("HUESLI_DATEN", "/mnt/data/familie/daten")
BACKUP = os.environ.get("HUESLI_BACKUP", "/mnt/data/familie/backup")
DB_PFAD = os.path.join(DATEN, "huesli.db")
PORT = int(os.environ.get("HUESLI_PORT", "8082"))
PRAEFIX = "/familie"
SITZUNG_TAGE = 90
MAX_KOERPER = 512 * 1024

ROLLEN = ("admin", "erwachsen", "gast", "kind", "tier")
MIT_LOGIN = ("admin", "erwachsen", "gast")
SICHT = ("privat", "personen", "haushalt", "familie")
# Funktion (Modul) → Eintragstypen
MODULE = {
    "aufgaben": ["aufgabe"], "projekte": ["projekt"], "einkauf": ["einkauf_liste", "einkauf"],
    "ausgaben": ["ausgaben_topf", "ausgabe"], "notizen": ["notiz"], "rezepte": ["rezept", "menu"],
    "kontakte": ["kontakt"], "geburtstage": ["geburtstag"], "kalender": ["termin"],
    "vorrat": ["vorrat"], "fahrzeuge": ["fahrzeug", "fahrzeug_eintrag"], "haustiere": ["tier_eintrag"],
}
TYP_MODUL = {t: m for m, ts in MODULE.items() for t in ts}
WIEDERHOLUNG = ("", "taeglich", "woechentlich", "zweiwoechentlich", "monatlich", "quartal", "jaehrlich")

os.makedirs(DATEN, exist_ok=True); os.makedirs(BACKUP, exist_ok=True)
SPERRE = threading.RLock()
DB = None


def jetzt():
    return dt.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")


def heute():
    return dt.date.today()


def db():
    global DB
    if DB is None:
        DB = sqlite3.connect(DB_PFAD, check_same_thread=False, isolation_level=None)
        DB.row_factory = sqlite3.Row
        DB.execute("PRAGMA journal_mode=WAL"); DB.execute("PRAGMA foreign_keys=ON")
        DB.execute("PRAGMA busy_timeout=5000")
    return DB


SCHEMA = """
CREATE TABLE IF NOT EXISTS haushalte(id INTEGER PRIMARY KEY, name TEXT NOT NULL, emoji TEXT DEFAULT '🏠',
  module TEXT NOT NULL DEFAULT '[]', erstellt TEXT);
CREATE TABLE IF NOT EXISTS personen(id INTEGER PRIMARY KEY, name TEXT NOT NULL, rolle TEXT NOT NULL,
  haushalt_id INTEGER REFERENCES haushalte(id), login TEXT UNIQUE, pw TEXT, farbe TEXT, emoji TEXT,
  geburtstag TEXT, daten TEXT NOT NULL DEFAULT '{}', ical TEXT, aktiv INTEGER DEFAULT 1, erstellt TEXT);
CREATE TABLE IF NOT EXISTS sitzungen(token TEXT PRIMARY KEY, person_id INTEGER REFERENCES personen(id) ON DELETE CASCADE,
  ablauf TEXT, erstellt TEXT, geraet TEXT);
CREATE TABLE IF NOT EXISTS einladungen(code TEXT PRIMARY KEY, person_id INTEGER REFERENCES personen(id) ON DELETE CASCADE,
  ablauf TEXT);
CREATE TABLE IF NOT EXISTS eintraege(id INTEGER PRIMARY KEY, typ TEXT NOT NULL, haushalt_id INTEGER, sicht TEXT NOT NULL,
  freigabe TEXT NOT NULL DEFAULT '[]', besitzer_id INTEGER, eltern_id INTEGER, titel TEXT NOT NULL DEFAULT '',
  datum TEXT, erledigt INTEGER NOT NULL DEFAULT 0, zugewiesen_id INTEGER, daten TEXT NOT NULL DEFAULT '{}',
  erstellt TEXT, geaendert TEXT, geaendert_von INTEGER, geloescht TEXT);
CREATE INDEX IF NOT EXISTS ix_eintraege_typ ON eintraege(typ);
CREATE INDEX IF NOT EXISTS ix_eintraege_eltern ON eintraege(eltern_id);
CREATE TABLE IF NOT EXISTS aktivitaet(id INTEGER PRIMARY KEY, person_id INTEGER, eintrag_id INTEGER, aktion TEXT,
  zeit TEXT);
CREATE TABLE IF NOT EXISTS hinweise(id INTEGER PRIMARY KEY, person_id INTEGER, schluessel TEXT, text TEXT, link TEXT,
  art TEXT, zeit TEXT, gelesen INTEGER DEFAULT 0, UNIQUE(person_id, schluessel));
CREATE TABLE IF NOT EXISTS einstellungen(schluessel TEXT PRIMARY KEY, wert TEXT);
CREATE TABLE IF NOT EXISTS kurzbefehle(token TEXT PRIMARY KEY, person_id INTEGER REFERENCES personen(id) ON DELETE CASCADE,
  erstellt TEXT, benutzt TEXT);
"""

STANDARD_MODULE = list(MODULE.keys())


def init_db():
    c = db()
    with SPERRE:
        c.executescript(SCHEMA)
        if c.execute("SELECT COUNT(*) FROM haushalte").fetchone()[0] == 0:
            startdaten(c)


def startdaten(c):
    """Erste Einrichtung: Haushalte und Personen nach Alfreds Angaben (22.10.2026)."""
    t = jetzt()
    hh = [("Alfred & Dexter", "🐈"), ("Edgar, Sara & Aiden", "🏡"), ("Eltern & Vista", "🐈‍⬛")]
    ids = []
    for n, e in hh:
        ids.append(c.execute("INSERT INTO haushalte(name, emoji, module, erstellt) VALUES(?,?,?,?)",
                             (n, e, json.dumps(STANDARD_MODULE), t)).lastrowid)
    pers = [("Alfred", "admin", 0, "alfred", "#2f7d6d", "🧑‍⚕️", {}),
            ("Dexter", "tier", 0, None, "#c47f2c", "🐈", {"tierart": "Katze"}),
            ("Edgar", "erwachsen", 1, "edgar", "#3b6fb6", "🙂", {}),
            ("Sara", "erwachsen", 1, "sara", "#b54a7a", "🙂", {}),
            ("Aiden", "kind", 1, None, "#e0a100", "🧒", {"notiz": "2 Jahre (Stand Okt. 2026)"}),
            ("Mama", "erwachsen", 2, "mama", "#7a5cc0", "🙂", {}),
            ("Papa", "erwachsen", 2, "papa", "#4c7a2f", "🙂", {}),
            ("Vista", "tier", 2, None, "#6d6d6d", "🐈‍⬛", {"tierart": "Katze"})]
    pid = {}
    for n, r, h, lg, f, e, d in pers:
        pid[n] = c.execute("INSERT INTO personen(name, rolle, haushalt_id, login, farbe, emoji, daten, ical, erstellt)"
                           " VALUES(?,?,?,?,?,?,?,?,?)", (n, r, ids[h], lg, f, e, json.dumps(d),
                                                          secrets.token_urlsafe(18), t)).lastrowid
    # Startinhalt (darf gelöscht werden)
    def neu(typ, h, sicht, besitzer, titel, **kw):
        daten = kw.pop("daten", {})
        return c.execute("INSERT INTO eintraege(typ, haushalt_id, sicht, besitzer_id, titel, daten, erstellt, geaendert,"
                         " eltern_id, datum, zugewiesen_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                         (typ, ids[h], sicht, pid[besitzer], titel, json.dumps(daten), t, t, kw.get("eltern"),
                          kw.get("datum"), kw.get("zu"))).lastrowid
    for h, b in ((0, "Alfred"), (1, "Edgar"), (2, "Mama")):
        neu("einkauf_liste", h, "haushalt", b, "Einkauf", daten={"emoji": "🛒"})
    d = heute().isoformat()
    neu("aufgabe", 0, "haushalt", "Alfred", "Katzenklo reinigen (Dexter)", datum=d, zu=pid["Alfred"],
        daten={"wiederholung": "taeglich", "tier_id": pid["Dexter"]})
    neu("notiz", 0, "familie", "Alfred", "Katzensitter-Infos Dexter", daten={
        "text": "Futter: …\nMenge pro Tag: …\nTierarzt: …\nBesonderheiten: …\nNotfall: Tierspital / Telefon …",
        "angeheftet": True, "tier_id": pid["Dexter"]})
    c.execute("INSERT OR REPLACE INTO einstellungen VALUES('geheim', ?)", (secrets.token_hex(32),))


# ---------------------------------------------------------------- Hilfen
def pw_hash(pw):
    salz = secrets.token_bytes(16)
    h = hashlib.pbkdf2_hmac("sha256", pw.encode(), salz, 200_000)
    return "pbkdf2$200000$" + base64.b64encode(salz).decode() + "$" + base64.b64encode(h).decode()


def pw_pruefen(pw, gespeichert):
    try:
        _, n, s, h = gespeichert.split("$")
        neu = hashlib.pbkdf2_hmac("sha256", pw.encode(), base64.b64decode(s), int(n))
        return hmac.compare_digest(neu, base64.b64decode(h))
    except Exception:
        return False


def tok_hash(t):
    return hashlib.sha256(t.encode()).hexdigest()


def zeile(r):
    if r is None:
        return None
    d = dict(r)
    for k in ("daten", "freigabe", "module"):
        if k in d and isinstance(d[k], str):
            try:
                d[k] = json.loads(d[k])
            except Exception:
                d[k] = {} if k == "daten" else []
    return d


def person_oeffentlich(p, ich):
    d = zeile(p)
    d.pop("pw", None)
    d["hat_login"] = bool(p["pw"])
    if d["id"] != ich["id"]:
        d.pop("ical", None)
    if ich["rolle"] == "gast":
        d.get("daten", {}).pop("telegram", None)
    return d


def datum_parse(s):
    if not s:
        return None
    try:
        return dt.date.fromisoformat(s[:10])
    except ValueError:
        return None


def plus_monate(d, n):
    m = d.month - 1 + n
    j, m = d.year + m // 12, m % 12 + 1
    return dt.date(j, m, min(d.day, calendar.monthrange(j, m)[1]))


def naechstes(d, w):
    if w == "taeglich":
        return d + dt.timedelta(days=1)
    if w == "woechentlich":
        return d + dt.timedelta(days=7)
    if w == "zweiwoechentlich":
        return d + dt.timedelta(days=14)
    if w == "monatlich":
        return plus_monate(d, 1)
    if w == "quartal":
        return plus_monate(d, 3)
    if w == "jaehrlich":
        return plus_monate(d, 12)
    return None


def naechster_termin(datum, w):
    """Nächstes Fälligkeitsdatum nach dem Erledigen (überspringt verpasste, landet nach heute)."""
    d = datum_parse(datum) or heute()
    zeit = datum[10:] if datum and len(datum) > 10 else ""
    d = naechstes(d, w)
    while d and d <= heute():
        d = naechstes(d, w)
    return d.isoformat() + zeit if d else None


# ---------------------------------------------------------------- Rechte
def module_fuer(ich):
    c = db()
    if ich["rolle"] == "gast":
        return [m for m in zeile(ich)["daten"].get("module", []) if m in MODULE]
    h = c.execute("SELECT module FROM haushalte WHERE id=?", (ich["haushalt_id"],)).fetchone()
    return [m for m in (json.loads(h["module"]) if h else []) if m in MODULE]


def darf_sehen(e, ich, module=None):
    """e = Eintrag (dict), ich = Person (Row)."""
    if e.get("geloescht"):
        return False
    if ich["rolle"] == "gast":
        if module is None:
            module = module_fuer(ich)
        if TYP_MODUL.get(e["typ"]) not in module:
            return False
        return e["haushalt_id"] == ich["haushalt_id"] and e["sicht"] in ("haushalt", "familie") \
            or ich["id"] in e["freigabe"]
    if e["besitzer_id"] == ich["id"]:
        return True
    s = e["sicht"]
    if s == "familie":
        return True
    if s == "haushalt":
        return e["haushalt_id"] == ich["haushalt_id"]
    if s == "personen":
        return ich["id"] in e["freigabe"]
    return False


def darf_aendern(e, ich):
    if ich["rolle"] == "gast":
        return False
    return darf_sehen(e, ich)


def darf_loeschen(e, ich):
    if ich["rolle"] == "gast":
        return False
    if e["besitzer_id"] == ich["id"] or ich["rolle"] == "admin" and e["sicht"] != "privat":
        return True
    # Erwachsene dürfen Gemeinsames im eigenen Haushalt löschen
    return darf_sehen(e, ich) and e["sicht"] in ("haushalt", "familie", "personen") and \
        (e["haushalt_id"] == ich["haushalt_id"] or e["sicht"] == "personen")


def eintrag_laden(i):
    return zeile(db().execute("SELECT * FROM eintraege WHERE id=?", (i,)).fetchone())


def sichtbare(ich, typen=None, mit_geloeschten=False):
    c = db()
    module = module_fuer(ich)
    erlaubt = {t for m in module for t in MODULE[m]}
    if typen:
        erlaubt &= set(typen)
    if not erlaubt:
        return []
    q = "SELECT * FROM eintraege WHERE typ IN (%s)" % ",".join("?" * len(erlaubt))
    q += "" if mit_geloeschten else " AND geloescht IS NULL"
    aus = []
    for r in c.execute(q, list(erlaubt)):
        e = zeile(r)
        if mit_geloeschten:
            g, e["geloescht"] = e["geloescht"], None
            ok = darf_sehen(e, ich, module)
            e["geloescht"] = g
        else:
            ok = darf_sehen(e, ich, module)
        if ok:
            aus.append(e)
    return aus


# ---------------------------------------------------------------- Hinweise
def hinweis(person_id, schluessel, text, link="", art="info"):
    db().execute("INSERT OR IGNORE INTO hinweise(person_id, schluessel, text, link, art, zeit) VALUES(?,?,?,?,?,?)",
                 (person_id, schluessel, text, link, art, jetzt()))


def geburtstage_fuer(ich):
    """(name, datum date, jahr|None, link)"""
    c = db()
    aus = []
    for p in c.execute("SELECT * FROM personen WHERE aktiv=1 AND geburtstag IS NOT NULL AND geburtstag!=''"):
        d = datum_parse(p["geburtstag"])
        if d:
            aus.append((p["name"], d, d.year if d.year > 1900 else None, "#/mitglieder/%d" % p["id"]))
    for e in sichtbare(ich, ["kontakt", "geburtstag"]):
        g = e["datum"] if e["typ"] == "geburtstag" else e["daten"].get("geburtstag")
        d = datum_parse(g)
        if d:
            aus.append((e["titel"], d, d.year if d.year > 1900 else None, "#/geburtstage"))
    return aus


def jahrestag(d, ab):
    for j in (ab.year, ab.year + 1):
        try:
            x = d.replace(year=j)
        except ValueError:
            x = dt.date(j, 2, 28)
        if x >= ab:
            return x
    return None


def hinweise_erzeugen():
    c = db()
    h = heute()
    with SPERRE:
        for ich in c.execute("SELECT * FROM personen WHERE aktiv=1 AND pw IS NOT NULL").fetchall():
            mods = module_fuer(ich)
            # Aufgaben fällig/überfällig (mir zugewiesen)
            if "aufgaben" in mods:
                for e in sichtbare(ich, ["aufgabe"]):
                    d = datum_parse(e["datum"])
                    if e["erledigt"] or not d or e["zugewiesen_id"] not in (ich["id"], None):
                        continue
                    if e["zugewiesen_id"] is None and e["besitzer_id"] != ich["id"]:
                        continue
                    if d <= h:
                        hinweis(ich["id"], f"faellig:{e['id']}:{e['datum'][:10]}",
                                ("Überfällig: " if d < h else "Heute fällig: ") + e["titel"], "#/aufgaben", "aufgabe")
            if "geburtstage" in mods:
                for name, d, jahr, link in geburtstage_fuer(ich):
                    n = jahrestag(d, h)
                    if not n:
                        continue
                    tage = (n - h).days
                    alter = f" ({n.year - jahr})" if jahr else ""
                    if tage == 0:
                        hinweis(ich["id"], f"geb0:{name}:{n.year}", f"Heute hat {name} Geburtstag{alter}.", link, "geburtstag")
                    elif tage == 7:
                        hinweis(ich["id"], f"geb7:{name}:{n.year}", f"In einer Woche hat {name} Geburtstag{alter}.", link, "geburtstag")
            if "kalender" in mods:
                for e in sichtbare(ich, ["termin"]):
                    d = datum_parse(e["datum"])
                    if d == h and (e["daten"].get("wer") in (None, [], "") or ich["id"] in (e["daten"].get("wer") or [])):
                        zeit = e["datum"][11:16] if len(e["datum"] or "") > 10 else ""
                        hinweis(ich["id"], f"termin:{e['id']}:{h}", f"Heute {zeit + ' ' if zeit else ''}{e['titel']}",
                                "#/kalender", "termin")
            if "fahrzeuge" in mods:
                for e in sichtbare(ich, ["fahrzeug"]):
                    for feld, text in (("mfk", "MFK"), ("service", "Service"), ("versicherung", "Versicherung")):
                        d = datum_parse(e["daten"].get(feld))
                        if d and 0 <= (d - h).days <= 30:
                            hinweis(ich["id"], f"fz:{e['id']}:{feld}:{d}", f"{e['titel']}: {text} am {d.strftime('%d.%m.%Y')}",
                                    "#/fahrzeuge", "fahrzeug")
                    if h.month in (4, 10) and h.day == 1:
                        hinweis(ich["id"], f"reifen:{e['id']}:{h}", f"{e['titel']}: Reifenwechsel planen (O bis O)",
                                "#/fahrzeuge", "fahrzeug")
            if "haustiere" in mods:
                for e in sichtbare(ich, ["tier_eintrag"]):
                    d = datum_parse(e["daten"].get("naechstes"))
                    if d and 0 <= (d - h).days <= 7 and not e["erledigt"]:
                        hinweis(ich["id"], f"tier:{e['id']}:{d}", f"{e['titel']} fällig am {d.strftime('%d.%m.%Y')}",
                                "#/haustiere", "tier")
            if "vorrat" in mods:
                for e in sichtbare(ich, ["vorrat"]):
                    d = datum_parse(e["daten"].get("ablauf"))
                    if d and 0 <= (d - h).days <= 7:
                        hinweis(ich["id"], f"ablauf:{e['id']}:{d}", f"{e['titel']} läuft ab am {d.strftime('%d.%m.%Y')}",
                                "#/vorrat", "vorrat")
                    try:
                        menge, mind = float(e["daten"].get("menge") or 0), float(e["daten"].get("mindestens") or 0)
                    except (TypeError, ValueError):
                        continue
                    if mind and menge < mind:
                        hinweis(ich["id"], f"knapp:{e['id']}:{h.isocalendar()[1]}", f"Knapp: {e['titel']} ({menge:g} / {mind:g})",
                                "#/vorrat", "vorrat")


def telegram_morgen():
    """Für Personen mit daten.telegram=true und eigener Chat-ID: tägliche Übersicht (nur Alfred hat den Bot)."""
    try:
        env = dict(l.strip().split("=", 1) for l in open(os.path.expanduser("~/.config/basis-bot/env"))
                   if "=" in l and not l.startswith("#"))
        tok, chat = env["TELEGRAM_TOKEN"].strip("\"' "), env["ALLOWED_USER_ID"].strip()
    except Exception:
        return
    c = db()
    for p in c.execute("SELECT * FROM personen WHERE login='alfred'"):
        if not zeile(p)["daten"].get("telegram"):
            continue
        neu = c.execute("SELECT text FROM hinweise WHERE person_id=? AND gelesen=0 ORDER BY zeit DESC LIMIT 15",
                        (p["id"],)).fetchall()
        if not neu:
            continue
        text = "Hüsli – heute\n\n" + "\n".join("· " + r["text"] for r in neu)
        try:
            urllib.request.urlopen(urllib.request.Request(
                f"https://api.telegram.org/bot{tok}/sendMessage",
                data=json.dumps({"chat_id": chat, "text": text}).encode(),
                headers={"Content-Type": "application/json"}), timeout=20).read()
        except Exception:
            pass


def sicherung():
    name = os.path.join(BACKUP, "huesli-%s.db" % heute().isoformat())
    if os.path.exists(name):
        return
    with SPERRE:
        ziel = sqlite3.connect(name)
        db().backup(ziel)
        ziel.close()
    os.chmod(name, 0o600)
    alle = sorted(f for f in os.listdir(BACKUP) if f.startswith("huesli-") and f.endswith(".db"))
    for f in alle[:-14]:
        os.remove(os.path.join(BACKUP, f))


def papierkorb_leeren():
    grenze = (dt.datetime.now() - dt.timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%S")
    with SPERRE:
        db().execute("DELETE FROM eintraege WHERE geloescht IS NOT NULL AND geloescht < ?", (grenze,))
        db().execute("DELETE FROM sitzungen WHERE ablauf < ?", (jetzt(),))
        db().execute("DELETE FROM hinweise WHERE zeit < ?", ((dt.datetime.now() - dt.timedelta(days=60)).isoformat(),))


def hintergrund():
    letzter_tg = None
    while True:
        try:
            hinweise_erzeugen()
            sicherung()
            papierkorb_leeren()
            n = dt.datetime.now()
            if n.hour == 7 and letzter_tg != n.date():
                letzter_tg = n.date()
                telegram_morgen()
        except Exception as ex:  # nie den Dienst abstürzen lassen
            print("Hintergrund:", ex, flush=True)
        time.sleep(600)


# ---------------------------------------------------------------- iCal
def ical_text(s):
    return str(s).replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def ical(ich):
    rr = {"taeglich": "FREQ=DAILY", "woechentlich": "FREQ=WEEKLY", "zweiwoechentlich": "FREQ=WEEKLY;INTERVAL=2",
          "monatlich": "FREQ=MONTHLY", "quartal": "FREQ=MONTHLY;INTERVAL=3", "jaehrlich": "FREQ=YEARLY"}
    z = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Huesli//DE", "CALSCALE:GREGORIAN",
         "X-WR-CALNAME:Hüsli", "X-WR-TIMEZONE:Europe/Zurich"]
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    mods = module_fuer(ich)

    def ev(uid, titel, datum, ende=None, rrule=None, ort=None, text=None):
        if not datum:
            return
        z.extend(["BEGIN:VEVENT", f"UID:{uid}@huesli", f"DTSTAMP:{stamp}", "SUMMARY:" + ical_text(titel)])
        if len(datum) > 10:
            z.append("DTSTART;TZID=Europe/Zurich:" + datum[:16].replace("-", "").replace(":", "") + "00")
            e = ende if ende and len(ende) > 10 else None
            if not e:
                e = (dt.datetime.fromisoformat(datum[:16]) + dt.timedelta(hours=1)).isoformat()
            z.append("DTEND;TZID=Europe/Zurich:" + e[:16].replace("-", "").replace(":", "") + "00")
        else:
            d = datum_parse(datum)
            e = datum_parse(ende) or d
            z.append("DTSTART;VALUE=DATE:" + d.strftime("%Y%m%d"))
            z.append("DTEND;VALUE=DATE:" + (e + dt.timedelta(days=1)).strftime("%Y%m%d"))
        if rrule:
            z.append("RRULE:" + rrule)
        if ort:
            z.append("LOCATION:" + ical_text(ort))
        if text:
            z.append("DESCRIPTION:" + ical_text(text))
        z.append("END:VEVENT")

    if "kalender" in mods:
        for e in sichtbare(ich, ["termin"]):
            ev(f"t{e['id']}", e["titel"], e["datum"], e["daten"].get("ende"), rr.get(e["daten"].get("wiederholung", "")),
               e["daten"].get("ort"), e["daten"].get("notiz"))
    if "aufgaben" in mods:
        for e in sichtbare(ich, ["aufgabe"]):
            if not e["erledigt"] and e["datum"]:
                ev(f"a{e['id']}", "Aufgabe: " + e["titel"], e["datum"][:10])
    if "geburtstage" in mods:
        for i, (name, d, jahr, _) in enumerate(geburtstage_fuer(ich)):
            ev(f"g{i}-{name}", f"Geburtstag {name}", d.isoformat(), rrule="FREQ=YEARLY")
    z.append("END:VCALENDAR")
    return "\r\n".join(z) + "\r\n"


# ---------------------------------------------------------------- Eintrag-Logik
def text_feld(v, maxlen=300):
    v = "" if v is None else str(v)
    return v.strip()[:maxlen]


def daten_pruefen(d):
    if not isinstance(d, dict):
        raise Fehler(400, "daten muss ein Objekt sein")
    if len(json.dumps(d)) > 64_000:
        raise Fehler(413, "Eintrag zu gross")
    return d


def datum_pruefen(s):
    if s in (None, ""):
        return None
    s = str(s)
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?", s):
        raise Fehler(400, "Datum ungültig")
    return s


class Fehler(Exception):
    def __init__(self, code, text):
        super().__init__(text)
        self.code, self.text = code, text


def aktivitaet(ich, eintrag_id, aktion):
    db().execute("INSERT INTO aktivitaet(person_id, eintrag_id, aktion, zeit) VALUES(?,?,?,?)",
                 (ich["id"], eintrag_id, aktion, jetzt()))


def zuweisung_melden(ich, e):
    z = e.get("zugewiesen_id")
    if z and z != ich["id"]:
        hinweis(z, f"zu:{e['id']}:{time.time():.0f}", f"{ich['name']} hat dir zugewiesen: {e['titel']}",
                "#/aufgaben" if e["typ"] == "aufgabe" else "#/", "zuweisung")


def kinder_angleichen(e):
    """Untereinträge (Listenartikel, Ausgaben, Fahrtenbuch …) erben die Sichtbarkeit."""
    db().execute("UPDATE eintraege SET sicht=?, haushalt_id=?, freigabe=? WHERE eltern_id=?",
                 (e["sicht"], e["haushalt_id"], json.dumps(e["freigabe"]), e["id"]))


def eintrag_neu(ich, k):
    if ich["rolle"] == "gast":
        raise Fehler(403, "Gäste können nichts anlegen")
    typ = k.get("typ")
    if typ not in TYP_MODUL or TYP_MODUL[typ] not in module_fuer(ich):
        raise Fehler(400, "Unbekannter oder ausgeschalteter Typ")
    e = {"typ": typ, "haushalt_id": ich["haushalt_id"], "sicht": k.get("sicht") or "haushalt",
         "freigabe": [int(x) for x in k.get("freigabe") or [] if str(x).isdigit()],
         "besitzer_id": ich["id"], "eltern_id": None, "titel": text_feld(k.get("titel")),
         "datum": datum_pruefen(k.get("datum")), "erledigt": 1 if k.get("erledigt") else 0,
         "zugewiesen_id": k.get("zugewiesen_id") or None, "daten": daten_pruefen(k.get("daten") or {})}
    if e["sicht"] not in SICHT:
        raise Fehler(400, "Sichtbarkeit ungültig")
    if k.get("eltern_id"):
        p = eintrag_laden(int(k["eltern_id"]))
        if not p or not darf_aendern(p, ich):
            raise Fehler(404, "Übergeordneter Eintrag fehlt")
        e["eltern_id"] = p["id"]
        e["sicht"], e["haushalt_id"], e["freigabe"] = p["sicht"], p["haushalt_id"], p["freigabe"]
    t = jetzt()
    with SPERRE:
        e["id"] = db().execute(
            "INSERT INTO eintraege(typ, haushalt_id, sicht, freigabe, besitzer_id, eltern_id, titel, datum, erledigt,"
            " zugewiesen_id, daten, erstellt, geaendert, geaendert_von) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (e["typ"], e["haushalt_id"], e["sicht"], json.dumps(e["freigabe"]), e["besitzer_id"], e["eltern_id"],
             e["titel"], e["datum"], e["erledigt"], e["zugewiesen_id"], json.dumps(e["daten"]), t, t, ich["id"])).lastrowid
        aktivitaet(ich, e["id"], "neu")
        zuweisung_melden(ich, e)
    return eintrag_laden(e["id"])


def eintrag_aendern(ich, i, k):
    with SPERRE:
        e = eintrag_laden(i)
        if not e or not darf_sehen(e, ich):
            raise Fehler(404, "Nicht gefunden")
        if ich["rolle"] == "gast":
            # Gäste dürfen nur abhaken
            if set(k) - {"erledigt"}:
                raise Fehler(403, "Gäste dürfen nur abhaken")
        alt_zu = e["zugewiesen_id"]
        if "titel" in k:
            e["titel"] = text_feld(k["titel"])
        if "datum" in k:
            e["datum"] = datum_pruefen(k["datum"])
        if "zugewiesen_id" in k:
            e["zugewiesen_id"] = int(k["zugewiesen_id"]) if k["zugewiesen_id"] else None
        if "daten" in k:
            neu = dict(e["daten"])
            neu.update(daten_pruefen(k["daten"]))
            e["daten"] = {a: b for a, b in neu.items() if b is not None}
            daten_pruefen(e["daten"])
        sicht_neu = False
        if ("sicht" in k or "freigabe" in k) and e["eltern_id"] is None:
            # Nur Besitzer (oder bei Gemeinsamem: wer es sieht) ändert die Sichtbarkeit; Privates nur der Besitzer
            if e["besitzer_id"] != ich["id"] and (k.get("sicht") == "privat"):
                raise Fehler(403, "Nur der Besitzer kann etwas privat machen")
            if "sicht" in k:
                if k["sicht"] not in SICHT:
                    raise Fehler(400, "Sichtbarkeit ungültig")
                e["sicht"] = k["sicht"]
            if "freigabe" in k:
                e["freigabe"] = [int(x) for x in k["freigabe"] or [] if str(x).isdigit()]
            sicht_neu = True
        erledigt_jetzt = False
        if "erledigt" in k:
            wert = 1 if k["erledigt"] else 0
            w = e["daten"].get("wiederholung")
            if wert and e["typ"] == "aufgabe" and w in WIEDERHOLUNG and w:
                # Wiederkehrend: nächster Termin, ggf. reihum weitergeben
                verlauf = (e["daten"].get("verlauf") or [])[-19:]
                verlauf.append({"wer": ich["id"], "wann": jetzt()})
                e["daten"]["verlauf"] = verlauf
                e["datum"] = naechster_termin(e["datum"], w)
                reihum = e["daten"].get("reihum") or []
                if reihum and e["zugewiesen_id"] in reihum:
                    e["zugewiesen_id"] = reihum[(reihum.index(e["zugewiesen_id"]) + 1) % len(reihum)]
                elif reihum:
                    e["zugewiesen_id"] = reihum[0]
                e["erledigt"] = 0
            else:
                erledigt_jetzt = wert and not e["erledigt"]
                e["erledigt"] = wert
                if wert:
                    e["daten"]["erledigt_von"], e["daten"]["erledigt_am"] = ich["id"], jetzt()
            k_akt = "erledigt" if wert else "wieder offen"
        else:
            k_akt = "geändert"
        db().execute("UPDATE eintraege SET titel=?, datum=?, zugewiesen_id=?, daten=?, sicht=?, freigabe=?, erledigt=?,"
                     " geaendert=?, geaendert_von=? WHERE id=?",
                     (e["titel"], e["datum"], e["zugewiesen_id"], json.dumps(e["daten"]), e["sicht"],
                      json.dumps(e["freigabe"]), e["erledigt"], jetzt(), ich["id"], i))
        if sicht_neu:
            kinder_angleichen(e)
        aktivitaet(ich, i, k_akt)
        if e["zugewiesen_id"] != alt_zu:
            zuweisung_melden(ich, e)
        _ = erledigt_jetzt
    return eintrag_laden(i)


def eintrag_loeschen(ich, i, endgueltig=False):
    with SPERRE:
        e = eintrag_laden(i)
        if not e:
            raise Fehler(404, "Nicht gefunden")
        g = e["geloescht"]
        e["geloescht"] = None
        if not darf_sehen(e, ich) or not darf_loeschen(e, ich):
            raise Fehler(403, "Keine Berechtigung zum Löschen")
        if endgueltig:
            if not g:
                raise Fehler(400, "Zuerst in den Papierkorb")
            db().execute("DELETE FROM eintraege WHERE id=? OR eltern_id=?", (i, i))
        else:
            t = jetzt()
            db().execute("UPDATE eintraege SET geloescht=?, geaendert_von=? WHERE id=?", (t, ich["id"], i))
            db().execute("UPDATE eintraege SET geloescht=? WHERE eltern_id=? AND geloescht IS NULL", (t, i))
            aktivitaet(ich, i, "gelöscht")


def eintrag_wiederherstellen(ich, i):
    with SPERRE:
        e = eintrag_laden(i)
        if not e or not e["geloescht"]:
            raise Fehler(404, "Nicht im Papierkorb")
        g = e["geloescht"]
        e["geloescht"] = None
        if not darf_loeschen(e, ich):
            raise Fehler(403, "Keine Berechtigung")
        db().execute("UPDATE eintraege SET geloescht=NULL WHERE id=?", (i,))
        db().execute("UPDATE eintraege SET geloescht=NULL WHERE eltern_id=? AND geloescht=?", (i, g))
        aktivitaet(ich, i, "wiederhergestellt")
    return eintrag_laden(i)


# ---------------------------------------------------------------- Personen/Haushalte
FARBE = re.compile(r"#[0-9a-fA-F]{6}")


def person_aendern(ich, pid, k):
    c = db()
    p = c.execute("SELECT * FROM personen WHERE id=?", (pid,)).fetchone()
    if not p:
        raise Fehler(404, "Person fehlt")
    admin = ich["rolle"] == "admin"
    selbst = p["id"] == ich["id"]
    eigenes_kind = p["rolle"] in ("kind", "tier") and p["haushalt_id"] == ich["haushalt_id"] and ich["rolle"] == "erwachsen"
    if not (admin or selbst or eigenes_kind):
        raise Fehler(403, "Keine Berechtigung")
    felder = {}
    if "name" in k:
        felder["name"] = text_feld(k["name"], 60) or p["name"]
    if "farbe" in k and FARBE.fullmatch(str(k["farbe"])):
        felder["farbe"] = k["farbe"]
    if "emoji" in k:
        felder["emoji"] = text_feld(k["emoji"], 16)
    if "geburtstag" in k:
        felder["geburtstag"] = datum_pruefen(k["geburtstag"])
    if "daten" in k:
        d = zeile(p)["daten"]
        neu = daten_pruefen(k["daten"])
        if not admin:
            neu.pop("module", None)
        d.update(neu)
        felder["daten"] = json.dumps({a: b for a, b in d.items() if b is not None})
    if admin:
        if "rolle" in k and k["rolle"] in ROLLEN:
            if p["id"] == ich["id"] and k["rolle"] != "admin":
                raise Fehler(400, "Du kannst dir die Admin-Rolle nicht selbst nehmen")
            felder["rolle"] = k["rolle"]
        if "haushalt_id" in k:
            if not c.execute("SELECT 1 FROM haushalte WHERE id=?", (k["haushalt_id"],)).fetchone():
                raise Fehler(400, "Haushalt fehlt")
            felder["haushalt_id"] = int(k["haushalt_id"])
        if "login" in k:
            lg = text_feld(k["login"], 40).lower() or None
            if lg and not re.fullmatch(r"[a-z0-9._-]{2,40}", lg):
                raise Fehler(400, "Login: nur a–z, 0–9, . _ -")
            felder["login"] = lg
        if "aktiv" in k:
            if p["id"] == ich["id"]:
                raise Fehler(400, "Du kannst dich nicht selbst deaktivieren")
            felder["aktiv"] = 1 if k["aktiv"] else 0
            if not k["aktiv"]:
                c.execute("DELETE FROM sitzungen WHERE person_id=?", (pid,))
    if felder:
        with SPERRE:
            try:
                c.execute("UPDATE personen SET %s WHERE id=?" % ",".join(f"{a}=?" for a in felder),
                          list(felder.values()) + [pid])
            except sqlite3.IntegrityError:
                raise Fehler(400, "Login-Name schon vergeben")
            if felder.get("rolle") in ("kind", "tier"):
                c.execute("UPDATE personen SET pw=NULL WHERE id=?", (pid,))
                c.execute("DELETE FROM sitzungen WHERE person_id=?", (pid,))
    return c.execute("SELECT * FROM personen WHERE id=?", (pid,)).fetchone()


def person_neu(ich, k):
    rolle = k.get("rolle") or "erwachsen"
    if ich["rolle"] == "admin":
        pass
    elif ich["rolle"] == "erwachsen" and rolle in ("kind", "tier"):
        k["haushalt_id"] = ich["haushalt_id"]
    else:
        raise Fehler(403, "Nur der Admin kann Erwachsene oder Gäste hinzufügen")
    if rolle not in ROLLEN or rolle == "admin" and ich["rolle"] != "admin":
        raise Fehler(400, "Rolle ungültig")
    name = text_feld(k.get("name"), 60)
    if not name:
        raise Fehler(400, "Name fehlt")
    hh = int(k.get("haushalt_id") or ich["haushalt_id"])
    login = None
    if rolle in MIT_LOGIN:
        basis = re.sub(r"[^a-z0-9]", "", name.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")) or "person"
        login, n = basis, 2
        while db().execute("SELECT 1 FROM personen WHERE login=?", (login,)).fetchone():
            login, n = f"{basis}{n}", n + 1
    with SPERRE:
        pid = db().execute("INSERT INTO personen(name, rolle, haushalt_id, login, farbe, emoji, geburtstag, daten, ical, erstellt)"
                           " VALUES(?,?,?,?,?,?,?,?,?,?)",
                           (name, rolle, hh, login, k.get("farbe") if FARBE.fullmatch(str(k.get("farbe"))) else "#5b7c99",
                            text_feld(k.get("emoji") or ("🐾" if rolle == "tier" else "🙂"), 16),
                            datum_pruefen(k.get("geburtstag")), json.dumps(daten_pruefen(k.get("daten") or {})),
                            secrets.token_urlsafe(18), jetzt())).lastrowid
    return db().execute("SELECT * FROM personen WHERE id=?", (pid,)).fetchone()


# ---------------------------------------------------------------- Kurzbefehle (Siri, Teilen)
ZAHLWOERTER = {"ein": 1, "eine": 1, "einen": 1, "eins": 1, "zwei": 2, "drei": 3, "vier": 4, "fünf": 5, "sechs": 6, "sieben": 7,
               "acht": 8, "neun": 9, "zehn": 10, "elf": 11, "zwölf": 12}
EINHEITEN = {"l": "l", "liter": "l", "dl": "dl", "deziliter": "dl", "cl": "cl", "ml": "ml", "kg": "kg", "kilo": "kg", "kilogramm": "kg",
             "g": "g", "gramm": "g", "stk": "Stk", "stück": "Stk", "x": "x", "pack": "Pack", "packung": "Pack", "packungen": "Pack",
             "pkt": "Pack", "bund": "Bund", "dose": "Dose", "dosen": "Dosen", "flasche": "Flasche", "flaschen": "Flaschen",
             "becher": "Becher", "glas": "Glas", "gläser": "Gläser", "beutel": "Beutel", "sack": "Sack", "säcke": "Säcke"}
ZIELE = {"einkauf": "einkauf", "einkaufsliste": "einkauf", "einkaufen": "einkauf", "aufgabe": "aufgabe", "aufgaben": "aufgabe",
         "todo": "aufgabe", "to-do": "aufgabe", "notiz": "notiz", "notizen": "notiz"}


def einkauf_zerlegen(text):
    """«2 Liter Milch, Katzenstreu und Brot» → [(menge, titel), …]"""
    aus = []
    for teil in re.split(r"\s*(?:\n|(?<!\d),|,(?!\d)|;|\bund\b|\+)\s*", text, flags=re.I):
        teil = teil.strip(" .!?-•*\t\"'«»").strip()
        teil = re.sub(r"^\[[ xX]?\]\s*", "", teil)  # Checklisten-Kästchen aus Notizen
        if not teil:
            continue
        menge = ""
        m = re.match(r"^(\d+(?:[.,]\d+)?|%s)\s*(%s)?\.?\s+(.+)$" % ("|".join(ZAHLWOERTER), "|".join(sorted(EINHEITEN, key=len, reverse=True))),
                     teil, re.I)
        if m:
            z = m.group(1).lower()
            zahl = str(ZAHLWOERTER[z]) if z in ZAHLWOERTER else m.group(1)
            einheit = EINHEITEN.get((m.group(2) or "").lower(), "")
            menge = f"{zahl} {einheit}".strip() if einheit else zahl
            teil = m.group(3).strip()
        if menge == "1" and not (m and m.group(2)):
            menge = ""  # «eine Gurke» → einfach «Gurke»
        titel = teil[:1].upper() + teil[1:]
        aus.append((menge, titel[:300]))
    return aus[:50]


def kurzbefehl_person(token):
    r = db().execute("SELECT p.* FROM kurzbefehle k JOIN personen p ON p.id=k.person_id WHERE k.token=? AND p.aktiv=1"
                     " AND p.pw IS NOT NULL", (token,)).fetchone()
    if r:
        db().execute("UPDATE kurzbefehle SET benutzt=? WHERE token=?", (jetzt(), token))
    return r


def gleich(a, b):
    return re.sub(r"\s+", " ", a.strip().lower()) == re.sub(r"\s+", " ", b.strip().lower())


def kurzbefehl_ausfuehren(ich, ziel, text, liste_name=""):
    """Gibt eine kurze Antwort (für Siri) zurück."""
    if ich["rolle"] == "gast":
        raise Fehler(403, "Gäste können nichts hinzufügen.")
    text = (text or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text:
        raise Fehler(400, "Kein Text bekommen.")
    if len(text) > 20000:
        raise Fehler(413, "Der Text ist zu lang.")
    if ziel == "einkauf":
        if "einkauf" not in module_fuer(ich):
            raise Fehler(403, "Das Modul Einkauf ist ausgeschaltet.")
        listen = [e for e in sichtbare(ich, ["einkauf_liste"])]
        listen.sort(key=lambda e: (e["haushalt_id"] != ich["haushalt_id"], e["id"]))
        if liste_name:
            passend = [e for e in listen if gleich(e["titel"], liste_name)]
            listen = passend or listen
        if not listen:
            raise Fehler(404, "Es gibt noch keine Einkaufsliste.")
        liste = listen[0]
        offen = [e for e in sichtbare(ich, ["einkauf"]) if e["eltern_id"] == liste["id"] and not e["erledigt"]]
        neu_titel, schon = [], []
        for menge, titel in einkauf_zerlegen(text):
            if any(gleich(o["titel"], titel) for o in offen) or any(gleich(t, titel) for t in neu_titel):
                schon.append(titel)
                continue
            eintrag_neu(ich, {"typ": "einkauf", "eltern_id": liste["id"], "titel": titel,
                              "daten": {"menge": menge} if menge else {}})
            neu_titel.append(titel)
        if not neu_titel and not schon:
            raise Fehler(400, "Kein Artikel erkannt.")
        teile = []
        if neu_titel:
            teile.append(f"Auf «{liste['titel']}»: " + ", ".join(neu_titel) + ".")
        if schon:
            teile.append("Schon drauf: " + ", ".join(schon) + ".")
        return " ".join(teile)
    if ziel == "aufgabe":
        zeilen = [z.strip() for z in text.split("\n") if z.strip()]
        titel = zeilen[0].strip(" .")
        titel = titel[:1].upper() + titel[1:]
        rest = "\n".join(zeilen[1:])
        if len(titel) > 300:
            rest, titel = titel + ("\n" + rest if rest else ""), titel[:120] + " …"
        daten = {"notiz": rest[:5000]} if rest else {}
        eintrag_neu(ich, {"typ": "aufgabe", "titel": titel, "sicht": "haushalt", "zugewiesen_id": ich["id"], "daten": daten})
        return f"Aufgabe gespeichert: {titel}."
    if ziel == "notiz":
        erste = next((z.strip() for z in text.split("\n") if z.strip()), "")
        titel = erste if len(erste) <= 80 and "\n" in text else ""
        inhalt = text[len(erste):].lstrip("\n") if titel else text
        eintrag_neu(ich, {"typ": "notiz", "titel": titel, "sicht": "privat", "daten": {"text": inhalt[:20000]}})
        return "Notiz gespeichert" + (f": {titel}." if titel else ".")
    raise Fehler(404, "Unbekanntes Ziel. Erlaubt: Einkauf, Aufgabe, Notiz.")


# ---------------------------------------------------------------- HTTP
VERSUCHE = {}  # (ip, login) → [zeiten]
MIME = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
        ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json",
        ".ico": "image/x-icon", ".woff2": "font/woff2"}


class Handler(BaseHTTPRequestHandler):
    server_version = "Huesli"
    sys_version = ""
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        pass  # keine Zugriffsprotokolle (SD-Karte, Privatsphäre)

    # --- Antworten
    def kopf(self, code, typ, laenge, extra=None):
        self.send_response(code)
        self.send_header("Content-Type", typ)
        self.send_header("Content-Length", str(laenge))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Content-Security-Policy", "default-src 'self'; img-src 'self' data: blob:; style-src 'self';"
                         " script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        for a, b in (extra or {}).items():
            if isinstance(b, list):
                for x in b:
                    self.send_header(a, x)
            else:
                self.send_header(a, b)
        self.end_headers()

    def json(self, obj, code=200, extra=None):
        b = json.dumps(obj, ensure_ascii=False).encode()
        h = {"Cache-Control": "no-store"}
        h.update(extra or {})
        self.kopf(code, "application/json; charset=utf-8", len(b), h)
        self.wfile.write(b)

    def fehler(self, code, text):
        self.json({"fehler": text}, code)

    # --- Hilfen
    def pfad(self):
        p = urllib.parse.urlsplit(self.path)
        roh = p.path
        if ".." in roh or re.search(r"%2e|%2f|%5c|\\", roh, re.I):
            return None, {}
        if roh == PRAEFIX:
            roh = PRAEFIX + "/"
        if roh.startswith(PRAEFIX + "/"):
            roh = roh[len(PRAEFIX):]
        return roh, urllib.parse.parse_qs(p.query)

    def koerper(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_KOERPER:
            raise Fehler(413, "Zu gross")
        if n == 0:
            return {}
        try:
            k = json.loads(self.rfile.read(n))
        except Exception:
            raise Fehler(400, "Kein gültiges JSON")
        if not isinstance(k, dict):
            raise Fehler(400, "Objekt erwartet")
        return k

    def ich(self):
        ck = self.headers.get("Cookie") or ""
        m = re.search(r"(?:^|;\s*)huesli=([A-Za-z0-9_-]+)", ck)
        if not m:
            return None
        r = db().execute("SELECT p.* FROM sitzungen s JOIN personen p ON p.id=s.person_id WHERE s.token=? AND s.ablauf>?"
                         " AND p.aktiv=1 AND p.pw IS NOT NULL", (tok_hash(m.group(1)), jetzt())).fetchone()
        return r

    def statisch(self, roh):
        if roh in ("/", ""):
            roh = "/index.html"
        name = os.path.normpath(os.path.join(STATIC, roh.lstrip("/")))
        if not name.startswith(STATIC + os.sep) or not os.path.isfile(name):
            return self.fehler(404, "Nicht gefunden")
        with open(name, "rb") as f:
            b = f.read()
        typ = MIME.get(os.path.splitext(name)[1], "application/octet-stream")
        cache = "no-cache"
        self.kopf(200, typ, len(b), {"Cache-Control": cache})
        if self.command != "HEAD":
            self.wfile.write(b)

    # --- Verteiler
    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        self.verteilen("GET")

    def do_POST(self):
        self.verteilen("POST")

    def do_PATCH(self):
        self.verteilen("PATCH")

    def do_DELETE(self):
        self.verteilen("DELETE")

    def verteilen(self, methode):
        try:
            roh, q = self.pfad()
            if roh is None:
                return self.fehler(404, "Nicht gefunden")
            if roh.startswith("/ical/"):
                return self.ical_feed(roh)
            if roh.startswith("/k/"):
                return self.kurzbefehl(methode, roh, q)
            if not roh.startswith("/api/"):
                if methode not in ("GET",):
                    return self.fehler(405, "Nicht erlaubt")
                return self.statisch(roh)
            if methode != "GET" and self.headers.get("X-Huesli") != "1":
                return self.fehler(403, "Fehlender Schutz-Header")
            return self.api(methode, roh[4:], q)
        except Fehler as f:
            return self.fehler(f.code, f.text)
        except BrokenPipeError:
            pass
        except Exception as ex:
            print("Fehler:", repr(ex), flush=True)
            return self.fehler(500, "Interner Fehler")

    def ical_feed(self, roh):
        m = re.fullmatch(r"/ical/([A-Za-z0-9_-]{20,40})\.ics", roh)
        p = m and db().execute("SELECT * FROM personen WHERE ical=? AND aktiv=1 AND pw IS NOT NULL", (m.group(1),)).fetchone()
        if not p:
            return self.fehler(404, "Nicht gefunden")
        b = ical(p).encode()
        self.kopf(200, "text/calendar; charset=utf-8", len(b), {"Cache-Control": "no-store"})
        self.wfile.write(b)

    def text_antwort(self, code, text):
        b = (text + "\n").encode()
        self.kopf(code, "text/plain; charset=utf-8", len(b), {"Cache-Control": "no-store"})
        if self.command != "HEAD":
            self.wfile.write(b)

    def formular_lesen(self):
        """Liest Text aus Formular (urlencoded oder multipart), JSON oder reinem Text."""
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_KOERPER:
            raise Fehler(413, "Zu gross")
        roh = self.rfile.read(n) if n else b""
        typ = (self.headers.get("Content-Type") or "").lower()
        felder = {}
        if "application/json" in typ:
            try:
                d = json.loads(roh or b"{}")
            except Exception:
                raise Fehler(400, "Kein gültiges JSON.")
            if isinstance(d, dict):
                felder = {k: str(v) for k, v in d.items() if isinstance(v, (str, int, float))}
            elif isinstance(d, str):
                felder = {"text": d}
        elif "application/x-www-form-urlencoded" in typ:
            felder = {k: v[0] for k, v in urllib.parse.parse_qs(roh.decode("utf-8", "replace"), keep_blank_values=True).items()}
        elif "multipart/form-data" in typ:
            from email.parser import BytesParser
            from email.policy import HTTP
            msg = BytesParser(policy=HTTP).parsebytes(b"Content-Type: " + self.headers.get("Content-Type").encode() + b"\r\n\r\n" + roh)
            for teil in msg.iter_parts():
                name = teil.get_param("name", header="content-disposition")
                if not name:
                    continue
                ctyp = teil.get_content_type()
                if teil.get_filename() and not ctyp.startswith("text/"):
                    raise Fehler(415, "Nur Text wird übernommen (keine Bilder oder Dateien).")
                nutz = teil.get_payload(decode=True) or b""
                felder[name] = nutz.decode(teil.get_content_charset() or "utf-8", "replace")
        elif roh:
            felder = {"text": roh.decode("utf-8", "replace")}
        return felder

    def kurzbefehl(self, methode, roh, q):
        m = re.fullmatch(r"/k/([A-Za-z0-9_-]{30,60})(?:/([A-Za-zäöüÄÖÜ-]+))?/?", urllib.parse.unquote(roh))
        if not m:
            return self.text_antwort(404, "Nicht gefunden.")
        if methode == "GET":
            p = kurzbefehl_person(m.group(1))
            return self.text_antwort(200 if p else 404, f"Hüsli-Kurzbefehl für {p['name']} ist bereit." if p else "Schlüssel ungültig oder gesperrt.")
        if methode != "POST":
            return self.text_antwort(405, "Nicht erlaubt.")
        felder = self.formular_lesen()
        ich = kurzbefehl_person(m.group(1))
        if not ich:
            time.sleep(0.5)
            return self.text_antwort(404, "Schlüssel ungültig oder gesperrt. Bitte in Hüsli unter Einstellungen neu einrichten.")
        ziel_roh = (m.group(2) or felder.get("ziel") or (q.get("ziel") or [""])[0]).strip().lower()
        ziel = ZIELE.get(ziel_roh)
        if not ziel:
            return self.text_antwort(400, "Wohin? Erlaubt sind Einkauf, Aufgabe oder Notiz.")
        text = felder.get("text") or (q.get("text") or [""])[0]
        try:
            with SPERRE:
                antwort = kurzbefehl_ausfuehren(ich, ziel, text, felder.get("liste", ""))
        except Fehler as f:
            return self.text_antwort(f.code, f.text)
        return self.text_antwort(200, antwort)

    def api(self, m, pf, q):
        c = db()
        # ---- ohne Anmeldung
        if pf == "/anmelden" and m == "POST":
            return self.anmelden(self.koerper())
        if pf == "/einladung" and m == "GET":
            code = (q.get("code") or [""])[0]
            r = c.execute("SELECT p.name, p.login FROM einladungen e JOIN personen p ON p.id=e.person_id"
                          " WHERE e.code=? AND e.ablauf>?", (tok_hash(code), jetzt())).fetchone()
            return self.json({"name": r["name"], "login": r["login"]}) if r else self.fehler(404, "Einladung ungültig oder abgelaufen")
        if pf == "/einladung" and m == "POST":
            return self.einladung_annehmen(self.koerper())
        ich = self.ich()
        if not ich:
            return self.fehler(401, "Bitte anmelden")
        if pf == "/abmelden" and m == "POST":
            ck = re.search(r"huesli=([A-Za-z0-9_-]+)", self.headers.get("Cookie") or "")
            if ck:
                c.execute("DELETE FROM sitzungen WHERE token=?", (tok_hash(ck.group(1)),))
            return self.json({"ok": True}, extra={"Set-Cookie": self.cookie("", 0)})
        if pf == "/ich" and m == "GET":
            return self.json(self.start(ich))
        if pf == "/daten" and m == "GET":
            return self.json({"eintraege": sichtbare(ich), "zeit": jetzt()})
        if pf == "/eintraege" and m == "POST":
            return self.json(eintrag_neu(ich, self.koerper()), 201)
        if pf == "/eintraege/mehrere" and m == "POST":
            k = self.koerper()
            liste = k.get("eintraege") or []
            if not isinstance(liste, list) or len(liste) > 500:
                raise Fehler(400, "Liste ungültig (max. 500)")
            with SPERRE:
                c.execute("BEGIN")
                try:
                    aus = [eintrag_neu(ich, x) for x in liste]
                    c.execute("COMMIT")
                except Exception:
                    c.execute("ROLLBACK")
                    raise
            return self.json({"eintraege": aus}, 201)
        mt = re.fullmatch(r"/eintraege/(\d+)(/wiederherstellen)?", pf)
        if mt:
            i = int(mt.group(1))
            if mt.group(2) and m == "POST":
                return self.json(eintrag_wiederherstellen(ich, i))
            if m == "PATCH":
                return self.json(eintrag_aendern(ich, i, self.koerper()))
            if m == "DELETE":
                eintrag_loeschen(ich, i, (q.get("endgueltig") or [""])[0] == "1")
                return self.json({"ok": True})
        if pf == "/papierkorb" and m == "GET":
            aus = [e for e in sichtbare(ich, mit_geloeschten=True) if e["geloescht"] and darf_loeschen(dict(e, geloescht=None), ich)]
            # Untereinträge, die mit dem Eltern-Eintrag gelöscht wurden, nicht einzeln zeigen
            ids = {e["id"] for e in aus}
            aus = [e for e in aus if e["eltern_id"] not in ids]
            return self.json({"eintraege": sorted(aus, key=lambda e: e["geloescht"], reverse=True)})
        if pf == "/aktivitaet" and m == "GET":
            return self.json({"aktivitaet": self.aktivitaet_liste(ich)})
        if pf == "/hinweise" and m == "GET":
            rs = c.execute("SELECT * FROM hinweise WHERE person_id=? ORDER BY zeit DESC LIMIT 100", (ich["id"],)).fetchall()
            return self.json({"hinweise": [dict(r) for r in rs]})
        if pf == "/hinweise/gelesen" and m == "POST":
            k = self.koerper()
            if k.get("alle"):
                c.execute("UPDATE hinweise SET gelesen=1 WHERE person_id=?", (ich["id"],))
            else:
                c.execute("UPDATE hinweise SET gelesen=1 WHERE person_id=? AND id=?", (ich["id"], int(k.get("id") or 0)))
            return self.json({"ok": True})
        if pf == "/hinweise/pruefen" and m == "POST":
            hinweise_erzeugen()
            return self.json({"ok": True})
        if pf == "/passwort" and m == "POST":
            k = self.koerper()
            if not pw_pruefen(str(k.get("alt", "")), ich["pw"]):
                raise Fehler(400, "Bisheriges Passwort stimmt nicht")
            neu = str(k.get("neu", ""))
            if len(neu) < 8:
                raise Fehler(400, "Mindestens 8 Zeichen")
            c.execute("UPDATE personen SET pw=? WHERE id=?", (pw_hash(neu), ich["id"]))
            c.execute("DELETE FROM sitzungen WHERE person_id=? AND token!=?",
                      (ich["id"], tok_hash(re.search(r"huesli=([A-Za-z0-9_-]+)", self.headers.get("Cookie")).group(1))))
            return self.json({"ok": True})
        if pf == "/kurzbefehl" and m == "GET":
            r = c.execute("SELECT token, erstellt, benutzt FROM kurzbefehle WHERE person_id=?", (ich["id"],)).fetchone()
            return self.json({"aktiv": bool(r), "token": r["token"] if r else None, "erstellt": r["erstellt"] if r else None,
                              "benutzt": r["benutzt"] if r else None})
        if pf == "/kurzbefehl/neu" and m == "POST":
            if ich["rolle"] == "gast":
                raise Fehler(403, "Gäste können keine Kurzbefehle einrichten")
            t = secrets.token_urlsafe(32)
            with SPERRE:
                c.execute("DELETE FROM kurzbefehle WHERE person_id=?", (ich["id"],))
                c.execute("INSERT INTO kurzbefehle(token, person_id, erstellt) VALUES(?,?,?)", (t, ich["id"], jetzt()))
            return self.json({"token": t})
        if pf == "/kurzbefehl" and m == "DELETE":
            c.execute("DELETE FROM kurzbefehle WHERE person_id=?", (ich["id"],))
            return self.json({"ok": True})
        if pf == "/ical/neu" and m == "POST":
            c.execute("UPDATE personen SET ical=? WHERE id=?", (secrets.token_urlsafe(18), ich["id"]))
            return self.json({"ok": True})
        if pf == "/sitzungen" and m == "GET":
            rs = c.execute("SELECT erstellt, ablauf, geraet FROM sitzungen WHERE person_id=? ORDER BY erstellt DESC",
                           (ich["id"],)).fetchall()
            return self.json({"sitzungen": [dict(r) for r in rs]})
        if pf == "/sitzungen/alle" and m == "DELETE":
            c.execute("DELETE FROM sitzungen WHERE person_id=?", (ich["id"],))
            return self.json({"ok": True}, extra={"Set-Cookie": self.cookie("", 0)})
        # ---- Personen und Haushalte
        if pf == "/personen" and m == "POST":
            return self.json(person_oeffentlich(person_neu(ich, self.koerper()), ich), 201)
        mt = re.fullmatch(r"/personen/(\d+)(/einladung)?", pf)
        if mt:
            pid = int(mt.group(1))
            if mt.group(2) and m == "POST":
                return self.einladung_erstellen(ich, pid)
            if m == "PATCH":
                return self.json(person_oeffentlich(person_aendern(ich, pid, self.koerper()), ich))
            if m == "DELETE":
                if ich["rolle"] != "admin" or pid == ich["id"]:
                    raise Fehler(403, "Nur der Admin (nicht sich selbst)")
                # Lieber deaktivieren als löschen: Einträge bleiben erhalten
                c.execute("UPDATE personen SET aktiv=0, pw=NULL WHERE id=?", (pid,))
                c.execute("DELETE FROM sitzungen WHERE person_id=?", (pid,))
                return self.json({"ok": True})
        if pf == "/haushalte" and m == "POST":
            if ich["rolle"] != "admin":
                raise Fehler(403, "Nur der Admin")
            k = self.koerper()
            i = c.execute("INSERT INTO haushalte(name, emoji, module, erstellt) VALUES(?,?,?,?)",
                          (text_feld(k.get("name"), 60) or "Neuer Haushalt", text_feld(k.get("emoji") or "🏠", 16),
                           json.dumps(STANDARD_MODULE), jetzt())).lastrowid
            return self.json(zeile(c.execute("SELECT * FROM haushalte WHERE id=?", (i,)).fetchone()), 201)
        mt = re.fullmatch(r"/haushalte/(\d+)", pf)
        if mt and m == "PATCH":
            hid = int(mt.group(1))
            k = self.koerper()
            if not (ich["rolle"] == "admin" or ich["rolle"] == "erwachsen" and ich["haushalt_id"] == hid):
                raise Fehler(403, "Nur eigener Haushalt")
            h = c.execute("SELECT * FROM haushalte WHERE id=?", (hid,)).fetchone()
            if not h:
                raise Fehler(404, "Haushalt fehlt")
            name = text_feld(k.get("name"), 60) or h["name"]
            emoji = text_feld(k.get("emoji"), 16) or h["emoji"]
            mods = [x for x in k["module"] if x in MODULE] if isinstance(k.get("module"), list) else json.loads(h["module"])
            c.execute("UPDATE haushalte SET name=?, emoji=?, module=? WHERE id=?", (name, emoji, json.dumps(mods), hid))
            return self.json(zeile(c.execute("SELECT * FROM haushalte WHERE id=?", (hid,)).fetchone()))
        if mt and m == "DELETE":
            hid = int(mt.group(1))
            if ich["rolle"] != "admin":
                raise Fehler(403, "Nur der Admin")
            if c.execute("SELECT 1 FROM personen WHERE haushalt_id=? AND aktiv=1", (hid,)).fetchone():
                raise Fehler(400, "Haushalt hat noch Mitglieder")
            c.execute("DELETE FROM haushalte WHERE id=?", (hid,))
            return self.json({"ok": True})
        if pf == "/sicherung" and m == "GET":
            if ich["rolle"] != "admin":
                raise Fehler(403, "Nur der Admin")
            return self.sicherung_senden()
        if pf == "/export" and m == "GET":
            daten = {"exportiert": jetzt(), "person": ich["name"], "eintraege": sichtbare(ich)}
            b = json.dumps(daten, ensure_ascii=False, indent=1).encode()
            self.kopf(200, "application/json; charset=utf-8", len(b),
                      {"Content-Disposition": 'attachment; filename="huesli-export.json"', "Cache-Control": "no-store"})
            return self.wfile.write(b)
        raise Fehler(404, "Unbekannte Schnittstelle")

    # ---- Teile
    def cookie(self, wert, max_age):
        sicher = "" if os.environ.get("HUESLI_TEST_HTTP") == "1" else " Secure;"
        return f"huesli={wert}; Path={PRAEFIX}; Max-Age={max_age}; HttpOnly;{sicher} SameSite=Strict"

    def sitzung_neu(self, person_id):
        t = secrets.token_urlsafe(32)
        ablauf = (dt.datetime.now() + dt.timedelta(days=SITZUNG_TAGE)).strftime("%Y-%m-%dT%H:%M:%S")
        geraet = text_feld(self.headers.get("User-Agent"), 160)
        db().execute("INSERT INTO sitzungen VALUES(?,?,?,?,?)", (tok_hash(t), person_id, ablauf, jetzt(), geraet))
        return self.cookie(t, SITZUNG_TAGE * 86400)

    def anmelden(self, k):
        login = text_feld(k.get("login"), 40).lower()
        ip = self.headers.get("X-Forwarded-For", self.client_address[0]).split(",")[0].strip()
        schl = (ip, login)
        jetzt_t = time.time()
        VERSUCHE[schl] = [t for t in VERSUCHE.get(schl, []) if jetzt_t - t < 900]
        if len(VERSUCHE[schl]) >= 8:
            raise Fehler(429, "Zu viele Versuche – bitte 15 Minuten warten")
        p = db().execute("SELECT * FROM personen WHERE login=? AND aktiv=1 AND pw IS NOT NULL", (login,)).fetchone()
        if not p or not pw_pruefen(str(k.get("passwort", "")), p["pw"]):
            VERSUCHE[schl].append(jetzt_t)
            time.sleep(0.5)
            raise Fehler(401, "Name oder Passwort falsch")
        VERSUCHE.pop(schl, None)
        return self.json({"ok": True}, extra={"Set-Cookie": self.sitzung_neu(p["id"])})

    def einladung_erstellen(self, ich, pid):
        p = db().execute("SELECT * FROM personen WHERE id=?", (pid,)).fetchone()
        if not p or p["rolle"] not in MIT_LOGIN:
            raise Fehler(400, "Diese Person kann sich nicht anmelden")
        if ich["rolle"] != "admin":
            raise Fehler(403, "Nur der Admin")
        code = secrets.token_urlsafe(24)
        db().execute("DELETE FROM einladungen WHERE person_id=?", (pid,))
        db().execute("INSERT INTO einladungen VALUES(?,?,?)",
                     (tok_hash(code), pid, (dt.datetime.now() + dt.timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%S")))
        return self.json({"code": code, "gueltig_tage": 7})

    def einladung_annehmen(self, k):
        c = db()
        r = c.execute("SELECT * FROM einladungen WHERE code=? AND ablauf>?", (tok_hash(str(k.get("code", ""))), jetzt())).fetchone()
        if not r:
            raise Fehler(404, "Einladung ungültig oder abgelaufen")
        pw = str(k.get("passwort", ""))
        if len(pw) < 8:
            raise Fehler(400, "Passwort: mindestens 8 Zeichen")
        with SPERRE:
            c.execute("UPDATE personen SET pw=? WHERE id=?", (pw_hash(pw), r["person_id"]))
            c.execute("DELETE FROM einladungen WHERE person_id=?", (r["person_id"],))
            c.execute("DELETE FROM sitzungen WHERE person_id=?", (r["person_id"],))
        return self.json({"ok": True}, extra={"Set-Cookie": self.sitzung_neu(r["person_id"])})

    def start(self, ich):
        c = db()
        personen = [person_oeffentlich(p, ich) for p in c.execute("SELECT * FROM personen ORDER BY haushalt_id, id")]
        if ich["rolle"] == "gast":
            personen = [p for p in personen if p["haushalt_id"] == ich["haushalt_id"] or p["id"] == ich["id"]]
        haushalte = [zeile(h) for h in c.execute("SELECT * FROM haushalte ORDER BY id")]
        offen = c.execute("SELECT COUNT(*) FROM hinweise WHERE person_id=? AND gelesen=0", (ich["id"],)).fetchone()[0]
        return {"ich": person_oeffentlich(ich, ich), "personen": personen, "haushalte": haushalte,
                "module": module_fuer(ich), "alle_module": list(MODULE), "hinweise_offen": offen,
                "eintraege": sichtbare(ich), "zeit": jetzt()}

    def aktivitaet_liste(self, ich):
        c = db()
        aus, gesehen = [], {}
        mods = module_fuer(ich)
        for r in c.execute("SELECT * FROM aktivitaet ORDER BY id DESC LIMIT 400"):
            i = r["eintrag_id"]
            if i not in gesehen:
                e = eintrag_laden(i)
                gesehen[i] = e if e and darf_sehen(e, ich, mods) else None
            e = gesehen[i]
            if e:
                aus.append({"person_id": r["person_id"], "aktion": r["aktion"], "zeit": r["zeit"], "eintrag_id": i,
                            "typ": e["typ"], "titel": e["titel"], "eltern_id": e["eltern_id"]})
            if len(aus) >= 60:
                break
        return aus

    def sicherung_senden(self):
        name = os.path.join(DATEN, ".export.db")
        with SPERRE:
            ziel = sqlite3.connect(name)
            db().backup(ziel)
            ziel.close()
        with open(name, "rb") as f:
            b = f.read()
        os.remove(name)
        self.kopf(200, "application/octet-stream", len(b), {
            "Content-Disposition": f'attachment; filename="huesli-{heute().isoformat()}.db"', "Cache-Control": "no-store"})
        self.wfile.write(b)


def admin_passwort_setzen(login, pw):
    init_db()
    db().execute("UPDATE personen SET pw=? WHERE login=?", (pw_hash(pw), login))


def main():
    init_db()
    threading.Thread(target=hintergrund, daemon=True).start()
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    srv.daemon_threads = True
    print(f"Hüsli läuft auf 127.0.0.1:{PORT}", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    import sys
    if len(sys.argv) == 3 and sys.argv[1] == "--start-passwort":
        admin_passwort_setzen("alfred", sys.argv[2])
        print("ok")
    else:
        main()
