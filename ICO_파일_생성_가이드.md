# ICO 파일 생성 가이드

## 문제
NSIS 설치 프로그램은 PNG 파일을 직접 사용할 수 없고 ICO 파일이 필요합니다.

## 해결 방법

### 방법 1: 온라인 변환 도구 사용 (가장 간단)

1. **ICO Convert** 사용:
   - 웹사이트: https://icoconvert.com/
   - 또는: https://convertio.co/kr/png-ico/
   - 또는: https://www.icoconverter.com/

2. **변환 단계:**
   - `icon/RB_icon.png` 파일 업로드
   - ICO 형식 선택
   - 다운로드
   - `icon/RB_icon.ico`로 저장

3. **package.json 수정:**
   ```json
   "nsis": {
     "oneClick": false,
     "perMachine": false,
     "allowToChangeInstallationDirectory": true,
     "shortcutName": "RefBoard",
     "installerIcon": "icon/RB_icon.ico",
     "uninstallerIcon": "icon/RB_icon.ico",
     "include": "build/installer.nsh"
   }
   ```

### 방법 2: ImageMagick 사용 (명령줄)

1. **ImageMagick 설치:**
   - 다운로드: https://imagemagick.org/script/download.php
   - Windows 설치 프로그램 실행

2. **변환 명령어:**
   ```bash
   magick convert icon/RB_icon.png -define icon:auto-resize=256,128,64,48,32,16 icon/RB_icon.ico
   ```

### 방법 3: GIMP 사용 (무료 이미지 편집기)

1. **GIMP 설치:**
   - 다운로드: https://www.gimp.org/downloads/

2. **변환 단계:**
   - GIMP에서 `icon/RB_icon.png` 열기
   - 파일 → 내보내기
   - 파일명을 `RB_icon.ico`로 변경
   - 내보내기 클릭
   - ICO 옵션에서 여러 크기 포함 선택

## 현재 상태

✅ **완료된 작업:**
- `package.json`에 `description`과 `author` 추가
- NSIS의 `installerIcon`과 `uninstallerIcon` 임시 제거 (ICO 파일 생성 후 다시 추가)

## 다음 단계

1. **ICO 파일 생성:**
   - 위 방법 중 하나를 사용하여 `icon/RB_icon.ico` 생성

2. **package.json 수정:**
   - `installerIcon`과 `uninstallerIcon`을 다시 추가:
   ```json
   "installerIcon": "icon/RB_icon.ico",
   "uninstallerIcon": "icon/RB_icon.ico",
   ```

3. **빌드 실행:**
   ```bash
   npm run electron:build
   ```

## 참고

- ICO 파일은 여러 크기의 아이콘을 포함할 수 있습니다 (16x16, 32x32, 48x48, 256x256 등)
- NSIS는 최소 32x32 크기가 필요합니다
- 권장 크기: 256x256 또는 여러 크기 포함


