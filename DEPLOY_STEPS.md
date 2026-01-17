# RefBoard 배포 단계별 가이드

## ✅ 1단계: 빌드 완료
빌드가 성공적으로 완료되었습니다! `dist-web` 폴더에 다음 파일들이 생성되었습니다:
- `index.html`
- `assets/` 폴더 (JS, CSS 파일들)
- `carbon-ad.html`
- `404.html`

---

## 📋 2단계: refboard-website 리포지토리 준비

### 옵션 A: 리포지토리가 이미 로컬에 있는 경우

1. **리포지토리 위치 확인**
   - refboard-website 리포지토리가 어디에 있는지 확인하세요
   - 예: `D:\Projects\refboard-website` 또는 `C:\Users\YourName\Documents\refboard-website`

2. **리포지토리로 이동**
   ```bash
   cd [리포지토리 경로]
   # 예: cd D:\Projects\refboard-website
   ```

### 옵션 B: 리포지토리를 클론해야 하는 경우

1. **GitHub에서 리포지토리 클론**
   ```bash
   cd D:\Scripts
   git clone https://github.com/trackk81/refboard-website.git
   ```

2. **리포지토리로 이동**
   ```bash
   cd refboard-website
   ```

---

## 📦 3단계: 빌드 파일 복사

### 방법 1: Windows 탐색기 사용 (가장 쉬움)

1. **dist-web 폴더 열기**
   - `D:\Scripts\RefBoard\dist-web` 폴더를 탐색기에서 엽니다

2. **모든 파일 선택**
   - `Ctrl + A`로 모든 파일과 폴더 선택

3. **복사**
   - `Ctrl + C`로 복사

4. **refboard-website 리포지토리로 이동**
   - 탐색기에서 refboard-website 리포지토리 폴더를 엽니다

5. **refboard 폴더 생성 (없는 경우)**
   - 리포지토리 루트에 `refboard` 폴더를 만듭니다 (없는 경우)

6. **붙여넣기**
   - `refboard` 폴더 안에 `Ctrl + V`로 붙여넣기
   - 또는 리포지토리 루트에 직접 붙여넣기 (루트에 배포하는 경우)

### 방법 2: 명령줄 사용 (CMD)

**refboard 폴더에 배포하는 경우:**
```bash
# RefBoard 프로젝트 폴더에서
xcopy /E /I /Y dist-web\* [refboard-website 경로]\refboard\
# 예: xcopy /E /I /Y dist-web\* D:\Projects\refboard-website\refboard\
```

**루트에 배포하는 경우:**
```bash
# RefBoard 프로젝트 폴더에서
xcopy /E /I /Y dist-web\* [refboard-website 경로]\
# 예: xcopy /E /I /Y dist-web\* D:\Projects\refboard-website\
```

### 방법 3: PowerShell 사용

**refboard 폴더에 배포하는 경우:**
```powershell
# RefBoard 프로젝트 폴더에서
Copy-Item -Path "dist-web\*" -Destination "[refboard-website 경로]\refboard\" -Recurse -Force
# 예: Copy-Item -Path "dist-web\*" -Destination "D:\Projects\refboard-website\refboard\" -Recurse -Force
```

**루트에 배포하는 경우:**
```powershell
Copy-Item -Path "dist-web\*" -Destination "[refboard-website 경로]\" -Recurse -Force
```

---

## 🔧 4단계: vite.config.web.ts 설정 확인 (중요!)

배포 위치에 따라 `vite.config.web.ts`의 `base` 설정을 확인해야 합니다.

### refboard 폴더에 배포하는 경우:
`vite.config.web.ts` 파일을 열고:
```typescript
base: '/refboard/',  // 서브폴더에 배포
```

### 루트에 배포하는 경우:
```typescript
base: '/',  // 루트에 배포
```

**설정을 변경했다면 다시 빌드해야 합니다:**
```bash
npm run build:web
```

---

## 🚀 5단계: GitHub에 푸시

1. **refboard-website 리포지토리로 이동**
   ```bash
   cd [refboard-website 경로]
   ```

2. **변경사항 확인**
   ```bash
   git status
   ```

3. **파일 추가**
   ```bash
   # refboard 폴더에 배포한 경우
   git add refboard/
   
   # 또는 루트에 배포한 경우
   git add .
   ```

4. **커밋**
   ```bash
   git commit -m "Deploy RefBoard app"
   ```

5. **푸시**
   ```bash
   git push origin main
   ```
   (또는 `master` 브랜치를 사용하는 경우 `git push origin master`)

---

## ✅ 6단계: GitHub Pages 설정 확인

1. **GitHub 리포지토리로 이동**
   - 브라우저에서 `https://github.com/trackk81/refboard-website` 접속

2. **Settings 메뉴 클릭**
   - 리포지토리 상단의 "Settings" 탭 클릭

3. **Pages 메뉴 클릭**
   - 왼쪽 사이드바에서 "Pages" 클릭

4. **Source 설정**
   - Source를 `Deploy from a branch` 선택
   - Branch를 `main` (또는 `master`) 선택
   - Folder를 `/ (root)` 또는 `/refboard` 선택 (배포 위치에 따라)

5. **Save 클릭**

---

## 🌐 7단계: 배포 확인

배포가 완료되면 (보통 몇 분 소요) 다음 URL에서 확인할 수 있습니다:

- **refboard 폴더에 배포한 경우:**
  - `https://trackk81.github.io/refboard-website/refboard/`

- **루트에 배포한 경우:**
  - `https://trackk81.github.io/refboard-website/`

---

## 🔍 문제 해결

### 페이지가 로드되지 않는 경우

1. **브라우저 콘솔 확인**
   - F12를 눌러 개발자 도구 열기
   - Console 탭에서 에러 확인
   - Network 탭에서 404 에러 확인

2. **base 경로 확인**
   - `vite.config.web.ts`의 `base` 설정이 배포 위치와 일치하는지 확인
   - 일치하지 않으면 수정 후 다시 빌드 및 배포

3. **GitHub Pages 설정 확인**
   - Settings > Pages에서 올바른 브랜치와 폴더가 선택되었는지 확인

4. **캐시 문제**
   - 브라우저 캐시를 지우고 다시 시도
   - 또는 시크릿 모드에서 확인

### 파일이 보이지 않는 경우

1. **파일 복사 확인**
   - refboard-website 리포지토리에 파일이 제대로 복사되었는지 확인
   - `git status`로 변경사항 확인

2. **Git 푸시 확인**
   - `git log`로 커밋이 제대로 되었는지 확인
   - GitHub 웹사이트에서 파일이 올라갔는지 확인

---

## 📝 요약 체크리스트

- [ ] 빌드 완료 (`dist-web` 폴더 확인)
- [ ] refboard-website 리포지토리 준비 (클론 또는 위치 확인)
- [ ] `vite.config.web.ts`의 `base` 설정 확인 및 필요시 수정
- [ ] 필요시 다시 빌드 (`npm run build:web`)
- [ ] `dist-web` 폴더의 내용을 refboard-website 리포지토리로 복사
- [ ] Git 커밋 및 푸시
- [ ] GitHub Pages 설정 확인
- [ ] 배포된 사이트 확인





