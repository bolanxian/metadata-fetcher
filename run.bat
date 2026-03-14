
@echo off
chcp 65001 > nul
set "EXEC_DENO=deno"
cd /d "%~dp0"

where /q deno
if %ERRORLEVEL% == 0 ( goto start )

set "EXEC_DENO=%cd%\__deno__\deno.exe"
set "DENO_DIR=%cd%\__deno__\"
if exist ".\__deno__\deno.exe" ( goto start )

if not exist ".\__deno__" ( mkdir ".\__deno__" )
set "DOWNLOAD_DENO=https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip"
set "DOWNLOAD_DENO_UNPKG=https://unpkg.com/@deno/win32-x64@latest/deno.exe"
where /q curl
if not %ERRORLEVEL% == 0 ( goto manual )
where /q tar
if not %ERRORLEVEL% == 0 ( goto manual )

echo 找不到 Deno ，开始下载
curl -fLo "./__deno__/deno.zip" "%DOWNLOAD_DENO%"
if %ERRORLEVEL% == 0 (
  tar xf "./__deno__/deno.zip" -C "./__deno__/"
  del ".\__deno__\deno.zip"
) else (
  curl -fLo "./__deno__/deno.exe" "%DOWNLOAD_DENO_UNPKG%"
)
if exist ".\__deno__\deno.exe" ( goto start )

:manual
echo 找不到 Deno ，请前往
echo %DOWNLOAD_DENO%
echo 或
echo %DOWNLOAD_DENO_UNPKG%
echo 手动下载 Deno (并解压)到 .\__deno__\deno.exe
pause
exit

:start
if exist ".\__cache__" ( goto exist-cache )

if not exist ".\__download__" (
  mkdir ".\__download__"
)
where /q vcruntime140.dll
if not %ERRORLEVEL% == 0 (
  echo 找不到 vcruntime140.dll
  echo 请安装 "Microsoft Visual C++ Redistributable 2015–2022"
  echo https://aka.ms/vs/17/release/vc_redist.x64.exe
  pause
)

mkdir ".\__cache__"
fsutil.exe file setCaseSensitiveInfo ".\__cache__" enable
if not %ERRORLEVEL% == 0 ( 
  echo 启用目录的区分大小写属性失败，请尝试执行
  echo PowerShell -Command "& {Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux}"
  pause
)

:exist-cache
start "" "%EXEC_DENO%" run --quiet --no-prompt --no-remote -P=start ./lib/main.ts start
