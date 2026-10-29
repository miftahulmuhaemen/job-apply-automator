@echo off
rem ==============================================================================
rem Job Apply Automator - Daily Catch-Up Run Launcher
rem ==============================================================================
rem Automatically triggers once a day upon Windows startup (morning or night).
rem Uses WSL2 native execution with once-a-day SQLite catch-up guard.
rem
rem Installation:
rem 1. Press Win + R
rem 2. Type: shell:startup and press Enter
rem 3. Create a shortcut pointing to this file:
rem    \\wsl.localhost\Ubuntu\home\sahana\Code_Repository\personal\job-apply-automator\scripts\run_automator.bat
rem ==============================================================================

wsl.exe -d Ubuntu -u sahana -- bash -lc "cd /home/sahana/Code_Repository/personal/job-apply-automator && ./cli/target/release/job-apply-cli schedule --once"
