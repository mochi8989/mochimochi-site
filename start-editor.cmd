@echo off
cd /d "%~dp0"
echo Open this URL in your browser:
echo http://127.0.0.1:4173/mochimochi-site/editor/
echo Keep this window open while editing. Press Ctrl+C to stop.
node tools\serve.mjs 4173
pause
