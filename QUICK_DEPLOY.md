# 빠른 배포 가이드 (refboard 폴더에 배포)

## ✅ 설정 완료
`vite.config.web.ts`의 `base`가 `/refboard/`로 설정되었습니다.

---

## 📋 배포 단계

### 1단계: 다시 빌드 (CMD 사용)

PowerShell 실행 정책 문제를 피하기 위해 **CMD**를 사용하세요:

1. **CMD 열기** (Windows 키 + R → `cmd` 입력)

2. **프로젝트 폴더로 이동**
   ```bash
   cd D:\Scripts\RefBoard
   ```

3. **웹용 빌드 실행**
   ```bash
   npm run build:web
   ```

   또는 직접 실행:
   ```bash
   npx vite build --config vite.config.web.ts
   ```

4. **빌드 완료 확인**
   - `dist-web` 폴더가 생성되었는지 확인
   - `dist-web/index.html` 파일이 있는지 확인

---

### 2단계: refboard-website 리포지토리 준비

#### 옵션 A: 리포지토리가 이미 있는 경우

리포지토리 경로를 확인하세요. 예:
- `D:\Projects\refboard-website`
- `C:\Users\YourName\Documents\refboard-website`

#### 옵션 B: 리포지토리를 클론해야 하는 경우

CMD에서:
```bash
cd D:\Scripts
git clone https://github.com/trackk81/refboard-website.git
```

---

### 3단계: 파일 복사

#### 방법 1: Windows 탐색기 사용 (가장 쉬움) ⭐

1. **dist-web 폴더 열기**
   - `D:\Scripts\RefBoard\dist-web` 폴더를 탐색기에서 엽니다

2. **모든 파일 선택 및 복사**
   - `Ctrl + A` (모두 선택)
   - `Ctrl + C` (복사)

3. **refboard-website 리포지토리로 이동**
   - 탐색기에서 refboard-website 리포지토리 폴더를 엽니다

4. **refboard 폴더 생성**
   - 리포지토리 루트에 `refboard` 폴더를 만듭니다 (없는 경우)

5. **붙여넣기**
   - `refboard` 폴더 안에 `Ctrl + V`로 붙여넣기
   - 기존 파일이 있으면 덮어쓰기 확인

#### 방법 2: CMD 사용

```bash
# refboard-website 리포지토리 경로를 확인하고 아래 명령 실행
# 예: D:\Projects\refboard-website

# refboard 폴더 생성 (없는 경우)
mkdir D:\Projects\refboard-website\refboard

# 파일 복사
xcopy /E /I /Y D:\Scripts\RefBoard\dist-web\* D:\Projects\refboard-website\refboard\
```

---

### 4단계: GitHub에 푸시

1. **refboard-website 리포지토리로 이동**
   ```bash
   cd D:\Projects\refboard-website
   ```
   (실제 경로로 변경)

2. **변경사항 확인**
   ```bash
   git status
   ```

3. **파일 추가**
   ```bash
   git add refboard/
   ```

4. **커밋**
   ```bash
   git commit -m "Deploy RefBoard app to /refboard folder"
   ```

5. **푸시**
   ```bash
   git push origin main
   ```
   (또는 `master` 브랜치를 사용하는 경우 `git push origin master`)

---

### 5단계: GitHub Pages 설정 확인

1. **GitHub 리포지토리 접속**
   - 브라우저에서 `https://github.com/trackk81/refboard-website` 접속

2. **Settings > Pages**
   - 리포지토리 상단의 "Settings" 탭 클릭
   - 왼쪽 사이드바에서 "Pages" 클릭

3. **Source 설정**
   - Source: `Deploy from a branch`
   - Branch: `main` (또는 `master`)
   - Folder: `/ (root)` 선택

4. **Save 클릭**

---

### 6단계: 배포 확인

배포가 완료되면 (보통 몇 분 소요) 다음 URL에서 확인:

**🎉 https://trackk81.github.io/refboard-website/refboard/**

---

## ✅ 체크리스트

- [ ] CMD에서 `npm run build:web` 실행 완료
- [ ] `dist-web` 폴더 확인
- [ ] refboard-website 리포지토리 준비 (클론 또는 위치 확인)
- [ ] `dist-web`의 모든 내용을 `refboard-website/refboard/` 폴더로 복사
- [ ] Git 커밋 및 푸시 완료
- [ ] GitHub Pages 설정 확인
- [ ] 배포된 사이트 확인

---

## 🔍 문제 해결

### 빌드가 안 되는 경우
- CMD를 사용하세요 (PowerShell 대신)
- 또는 `npx vite build --config vite.config.web.ts` 직접 실행

### 파일 복사가 안 되는 경우
- Windows 탐색기를 사용하는 것이 가장 쉽습니다
- `refboard` 폴더가 제대로 생성되었는지 확인

### 페이지가 로드되지 않는 경우
- 브라우저 콘솔(F12)에서 에러 확인
- URL이 `/refboard/`로 끝나는지 확인
- GitHub Pages 설정에서 올바른 브랜치 선택 확인





