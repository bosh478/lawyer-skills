@echo off
cd /d C:\Users\汤康康\.claude\skills
git status --porcelain > %TEMP%\skill_git_status.txt
findstr /r "." %TEMP%\skill_git_status.txt >nul 2>&1
if %errorlevel% equ 0 (
    set "msg=skill目录有更新，请回复「备份skill」进行备份"
) else (
    set "msg=skill目录无更新，无需备份"
)
powershell -Command "Invoke-WebRequest -Uri 'https://sctapi.ftqq.com/SCT342940TQJkUVgWxOTgcC3wpK8YllAZP.send?text=skill备份检查&desp=%msg%' -Method POST -UseBasicParsing"
del %TEMP%\skill_git_status.txt
