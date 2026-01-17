# GitHub Pages 배포 가이드

## 1. 빌드 실행

### 웹 배포용 빌드 (GitHub Pages)

**Windows CMD 사용 (권장)**
```bash
# CMD를 열고 프로젝트 폴더로 이동
cd D:\Scripts\RefBoard
npm run build:web
```

**PowerShell 사용 (실행 정책 문제 시)**
```powershell
# 관리자 권한으로 실행 정책 변경
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
npm run build:web
```

**직접 실행**
```bash
npx vite build --config vite.config.web.ts
```

### Electron용 빌드 (기존)
```bash
npm run build
```

## 2. 빌드 확인

빌드가 성공하면 `dist-web` 폴더에 다음 파일들이 생성됩니다:
- `index.html`
- `assets/` 폴더 (JS, CSS 파일들)
- 기타 정적 파일들

> 참고: Electron용 빌드는 `dist` 폴더에 생성됩니다.

## 3. GitHub Pages 배포 방법

### 옵션 1: 자동 배포 스크립트 사용 (가장 쉬움) ⭐

**Windows:**
```bash
deploy-to-website.bat
```

**Linux/Mac:**
```bash
chmod +x deploy-to-website.sh
./deploy-to-website.sh
```

이 스크립트는 자동으로:
1. 웹용 빌드를 실행합니다 (`npm run build:web`)
2. `dist-web` 폴더의 내용을 `../refboard-website/refboard/` 폴더로 복사합니다
3. 다음 단계를 안내합니다

**수동으로 완료할 단계:**
```bash
cd ../refboard-website
git add refboard/
git commit -m "Deploy RefBoard app"
git push origin main
```

### 옵션 2: 수동 배포

#### 3-1. refboard-website 리포지토리에 배포하는 경우

1. **웹용 빌드 실행**
   ```bash
   npm run build:web
   ```

2. **refboard-website 리포지토리로 이동**
   ```bash
   cd ../refboard-website
   ```

3. **파일 복사**
   - `dist-web` 폴더의 모든 내용을 `refboard` 폴더에 복사
   - 또는 리포지토리 루트에 직접 복사

4. **GitHub에 푸시**
   ```bash
   git add .
   git commit -m "Deploy RefBoard app"
   git push origin main
   ```

5. **GitHub Pages 설정 확인**
   - 리포지토리 Settings > Pages
   - Source를 `main` 브랜치의 `/ (root)` 또는 `/refboard`로 설정

#### 3-2: GitHub Actions를 사용한 자동 배포 (현재 리포지토리에 배포)

1. `.github/workflows/deploy-web.yml` 파일이 생성되어 있습니다.
2. GitHub 리포지토리 Settings > Pages에서 GitHub Actions를 소스로 선택합니다.
3. `main` 브랜치에 푸시하면 자동으로 배포됩니다.
4. 배포된 URL: `https://[username].github.io/[repository-name]/`

## 4. package.json에 배포 스크립트 추가

`package.json`의 `scripts` 섹션에 다음을 추가:

```json
{
  "scripts": {
    "build": "tsc && vite build",
    "deploy": "npm run build && gh-pages -d dist"
  }
}
```

## 5. vite.config 설정 확인

- **Electron용**: `vite.config.ts` - `base: './'` (상대 경로)
- **웹 배포용**: `vite.config.web.ts` - `base: '/'` (절대 경로)

서브폴더에 배포하는 경우 `vite.config.web.ts`의 `base`를 수정하세요:
- **루트에 배포**: `base: '/'`
- **서브폴더에 배포** (예: `/refboard`): `base: '/refboard/'`

## 6. 배포 후 확인

배포가 완료되면 다음 URL에서 확인할 수 있습니다:
- `https://trackk81.github.io/refboard-website/` (루트에 배포한 경우)
- `https://trackk81.github.io/refboard-website/refboard/` (서브폴더에 배포한 경우)

배포 후 몇 분 정도 기다려야 GitHub Pages가 업데이트됩니다.

## 7. 환경 변수 설정

웹 버전에서는 Electron API를 사용할 수 없으므로, 환경 변수나 설정 파일을 통해 Firebase 및 Google Drive 설정을 관리해야 합니다.

`.env.production` 파일을 생성하여 프로덕션 환경 변수를 설정할 수 있습니다:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
# ... 기타 Firebase 설정
```

## 문제 해결

### 빌드 에러 발생 시
1. TypeScript 에러 확인: `npm run build` 출력 확인
2. 의존성 설치 확인: `npm install`
3. 캐시 클리어: `rm -rf node_modules dist && npm install`

### 배포 후 페이지가 로드되지 않는 경우
1. `vite.config.ts`의 `base` 경로 확인
2. 브라우저 콘솔에서 에러 확인
3. GitHub Pages 설정에서 올바른 브랜치/폴더 선택 확인

