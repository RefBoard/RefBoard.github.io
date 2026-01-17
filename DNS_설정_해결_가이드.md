# DNS 설정 해결 가이드 - www.refboard.org

## 🔍 현재 상황

- **도메인**: `www.refboard.org`
- **GitHub 리포지토리**: `RefBoard/RefBoard.github.io`
- **에러**: "DNS check unsuccessful" - DNS 레코드를 찾을 수 없음

---

## ✅ 해결 방법

### 1단계: GitHub 사용자명 확인

리포지토리 이름이 `RefBoard.github.io`이므로, GitHub 사용자명은 **`RefBoard`**입니다.

**확인 방법**:
- GitHub 리포지토리 URL: `https://github.com/RefBoard/RefBoard.github.io`
- GitHub Pages URL: `https://RefBoard.github.io`

---

### 2단계: 도메인 업체 DNS 관리 페이지 접속

1. **도메인 구매한 업체 사이트 접속**
   - 가비아, 후이즈, 카페24 등 구매한 업체
   - 로그인

2. **도메인 관리 메뉴 찾기**
   - "도메인 관리" 또는 "My Domains"
   - "DNS 관리" 또는 "DNS 설정"

3. **refboard.org 도메인 선택**

---

### 3단계: DNS 레코드 추가

#### 3-1. CNAME 레코드 추가 (www 서브도메인용)

**설정 값**:
- **레코드 타입**: `CNAME`
- **호스트/이름**: `www`
- **값/대상**: `RefBoard.github.io.` ⚠️ **끝에 점(.) 필수!**
- **TTL**: `3600` (또는 기본값)

**중요**: 
- 호스트는 `www`만 입력 (도메인명 제외)
- 대상은 `RefBoard.github.io.` (끝에 점(.)을 반드시 추가!)
- 일부 도메인 업체는 FQDN(완전한 도메인명)을 요구하므로 끝에 점이 필요합니다

#### 3-2. A 레코드 추가 (루트 도메인용 - 선택사항)

루트 도메인(`refboard.org`)도 사용하려면 A 레코드를 추가하세요.

**4개의 A 레코드를 모두 추가**:

1. **첫 번째 A 레코드**:
   - 레코드 타입: `A`
   - 호스트/이름: `@` 또는 공백 (루트 도메인)
   - 값/대상: `185.199.108.153`
   - TTL: `3600`

2. **두 번째 A 레코드**:
   - 레코드 타입: `A`
   - 호스트/이름: `@` 또는 공백
   - 값/대상: `185.199.109.153`
   - TTL: `3600`

3. **세 번째 A 레코드**:
   - 레코드 타입: `A`
   - 호스트/이름: `@` 또는 공백
   - 값/대상: `185.199.110.153`
   - TTL: `3600`

4. **네 번째 A 레코드**:
   - 레코드 타입: `A`
   - 호스트/이름: `@` 또는 공백
   - 값/대상: `185.199.111.153`
   - TTL: `3600`

**참고**: 
- `@`는 루트 도메인(`refboard.org`)을 의미합니다
- 일부 업체에서는 호스트를 공백으로 두거나 `*`를 사용합니다

---

### 4단계: DNS 설정 저장

1. **모든 레코드 추가 완료 후**
2. **"저장"** 또는 **"적용"** 버튼 클릭
3. **변경사항 확인**

---

### 5단계: DNS 전파 확인

DNS 변경사항이 전 세계에 전파되는데 **10분 ~ 24시간** 소요됩니다.

#### 확인 방법 1: 온라인 도구 사용

1. **https://dnschecker.org** 접속
2. 도메인 입력: `www.refboard.org`
3. 레코드 타입: `CNAME` 선택
4. **"Search"** 클릭
5. 전 세계 여러 위치에서 `RefBoard.github.io`로 확인되는지 확인

#### 확인 방법 2: 명령 프롬프트 사용

```cmd
nslookup www.refboard.org
```

**예상 결과**:
```
www.refboard.org
    canonical name = RefBoard.github.io
```

#### 확인 방법 3: GitHub Pages 설정 확인

1. GitHub 리포지토리 → Settings → Pages
2. Custom domain 섹션 확인
3. **"DNS check successful"** 또는 **"✓"** 표시 확인
4. **"Enforce HTTPS"** 체크박스가 활성화되면 체크

