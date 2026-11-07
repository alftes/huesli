#!/bin/sh
# Hüsli starten (falls nicht schon läuft). Wird per crontab @reboot aufgerufen, bis der systemd-Dienst eingerichtet ist.
if ss -ltn | grep -q '127.0.0.1:8082 '; then exit 0; fi
cd /mnt/data/familie/app && nohup python3 server.py >> /mnt/data/familie/daten/server.log 2>&1 &
