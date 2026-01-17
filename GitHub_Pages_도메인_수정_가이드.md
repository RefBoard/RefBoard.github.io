# GitHub Pages 도메인 설정 수정 가이드

## 🔍 현재 상황

- ✅ `www.refboard.org` - CNAME 레코드 정상 작동
- ❌ `refboard.org` (루트 도메인) - A 레코드 없음
- ❌ GitHub Pages에 `refboard.org` 입력 → 에러 발생

## ✅ 해결 방법

### 방법 1: www 서브도메인 사용 (권장) ⭐

**가장 간단하고 빠른 방법입니다.**

1. **GitHub 리포지토리 접속**
   - https://github.com/RefBoard/RefBoard.github.io
   - Settings → Pages

2. **Custom domain 수정**
   - 현재: `refboard.org`
   - 변경: `www.refboard.org` (www 추가)
   - **Save** 클릭

3. **확인**
   - 몇 분 후 "DNS check successful" 표시 확인
   - `https://www.refboard.org` 접속 가능

4. **SSL 인증서 발급 대기**
   - DNS 확인 완료 후 GitHub Pages가 자동으로 SSL 인증서 발급
   - 최대 24시간 소요 (보통 10분 ~ 1시간)
   - "Enforce HTTPS" 체크박스가 활성화되면 발급 완료

**장점**:
- 이미 CNAME 레코드가 설정되어 있어 즉시 작동
- 추가 DNS 설정 불필요
- SSL 인증서 자동 발급

---

### 방법 2: 루트 도메인 사용 (A 레코드 추가 필요)

루트 도메인(`refboard.org`)을 사용하려면 A 레코드를 추가해야 합니다.

#### 2-1. 도메인 업체 DNS 관리 페이지 접속

1. 도메인 업체 로그인
2. DNS 설정 페이지로 이동

#### 2-2. A 레코드 4개 추가

**4개의 A 레코드를 모두 추가**:

1. **첫 번째 A 레코드**:
   - 타입: `A`
   - 호스트: `@` (또는 공백)
   - 값: `185.199.108.153`
   - TTL: `3600`

2. **두 번째 A 레코드**:
   - 타입: `A`
   - 호스트: `@`
   - 값: `185.199.109.153`
   - TTL: `3600`

3. **세 번째 A 레코드**:
   - 타입: `A`
   - 호스트: `@`
   - 값: `185.199.110.153`
   - TTL: `3600`

4. **네 번째 A 레코드**:
   - 타입: `A`
   - 호스트: `@`
   - 값: `185.199.111.153`
   - TTL: `3600`

#### 2-3. 저장 및 확인

1. 설정 저장
2. 10분 ~ 1시간 대기 (DNS 전파)
3. 확인:
   ```cmd
   nslookup refboard.org
   ```
   - 4개의 IP 주소가 모두 표시되어야 함

#### 2-4. GitHub Pages 설정

1. GitHub 리포지토리 → Settings → Pages
2. Custom domain: `refboard.org` (www 없이)
3. Save 클릭
4. "DNS check successful" 확인

---

## 📋 현재 DNS 상태 확인

### ✅ 정상 작동 중
- `www.refboard.org` → CNAME → `refboard.github.io` ✅

### ❌ 설정 필요
- `refboard.org` → A 레코드 4개 필요 ❌

---

## 💡 권장 사항

**방법 1 (www 서브도메인 사용)을 권장합니다:**

1. ✅ 이미 설정되어 있어 즉시 작동
2. ✅ 추가 DNS 설정 불필요
3. ✅ 더 빠른 해결
4. ✅ 루트 도메인도 자동으로 리다이렉트됨 (GitHub Pages가 자동 처리)

**두 도메인 모두 사용하려면:**
- `www.refboard.org` (CNAME) + `refboard.org` (A 레코드 4개) 모두 설정
- GitHub Pages에는 `www.refboard.org` 입력
- 루트 도메인도 자동으로 작동

---

## 🆘 문제 해결

### 여전히 "DNS check unsuccessful" 에러가 나는 경우

1. **DNS 전파 대기**
   - DNS 변경 후 최대 24시간 소요될 수 있음
   - 보통 10분 ~ 1시간 내 완료

2. **GitHub Pages에서 "Check again" 클릭**
   - 에러 메시지 옆의 "Check again" 버튼 클릭
   - 수동으로 다시 확인

3. **브라우저 캐시 삭제**
   - 브라우저 캐시 삭제 후 다시 확인
   - 시크릿 모드에서 확인

4. **DNS 확인 도구 사용**
   - https://dnschecker.org 접속
   - 도메인 입력 후 전 세계 DNS 서버에서 확인

---

## ✅ 완료 확인

다음 항목들이 모두 확인되면 완료입니다:

- [ ] GitHub Pages에 올바른 도메인 입력 (`www.refboard.org` 또는 `refboard.org`)
- [ ] DNS 레코드 설정 완료 (CNAME 또는 A 레코드)
- [ ] DNS 전파 완료 확인
- [ ] GitHub Pages에서 "DNS check successful" 표시
- [ ] `https://www.refboard.org` 또는 `https://refboard.org` 접속 가능
- [ ] SSL 인증서 자동 발급 완료 (자물쇠 아이콘 표시)

