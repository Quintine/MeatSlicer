@echo off
rem MeatSlicer launcher - serves only game files on the local machine.
cd /d %~dp0
start "MeatSlicer server" /min python tools\serve_game.py --port 8123
timeout /t 1 /nobreak >nul
start "" http://localhost:8123
echo MeatSlicer running at http://localhost:8123
echo Close the minimized "MeatSlicer server" window to stop it.
