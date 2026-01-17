# SSL 인증서 "안전하지 않음" 해결 가이드

## 🔍 문제 상황

- ❌ 브라우저에서 "안전하지 않음" 또는 "Not Secure" 경고 표시
- ❌ SSL 인증서가 아직 발급되지 않음
- ⚠️ HTTPS로 접속 시 인증서 오류 발생

---

## ✅ 해결 방법

### 1단계: GitHub Pages 설정 확인

#### 1-1. GitHub 리포지토리 접속

1. **GitHub 리포지토리 접속**
   - https://github.com/RefBoard/RefBoard.github.io
   - **Settings** 탭 클릭
   - 왼쪽 메뉴에서 **Pages** 클릭

#### 1-2. Custom domain 확인

1. **Custom domain 섹션 확인**
   - 도메인이 올바르게 입력되어 있는지 확인
   - `www.refboard.org` 또는 `refboard.org`

2. **DNS 상태 확인**
   - "DNS check successful" 또는 "✓" 표시 확인
   - 아직 에러가 있다면 DNS 설정을 먼저 완료해야 합니다

#### 1-3. Enforce HTTPS 활성화

1. **"Enforce HTTPS" 체크박스 확인**
   - 체크박스가 보이지 않으면 → SSL 인증서가 아직 발급되지 않은 상태
   - 체크박스가 보이면 → 체크하여 활성화

2. **체크박스가 비활성화되어 있는 경우**
   - SSL 인증서 발급 대기 필요
   - 최대 24시간 소요될 수 있음
   - 보통 10분 ~ 1시간 내 완료

---

### 2단계: SSL 인증서 발급 대기

GitHub Pages는 DNS 설정이 완료된 후 **자동으로 SSL 인증서를 발급**합니다.

#### 발급 시간

- **최소**: 10분
- **일반**: 30분 ~ 1시간
- **최대**: 24시간

#### 확인 방법

1. **GitHub Pages 설정 페이지에서 확인**
   - Settings → Pages
   - "Enforce HTTPS" 체크박스가 활성화되면 발급 완료

2. **브라우저에서 확인**
   - `https://www.refboard.org` 접속
   - 주소창 왼쪽에 **자물쇠 아이콘** 표시 확인
   - "연결이 안전합니다" 메시지 확인

---

### 3단계: DNS 전파 완료 확인

SSL 인증서 발급 전에 DNS가 완전히 전파되어야 합니다.

#### 확인 방법

1. **온라인 도구 사용**
   - https://dnschecker.org 접속
   - 도메인: `www.refboard.org`
   - 타입: `CNAME`
   - 전 세계 여러 위치에서 `refboard.github.io`로 확인되는지 확인

2. **명령 프롬프트 사용**
   ```cmd
   nslookup www.refboard.org
   ```
   - `refboard.github.io`로 확인되어야 함

---

### 4단계: 강제 HTTPS 리다이렉트 확인

SSL 인증서가 발급되면 HTTP를 HTTPS로 자동 리다이렉트합니다.

#### 확인 방법

1. **HTTP 접속 테스트**
   - `http://www.refboard.org` 접속
   - 자동으로 `https://www.refboard.org`로 리다이렉트되는지 확인

2. **HTTPS 접속 테스트**
   - `https://www.refboard.org` 접속
   - 자물쇠 아이콘 표시 확인
   - 경고 없이 정상 접속되는지 확인

---

## 🆘 문제 해결

### 여전히 "안전하지 않음"이 표시되는 경우

#### 1. DNS 전파 대기

- DNS 변경 후 최대 24시간 소요될 수 있음
- 조금 더 기다려보세요

#### 2. GitHub Pages에서 수동 확인

1. GitHub 리포지토리 → Settings → Pages
2. Custom domain 섹션에서 **"Check again"** 클릭
3. DNS 상태 확인

#### 3. 브라우저 캐시 삭제

1. 브라우저 캐시 삭제
2. 시크릿 모드에서 접속 테스트
3. 다른 브라우저에서 테스트

#### 4. DNS 설정 재확인

1. 도메인 업체 DNS 관리 페이지 접속
2. CNAME 레코드 확인:
   - 호스트: `www`
   - 값: `RefBoard.github.io.` (끝에 점 필수!)
3. 저장 및 적용 확인

#### 5. GitHub Pages 설정 재확인

1. Custom domain이 올바르게 입력되어 있는지 확인
2. 도메인을 삭제하고 다시 입력해보기:
   - Custom domain 필드 비우기
   - Save 클릭
   - 잠시 대기 (1-2분)
   - 다시 도메인 입력: `www.refboard.org`
   - Save 클릭

---

## 📋 체크리스트

SSL 인증서 발급을 위한 필수 조건:

- [ ] DNS 레코드 설정 완료 (CNAME 또는 A 레코드)
- [ ] DNS 전파 완료 확인 (dnschecker.org에서 확인)
- [ ] GitHub Pages에서 "DNS check successful" 표시
- [ ] Custom domain 올바르게 입력됨
- [ ] SSL 인증서 발급 대기 (최대 24시간)
- [ ] "Enforce HTTPS" 체크박스 활성화 확인
- [ ] `https://www.refboard.org` 접속 시 자물쇠 아이콘 표시

---

## 💡 추가 팁

### SSL 인증서 발급 가속화

1. **DNS 설정 즉시 완료**
   - DNS 레코드를 빠르게 설정할수록 인증서 발급이 빨라집니다

2. **GitHub Pages에서 수동 확인**
   - Settings → Pages에서 "Check again" 클릭
   - 수동 확인이 발급을 촉진할 수 있습니다

3. **도메인 설정 재시도**
   - 도메인을 삭제하고 다시 입력하면 발급이 재시도됩니다

### 두 도메인 모두 HTTPS 사용

- `www.refboard.org` (CNAME) → HTTPS 자동 작동
- `refboard.org` (A 레코드) → HTTPS 자동 작동
- GitHub Pages가 두 도메인 모두 자동으로 처리합니다

---

## ✅ 완료 확인

다음 항목들이 모두 확인되면 완료입니다:

- [ ] GitHub Pages에서 "DNS check successful" 표시
- [ ] "Enforce HTTPS" 체크박스 활성화됨
- [ ] `https://www.refboard.org` 접속 시 자물쇠 아이콘 표시
- [ ] "연결이 안전합니다" 메시지 표시
- [ ] HTTP 접속 시 자동으로 HTTPS로 리다이렉트됨

---

## ⏰ 예상 소요 시간

- **DNS 전파**: 10분 ~ 1시간
- **SSL 인증서 발급**: 10분 ~ 24시간
- **총 소요 시간**: 보통 30분 ~ 2시간 내 완료

**참고**: 대부분의 경우 1시간 이내에 완료되지만, 최대 24시간까지 소요될 수 있습니다.

---

## 🎉 완료!

SSL 인증서가 발급되면:
- ✅ "안전하지 않음" 경고 사라짐
- ✅ 자물쇠 아이콘 표시
- ✅ HTTPS 자동 리다이렉트 작동
- ✅ Google AdSense 승인에 유리

**인내심을 갖고 기다려주세요!** GitHub Pages가 자동으로 SSL 인증서를 발급합니다. 🚀


