#!/bin/sh
[ -f /tmp/htest/pid ] && kill "$(cat /tmp/htest/pid)" 2>/dev/null; rm -f /tmp/htest/pid; true
