#!/bin/sh
printf '\033]0;%s\007' project-scaffolder
tail -n +1 -F /Volumes/ExternalSSD/Dropbox/Dev/hello-world/.pi/sub-agents/runs/2026-09-30T19-49-43-293Z/logs/2026-09-30T19-50-49-767Z-1-project-scaffolder.log &
tail_pid=$!
until grep -qE '^(✔ done|✖ failed|■ aborted)' /Volumes/ExternalSSD/Dropbox/Dev/hello-world/.pi/sub-agents/runs/2026-09-30T19-49-43-293Z/logs/2026-09-30T19-50-49-767Z-1-project-scaffolder.log 2>/dev/null; do sleep 1; done
sleep 1; printf '\nClosing in 30s…\n'
sleep 30
kill "$tail_pid" 2>/dev/null
