
chcp 65001
set "TARGET=x86_64-pc-windows-msvc"
set "EXEC_DENO=deno"
cd /d "%~dp0"

where deno /q
if not %ERRORLEVEL% == 0 (
  set "EXEC_DENO=%cd%\deno\deno.exe"
  set "DENO_DIR=%cd%\deno\"
  if not exist ".\deno\deno.exe" (
    if not exist ".\deno" ( mkdir ".\deno" )
    curl -Lo "./deno/deno.zip" "https://github.com/denoland/deno/releases/latest/download/deno-%TARGET%.zip"
    tar xf "./deno/deno.zip" -C "./deno/"
    del ".\deno\deno.zip"
  )
)

if not exist ".\__download__" (
  mkdir ".\__download__"
)
if not exist ".\__cache__" (
  mkdir ".\__cache__"
  fsutil.exe file setCaseSensitiveInfo ".\__cache__" enable
)
if not exist ".\__cache__\_browser.json" (
  "dist\reg-utils" browser > ".\__cache__\_browser.json"
)

start "Metadata Fetcher" "%EXEC_DENO%" run --quiet --no-prompt --no-remote -S -E -N -R -W=./__cache__ --allow-run --unstable-ffi --allow-ffi ./lib/main.js start