---

## 📋 DNS 설정 요약

### 필수 설정 (www 서브도메인)

```
타입: CNAME
호스트: www
값: RefBoard.github.io.  ⚠️ 끝에 점(.) 필수!
TTL: 3600
```

### 선택 설정 (루트 도메인)

```
타입: A
호스트: @
값: 185.199.108.153
TTL: 3600

타입: A
호스트: @
값: 185.199.109.153
TTL: 3600

타입: A
호스트: @
값: 185.199.110.153
TTL: 3600

타입: A
호스트: @
값: 185.199.111.153
TTL: 3600
```

---

## 🆘 문제 해결

### 여전히 "DNS check unsuccessful" 에러가 나는 경우

#### 1. DNS 설정 재확인
- CNAME 레코드의 대상이 정확히 `RefBoard.github.io.`인지 확인 (끝에 점 필수!)
- 일부 도메인 업체는 FQDN을 요구하므로 끝에 점이 필요합니다
- 오타가 없는지 확인

#### 2. DNS 전파 대기
- DNS 변경 후 최대 24시간 소요될 수 있습니다
- 보통 10분 ~ 1시간 내에 완료됩니다
- 조금 더 기다려보세요

#### 3. 브라우저 캐시 삭제
- 브라우저 캐시를 삭제하고 다시 확인
- 시크릿 모드에서 확인

#### 4. 도메인 업체 확인
- 일부 도메인 업체는 DNS 설정이 즉시 반영되지 않을 수 있습니다
- 도메인 업체 고객센터에 문의

### CNAME 레코드를 추가할 수 없는 경우

일부 도메인 업체는 루트 도메인(`refboard.org`)에 CNAME 레코드를 허용하지 않습니다.

**해결 방법**:
- `www.refboard.org`만 사용 (CNAME 레코드)
- 루트 도메인(`refboard.org`)은 A 레코드 사용
- GitHub Pages 설정에서 `www.refboard.org`만 입력

---

## ✅ 완료 확인

다음 항목들이 모두 확인되면 완료입니다:

- [ ] DNS 레코드 추가 완료
- [ ] dnschecker.org에서 CNAME 확인됨
- [ ] GitHub Pages에서 "DNS check successful" 표시
- [ ] `https://www.refboard.org` 접속 가능
- [ ] SSL 인증서 자동 발급 완료 (자물쇠 아이콘 표시)

---

## 💡 추가 팁

### www 없이 루트 도메인만 사용하려면

1. GitHub Pages 설정에서 `refboard.org` 입력 (www 제거)
2. CNAME 레코드 대신 A 레코드 4개만 사용
3. 리포지토리에 CNAME 파일 생성:
   ```
   refboard.org
   ```

### 두 도메인 모두 사용하려면

1. CNAME 레코드 (`www`) + A 레코드 4개 (`@`) 모두 추가
2. GitHub Pages 설정에서 `www.refboard.org` 입력
3. 루트 도메인도 자동으로 작동합니다

---

## 📞 도메인 업체별 설정 방법

### 가비아 (Gabia)

1. 로그인 → "도메인" → "도메인 관리"
2. `refboard.org` 선택 → "DNS 관리"
3. "레코드 추가" 클릭
4. CNAME 레코드 추가:
   - 호스트: `www`
   - 값: `RefBoard.github.io.` ⚠️ 끝에 점(.) 필수!
5. 저장

### 후이즈 (Whois)

1. 로그인 → "도메인 관리"
2. `refboard.org` 선택 → "DNS 설정"
3. "레코드 추가" 클릭
4. CNAME 레코드 추가:
   - 이름: `www`
   - 타입: `CNAME`
   - 값: `RefBoard.github.io.` ⚠️ 끝에 점(.) 필수!
5. 저장

### 카페24

1. 로그인 → "도메인 관리"
2. `refboard.org` 선택 → "DNS 관리"
3. "레코드 추가" 클릭
4. CNAME 레코드 추가:
   - 호스트: `www`
   - 타입: `CNAME`
   - 값: `RefBoard.github.io.` ⚠️ 끝에 점(.) 필수!
5. 저장

---

**DNS 설정이 완료되면 GitHub Pages가 자동으로 SSL 인증서를 발급하고, 몇 분 내에 사이트가 작동합니다!** 🎉

