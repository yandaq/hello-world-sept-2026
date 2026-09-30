#!/bin/sh
printf '\033]0;%s\007' integration-verifier
tail -n +1 -F /Volumes/ExternalSSD/Dropbox/Dev/hello-world/.pi/sub-agents/runs/2026-09-30T19-49-43-293Z/logs/2026-09-30T20-08-53-575Z-1-integration-verifier.log &
tail_pid=$!
until grep -qE '^(✔ done|✖ failed|■ aborted)' /Volumes/ExternalSSD/Dropbox/Dev/hello-world/.pi/sub-agents/runs/2026-09-30T19-49-43-293Z/logs/2026-09-30T20-08-53-575Z-1-integration-verifier.log 2>/dev/null; do sleep 1; done
sleep 1; printf '\nClosing in 30s…\n'
sleep 30
kill "$tail_pid" 2>/dev/null
