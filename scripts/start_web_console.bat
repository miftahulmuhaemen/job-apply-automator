@echo off
rem ==============================================================================
rem Job Apply Automator - Web Console & Continuous Scheduler
rem ==============================================================================
rem Starts local Web Console at http://localhost:3100 with active schedule daemon.
rem ==============================================================================

wsl.exe -d Ubuntu -u sahana -- bash -lc "cd /home/sahana/Code_Repository/personal/job-apply-automator && bun run web/src/server.ts"
