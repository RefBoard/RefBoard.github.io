# Google OAuth 설정 가이드

## 🔍 문제 원인

Google OAuth 로그인 시 `redirect_uri_mismatch` 에러가 발생했습니다.

**에러 메시지:**
```
400 오류: redirect_uri_mismatch
origin: http://localhost:8080
```

**원인:**
- Google Cloud Console에서 `http://localhost:8080`이 승인된 JavaScript 출처로 등록되지 않음
- OAuth 2.0 클라이언트 ID 설정에 리디렉션 URI가 등록되지 않음

---

## ✅ 해결 방법: Google Cloud Console 설정

### 1단계: Google Cloud Console 접속

1. 브라우저에서 다음 URL 접속:
   **https://console.cloud.google.com/**

2. **프로젝트 선택**
   - 상단에서 `refboard-21681` 프로젝트 선택
   - 또는 Firebase 프로젝트와 연결된 Google Cloud 프로젝트 선택

### 2단계: API 및 서비스 설정

1. 왼쪽 메뉴에서 **API 및 서비스** → **사용자 인증 정보** 클릭
2. OAuth 2.0 클라이언트 ID 목록에서 **웹 클라이언트** 찾기
   - 이름이 "Web client" 또는 "웹 클라이언트"인 항목
   - 또는 Firebase에서 자동 생성된 클라이언트 ID

### 3단계: 승인된 JavaScript 출처 추가

1. **웹 클라이언트** 클릭하여 편집
2. **승인된 JavaScript 출처** 섹션 찾기
3. **URI 추가** 버튼 클릭
4. 다음 URI들을 하나씩 추가:

   ```
   http://localhost:8080
   ```

   **중요:** 끝에 슬래시(`/`) 없이 입력하세요!

5. **저장** 버튼 클릭

### 4단계: 승인된 리디렉션 URI 추가

1. 같은 페이지에서 **승인된 리디렉션 URI** 섹션 찾기
2. **URI 추가** 버튼 클릭
3. 다음 URI들을 하나씩 추가:

   ```
   http://localhost:8080
   http://localhost:8080/
   ```

   또는 Firebase Auth를 사용하는 경우:

   ```
   http://localhost:8080/__/auth/handler
   ```

4. **저장** 버튼 클릭

---

## 📝 추가로 확인할 도메인

다음 도메인들도 승인된 JavaScript 출처에 포함되어 있는지 확인하세요:

### 개발 모드용
```
http://localhost:5173
```

### 프로덕션 모드용 (Electron)
```
http://localhost:8080
```

### 웹 배포용 (GitHub Pages)
```
https://trackk81.github.io
```

---

## 🔧 Firebase Console에서도 확인

Firebase Console에서도 OAuth 설정을 확인할 수 있습니다:

1. **https://console.firebase.google.com/** 접속
2. **RefBoard 프로젝트 선택** (`refboard-21681`)
3. **프로젝트 설정** (톱니바퀴 아이콘) 클릭
4. **일반** 탭에서 **웹 앱** 섹션 확인
5. **승인된 도메인** 섹션 확인
   - `localhost`가 포함되어 있는지 확인
   - 필요하면 추가

---

## 🚀 설정 완료 후

설정을 저장한 후:

1. **브라우저 캐시 삭제** (선택사항)
   - `Ctrl + Shift + Delete`
   - 캐시된 이미지 및 파일 삭제

2. **Electron 앱 재시작**
   - 앱을 완전히 종료하고 다시 실행

3. **로그인 다시 시도**
   - Google 로그인 버튼 클릭
   - 에러가 사라졌는지 확인

---

## 🆘 여전히 문제가 있다면

### 문제 1: 여러 OAuth 클라이언트 ID가 있는 경우

Firebase와 Google Cloud Console에서 각각 클라이언트 ID를 생성했을 수 있습니다.

**해결책:**
- Firebase에서 생성된 클라이언트 ID 사용
- 또는 Google Cloud Console에서 생성한 클라이언트 ID 사용
- 두 곳 모두 동일한 설정으로 업데이트

### 문제 2: 포트 번호가 다른 경우

현재 `http://localhost:8080`을 사용하고 있지만, 다른 포트를 사용할 수도 있습니다.

**해결책:**
- `electron/main.js`에서 포트 번호 확인
- Google Cloud Console에 실제 사용하는 포트 번호 추가

### 문제 3: 프로토콜이 다른 경우

`http://` 대신 `https://`를 사용하는 경우도 있습니다.

**해결책:**
- 실제 사용하는 프로토콜에 맞춰 설정
- Electron 앱은 일반적으로 `http://localhost` 사용

---

## 📋 체크리스트

설정 확인:
- [ ] Google Cloud Console 접속
- [ ] 올바른 프로젝트 선택
- [ ] OAuth 2.0 클라이언트 ID 찾기
- [ ] 승인된 JavaScript 출처에 `http://localhost:8080` 추가
- [ ] 승인된 리디렉션 URI에 `http://localhost:8080` 추가
- [ ] 설정 저장

테스트:
- [ ] 앱 재시작
- [ ] 로그인 시도
- [ ] 에러 확인

---

## 🎉 완료!

Google Cloud Console에서 설정을 완료하면 OAuth 로그인이 정상적으로 작동합니다!

**다음 단계:**
1. Google Cloud Console에서 설정 완료
2. 앱 재시작
3. 로그인 테스트

문제가 계속되면 알려주세요!




