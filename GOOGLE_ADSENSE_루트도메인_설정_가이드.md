# Google AdSense 루트 도메인 설정 가이드

## 🔍 문제 상황

현재 상황:
- ✅ 작동하는 URL: `https://trackk81.github.io/refboard-website/`
- ❌ 루트 도메인: `https://trackk81.github.io` → 404 에러

**원인**: GitHub Pages에서 루트 도메인(`username.github.io`)을 사용하려면 리포지토리 이름이 정확히 `username.github.io`여야 합니다.

---

## 🎯 해결 방법 (3가지 옵션)

### 옵션 1: 루트 도메인 리포지토리 생성 (권장) ⭐

Google AdSense가 최상위 도메인을 요구하므로, 루트 도메인 리포지토리를 생성하는 것이 가장 좋습니다.

#### 1단계: 새 리포지토리 생성

1. **GitHub에서 새 리포지토리 생성**
   - https://github.com/new 접속
   - Repository name: **`trackk81.github.io`** (정확히 이 이름!)
   - Public 선택
   - "Add a README file" 체크 해제
   - Create repository 클릭

#### 2단계: 웹사이트 파일 복사

```bash
# 현재 프로젝트에서 웹 빌드
cd D:\Scripts\RefBoard
npm run build:web

# 새 리포지토리 클론 (원하는 위치에)
cd D:\Projects  # 또는 원하는 위치
git clone https://github.com/trackk81/trackk81.github.io.git
cd trackk81.github.io

# dist-web의 모든 내용을 루트에 복사
xcopy /E /I /Y D:\Scripts\RefBoard\dist-web\* D:\Projects\trackk81.github.io\
```

#### 3단계: GitHub에 푸시

```bash
cd D:\Projects\trackk81.github.io
git add .
git commit -m "Initial commit - RefBoard website"
git push origin main
```

#### 4단계: GitHub Pages 설정

1. 리포지토리 Settings > Pages
2. Source: `Deploy from a branch`
3. Branch: `main`, Folder: `/ (root)`
4. Save

#### 5단계: 확인

5-10분 후:
- ✅ `https://trackk81.github.io` 접속 확인
- ✅ Google AdSense에 `https://trackk81.github.io` 입력 가능

---

### 옵션 2: Google AdSense에서 서브패스 사용 (시도해볼 수 있음)

일부 경우 Google AdSense가 서브패스를 허용할 수 있습니다.

1. **"아직 사이트가 없습니다" 체크박스 선택**
2. 계정 생성 완료
3. 나중에 "사이트 추가"에서 `https://trackk81.github.io/refboard-website/` 입력 시도
4. 만약 허용되면 그대로 사용

**주의**: 이 방법은 보장되지 않으며, Google AdSense가 최상위 도메인을 요구할 수 있습니다.

---

### 옵션 3: 커스텀 도메인 사용 (고급)

본인 소유의 도메인이 있다면:

1. **도메인 구매** (예: `refboard.app`, `refboard.dev` 등)
2. **GitHub Pages에 커스텀 도메인 설정**
   - 리포지토리 Settings > Pages > Custom domain
   - 도메인 입력: `www.refboard.app`
3. **DNS 설정**
   - CNAME 레코드: `www` → `trackk81.github.io`
4. **Google AdSense에 커스텀 도메인 입력**
   - `https://www.refboard.app`

**장점**: 전문적인 도메인, SEO에 유리
**단점**: 도메인 구매 비용 필요 (연간 $10-20)

---

## 📋 권장 순서

### 빠른 해결 (옵션 1 권장)

1. ✅ `trackk81.github.io` 리포지토리 생성
2. ✅ 웹사이트 파일 복사 및 배포
3. ✅ `https://trackk81.github.io` 접속 확인
4. ✅ Google AdSense에 루트 도메인 입력
5. ✅ AdSense 코드를 웹사이트에 삽입
6. ✅ 검수 제출

---

## 🔄 기존 리포지토리와의 관계

### 두 리포지토리 모두 유지 가능

- **`refboard-website`**: 개발/테스트용 (선택사항)
- **`trackk81.github.io`**: 프로덕션 (AdSense용)

또는:

- **`trackk81.github.io`**: 메인 웹사이트
- **`refboard-website`**: 리다이렉트 또는 삭제

---

## ✅ 체크리스트

- [ ] `trackk81.github.io` 리포지토리 생성
- [ ] 웹 빌드 실행 (`npm run build:web`)
- [ ] `dist-web` 내용을 새 리포지토리에 복사
- [ ] Git 커밋 및 푸시
- [ ] GitHub Pages 설정 확인
- [ ] `https://trackk81.github.io` 접속 확인
- [ ] Google AdSense에 루트 도메인 입력
- [ ] AdSense 코드 삽입
- [ ] 검수 제출

---

## 💡 팁

1. **자동 배포 설정**
   - GitHub Actions를 사용하여 자동 배포 설정 가능
   - `.github/workflows/deploy.yml` 파일 생성

2. **리다이렉트 설정**
   - `refboard-website` 리포지토리에 `index.html`을 만들어 루트 도메인으로 리다이렉트:
   ```html
   <meta http-equiv="refresh" content="0; url=https://trackk81.github.io">
   ```

3. **두 리포지토리 동기화**
   - 스크립트를 만들어 자동으로 두 리포지토리에 배포 가능

---

## 🆘 문제 해결

### 루트 도메인이 여전히 404인 경우

1. **리포지토리 이름 확인**
   - 정확히 `trackk81.github.io`인지 확인 (대소문자 구분)

2. **GitHub Pages 설정 확인**
   - Settings > Pages에서 올바른 브랜치와 폴더 선택

3. **파일 확인**
   - `index.html`이 리포지토리 루트에 있는지 확인

4. **캐시 문제**
   - 브라우저 캐시 삭제
   - 시크릿 모드에서 확인
   - 5-10분 대기 (GitHub Pages 배포 시간)

5. **DNS 전파 대기**
   - 새 리포지토리 생성 후 최대 24시간 소요 가능


