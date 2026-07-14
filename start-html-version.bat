@echo off
cd /d "%~dp0"
start "" "http://localhost:8080/production.html"
py -m http.server 8080
