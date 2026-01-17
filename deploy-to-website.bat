@echo off
REM RefBoard를 refboard-website 리포지토리에 배포하는 Windows 배치 스크립트

echo 🔨 Building RefBoard for web...
call npm run build:web

if not exist "dist-web" (
    echo ❌ Build failed! dist-web folder not found.
    exit /b 1
)

echo ✅ Build completed!

REM refboard-website 리포지토리 경로 설정
set WEBSITE_REPO=..\refboard-website

if not exist "%WEBSITE_REPO%" (
    echo ❌ refboard-website repository not found at %WEBSITE_REPO%
    echo Please clone the repository or update the WEBSITE_REPO path in this script.
    exit /b 1
)

echo 📦 Copying files to %WEBSITE_REPO%...

REM dist-web의 모든 내용을 refboard 폴더로 복사
if not exist "%WEBSITE_REPO%\refboard" mkdir "%WEBSITE_REPO%\refboard"
xcopy /E /I /Y dist-web\* "%WEBSITE_REPO%\refboard\"

echo ✅ Files copied successfully!
echo.
echo Next steps:
echo 1. cd %WEBSITE_REPO%
echo 2. git add refboard/
echo 3. git commit -m "Deploy RefBoard app"
echo 4. git push origin main

