#!/usr/bin/python3
"""Baut die drei Hüsli-Kurzbefehle als (unsignierte) .shortcut-Dateien für Alfred.
Aufruf: kurzbefehle_bauen.py <login> <zielordner> <basis-url>
Signieren muss ein Mac: shortcuts sign -m anyone -i X.shortcut -o Y.shortcut"""
import os, plistlib, secrets, sqlite3, sys, uuid
login, ziel, basis = sys.argv[1], sys.argv[2], sys.argv[3].rstrip("/")
DB = "/mnt/data/familie/daten/huesli.db"
c = sqlite3.connect(DB)
pid = c.execute("SELECT id FROM personen WHERE login=? AND aktiv=1 AND pw IS NOT NULL", (login,)).fetchone()[0]
r = c.execute("SELECT token FROM kurzbefehle WHERE person_id=?", (pid,)).fetchone()
if r:
    token = r[0]
else:
    import datetime
    token = secrets.token_urlsafe(32)
    c.execute("INSERT INTO kurzbefehle(token, person_id, erstellt) VALUES(?,?,?)",
              (token, pid, datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")))
    c.commit()
url = f"{basis}/familie/k/{token}"

def u(): return str(uuid.uuid4()).upper()
def text(s): return {"Value": {"string": s, "attachmentsByRange": {}}, "WFSerializationType": "WFTextTokenString"}
def var_text(anhang): return {"Value": {"string": "￼", "attachmentsByRange": {"{0, 1}": anhang}}, "WFSerializationType": "WFTextTokenString"}
def ausgabe(uid, name): return {"OutputUUID": uid, "OutputName": name, "Type": "ActionOutput"}
EINGABE = {"Type": "ExtensionInput"}
def feld(key, wert): return {"WFItemType": 0, "WFKey": text(key), "WFValue": wert}
def abrufen(uid, adresse, felder):
    return {"WFWorkflowActionIdentifier": "is.workflow.actions.downloadurl", "WFWorkflowActionParameters": {
        "UUID": uid, "WFURL": adresse, "WFHTTPMethod": "POST", "WFHTTPBodyType": "Form", "ShowHeaders": False,
        "WFFormValues": {"Value": {"WFDictionaryFieldValueItems": felder}, "WFSerializationType": "WFDictionaryFieldValue"}}}
def zeigen(uid_url): return {"WFWorkflowActionIdentifier": "is.workflow.actions.showresult",
                             "WFWorkflowActionParameters": {"Text": var_text(ausgabe(uid_url, "Contents of URL"))}}
def kopf(aktionen, farbe, glyphe, teilen=False):
    d = {"WFWorkflowClientVersion": "2302.0.4", "WFWorkflowMinimumClientVersion": 900, "WFWorkflowMinimumClientVersionString": "900",
         "WFWorkflowIcon": {"WFWorkflowIconStartColor": farbe, "WFWorkflowIconGlyphNumber": glyphe},
         "WFWorkflowImportQuestions": [], "WFWorkflowTypes": ["ActionExtension"] if teilen else [],
         "WFWorkflowInputContentItemClasses": ["WFStringContentItem", "WFRichTextContentItem", "WFURLContentItem",
                                               "WFSafariWebPageContentItem", "WFArticleContentItem"] if teilen else [],
         "WFWorkflowActions": aktionen}
    if teilen:
        d["WFWorkflowHasShortcutInputVariables"] = True
    return d

def siri(frage, endung):
    a, b = u(), u()
    return kopf([
        {"WFWorkflowActionIdentifier": "is.workflow.actions.ask", "WFWorkflowActionParameters": {"UUID": a, "WFInputType": "Text", "WFAskActionPrompt": frage}},
        abrufen(b, f"{url}/{endung}", [feld("text", var_text(ausgabe(a, "Provided Input")))]),
        zeigen(b)], 4282601983, 59511)

def teilen():
    l, w, b = u(), u(), u()
    return kopf([
        {"WFWorkflowActionIdentifier": "is.workflow.actions.list", "WFWorkflowActionParameters": {"UUID": l, "WFItems": ["Notiz", "Aufgabe", "Einkauf"]}},
        {"WFWorkflowActionIdentifier": "is.workflow.actions.choosefromlist", "WFWorkflowActionParameters": {"UUID": w,
            "WFChooseFromListActionPrompt": "Als was in Hüsli speichern?",
            "WFInput": {"Value": ausgabe(l, "List"), "WFSerializationType": "WFTextTokenAttachment"}}},
        abrufen(b, url, [feld("text", var_text(EINGABE)), feld("ziel", var_text(ausgabe(w, "Chosen Item")))]),
        zeigen(b)], 4282601983, 59511, teilen=True)

os.makedirs(ziel, exist_ok=True)
for datei, inhalt in (("familieneinkauf.shortcut", siri("Was brauchst du?", "einkauf")),
                      ("familienaufgabe.shortcut", siri("Was ist zu tun?", "aufgabe")),
                      ("an-huesli.shortcut", teilen())):
    with open(os.path.join(ziel, datei), "wb") as f:
        plistlib.dump(inhalt, f, fmt=plistlib.FMT_XML)
print("ok", url[:len(basis) + 13] + "…")
