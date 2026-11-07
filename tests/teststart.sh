#!/bin/sh
# Startet einen Test-Server (eigene Daten in /tmp/htest) auf Port 8092
mkdir -p /tmp/htest/d /tmp/htest/b
cd /tmp
HUESLI_DATEN=/tmp/htest/d HUESLI_BACKUP=/tmp/htest/b HUESLI_PORT=8092 HUESLI_TEST_HTTP=1 nohup python3 /mnt/data/familie/app/server.py > /tmp/htest/log 2>&1 &
echo $! > /tmp/htest/pid
