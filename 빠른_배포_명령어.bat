@echo off
echo ========================================
echo RefBoard 설치 파일 홈페이지 배포
echo ========================================
echo.

REM refboard-website 리포지토리 경로 확인
set WEBSITE_REPO=D:\Scripts\refboard-website

echo [1/5] refboard-website 리포지토리 확인...
if not exist "%WEBSITE_REPO%" (
    echo 오류: refboard-website 리포지토리를 찾을 수 없습니다.
    echo 경로를 확인하세요: %WEBSITE_REPO%
    echo.
    echo 현재 경로를 입력하세요:
    set /p WEBSITE_REPO="경로: "
)

echo [2/5] downloads 폴더 생성...
if not exist "%WEBSITE_REPO%\downloads" (
    mkdir "%WEBSITE_REPO%\downloads"
    echo downloads 폴더 생성 완료
) else (
    echo downloads 폴더 이미 존재함
)

echo [3/5] 설치 파일 복사...
REM 버전 0.0.2 파일 확인 및 복사
if exist "release\RefBoard Setup 0.0.2.exe" (
    copy "release\RefBoard Setup 0.0.2.exe" "%WEBSITE_REPO%\downloads\RefBoard-Setup-0.0.2.exe"
    if %errorlevel% equ 0 (
        echo 설치 파일 복사 완료 (v0.0.2)
    ) else (
        echo 오류: 파일 복사 실패
        pause
        exit /b 1
    )
) else (
    echo 오류: release\RefBoard Setup 0.0.2.exe 파일을 찾을 수 없습니다.
    echo 먼저 npm run electron:build를 실행하여 빌드하세요.
    pause
    exit /b 1
)

echo [4/5] index.html 업데이트 확인...
echo.
echo 다음 단계를 수동으로 진행하세요:
echo.
echo 1. %WEBSITE_REPO%\index.html 파일 열기
echo 2. 다음 줄을 찾기:
echo    ^<a href="downloads/RefBoard-Setup-0.0.1.exe"
echo.
echo 3. 다음으로 변경:
echo    ^<a href="downloads/RefBoard-Setup-0.0.2.exe"
echo.
echo 4. 버전 표시도 업데이트:
echo    ^<div class="hero-badge"^>Ver 0.0.2 Now Available^</div^>
echo.
echo [5/5] Git 커밋 및 푸시...
echo.
echo 다음 명령어를 실행하세요:
echo   cd %WEBSITE_REPO%
echo   git add downloads/
echo   git add index.html
echo   git commit -m "Add RefBoard installer v0.0.2"
echo   git push origin main
echo.
echo ========================================
echo 배포 준비 완료!
echo ========================================
pause


