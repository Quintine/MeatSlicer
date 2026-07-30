@echo off
rem MeatSlicer dev launcher - enables the hidden debug console (?dev=1).
cd /d %~dp0
start "MeatSlicer server" /min python tools\serve_game.py --port 8123
timeout /t 1 /nobreak >nul
start "" "http://localhost:8123/?dev=1"
echo MeatSlicer running at http://localhost:8123/?dev=1  [debug console: ` key]
echo Close the minimized "MeatSlicer server" window to stop it.
