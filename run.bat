
@echo off
chcp 936 > nul
set "EXEC_DENO=deno"
cd /d "%~dp0"

where deno /q
if %ERRORLEVEL% == 0 ( goto start )

set "EXEC_DENO=%cd%\__deno__\deno.exe"
set "DENO_DIR=%cd%\__deno__\"
if exist ".\__deno__\deno.exe" ( goto start )

if not exist ".\__deno__" ( mkdir ".\__deno__" )
set "TARGET=x86_64-pc-windows-msvc"
where curl /q
if not %ERRORLEVEL% == 0 ( goto manual )
where tar /q
if not %ERRORLEVEL% == 0 ( goto manual )
goto download

:manual
set "DOWNLOAD_DENO=https://github.com/denoland/deno/releases/v2.1.4/download/deno-%TARGET%.zip"
set "DOWNLOAD_DENO_UNPKG=https://unpkg.com/@deno/win32-x64@2.1.4/deno.exe"
:alternate
echo 找不到 Deno ，请前往
echo %DOWNLOAD_DENO%
echo 或
echo %DOWNLOAD_DENO_UNPKG%
echo 手动下载 Deno (并解压)到 .\__deno__\deno.exe
pause
exit

:download
set "DOWNLOAD_DENO=https://github.com/denoland/deno/releases/latest/download/deno-%TARGET%.zip"
set "DOWNLOAD_DENO_UNPKG=https://unpkg.com/@deno/win32-x64@latest/deno.exe"
echo 找不到 Deno ，开始下载
curl -fLo "./__deno__/deno.zip" "%DOWNLOAD_DENO%"
if %ERRORLEVEL% == 0 (
  tar xf "./__deno__/deno.zip" -C "./__deno__/"
  del ".\__deno__\deno.zip"
) else (
  curl -fLo "./__deno__/deno.exe" "%DOWNLOAD_DENO_UNPKG%"
)
if not exist ".\__deno__\deno.exe" ( goto alternate )

:start
if not exist ".\__download__" (
  mkdir ".\__download__"
)
if not exist ".\__cache__" (
  mkdir ".\__cache__"
  fsutil.exe file setCaseSensitiveInfo ".\__cache__" enable
)

start "Metadata Fetcher" "%EXEC_DENO%" run --quiet --no-prompt --no-remote -S -E -N -R -W=./__cache__ --allow-run --unstable-ffi --allow-ffi ./lib/main.js start