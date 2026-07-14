@echo off
setlocal
cd /d "%~dp0"
title Multiply Hub - iPad POS Test
echo.
echo ==============================================
echo   Multiply Hub POS - iPad Test Server
echo ==============================================
echo.
echo Please connect the iPad and this computer to the same Wi-Fi.
echo Find this computer's IPv4 address below, then open on iPad Safari:
echo.
ipconfig | findstr /i "IPv4"
echo.
echo Open: http://YOUR-IP-ADDRESS:8000/pos.html
echo Example: http://192.168.1.25:8000/pos.html
echo.
echo Keep this window open while testing. Press Ctrl+C to stop.
echo.
py -m http.server 8000 --bind 0.0.0.0
pause
