
set "TARGET=x86_64-pc-windows-msvc"
set "EXEC_DENO=deno"
cd /d "%~dp0"

where deno /q
if not %ERRORLEVEL% == 0 (
  set "EXEC_DENO=.\deno\deno.exe"
  set "DENO_DIR=%~dp0deno\"
  if not exist ".\deno\deno.exe" (
    if not exist ".\deno" ( mkdir ".\deno" )
    curl -Lo "./deno/deno.zip" "https://github.com/denoland/deno/releases/latest/download/deno-%TARGET%.zip"
    tar xf "./deno/deno.zip" -C "./deno/"
    del ".\deno\deno.zip"
  )
)

if not exist ".\__cache__" (
  mkdir ".\__cache__"
  fsutil.exe file setCaseSensitiveInfo ".\__cache__" enable
)

start %EXEC_DENO% run --quiet --allow-net --allow-read=. --allow-write=./__cache__ --allow-run=explorer --unstable-ffi --allow-ffi ./lib/main.js start