@echo off
rem railway-iac.cmd — run `railway config plan|apply|...` on Windows.
rem Git Bash exports a POSIX `env._` that poisons the railway/iac SDK's
rem CLI-version probe ("requires CLI 5.42.1+" even on 5.71). Clearing `_`
rem and putting the real exe first in PATH fixes the detection.
set "_="
set "PATH=%APPDATA%\npm\node_modules\@railway\cli\bin;%PATH%"
railway %*
