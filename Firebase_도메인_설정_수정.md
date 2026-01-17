# Firebase 도메인 설정 수정 가이드

## 🔍 문제

Firebase 콘솔에서 `file://` 도메인을 추가할 수 없습니다. Firebase는 유효한 도메인 형식만 허용합니다.

**에러 메시지:**
```
올바른 도메인 이름(예: 'myapp.com')을 입력해야 합니다.
```

---

## ✅ 해결 방법: 커스텀 프로토콜 사용

Electron 앱에서 `file://` 대신 커스텀 프로토콜(`refboard://`)을 사용하도록 변경했습니다.

### 변경 사항

1. **커스텀 프로토콜 등록**
   - `refboard://` 프로토콜을 등록하여 로컬 파일을 로드

2. **프로덕션 모드에서 커스텀 프로토콜 사용**
   - `file://` 대신 `refboard://index.html` 사용

---

## 🔧 Firebase 콘솔 설정

이제 Firebase 콘솔에서 다음 도메인을 추가하세요:

### 1단계: Firebase 콘솔 접속

1. **https://console.firebase.google.com/** 접속
2. **RefBoard 프로젝트 선택** (`refboard-21681`)

### 2단계: Authentication 설정

1. **Build** → **Authentication** 클릭
2. **Settings** (설정) 탭 클릭
3. **Authorized domains** (승인된 도메인) 섹션으로 스크롤

### 3단계: 도메인 추가

**Add domain** (도메인 추가) 버튼 클릭 후 다음을 입력:

```
refboard://
```

또는

```
refboard
```

**참고:** Firebase가 프로토콜 형식을 허용하지 않을 수 있습니다. 그 경우 `refboard`만 입력해보세요.

---

## 🔄 대안: localhost 사용

만약 `refboard://`도 추가할 수 없다면, 로컬 서버를 사용하는 방법이 있습니다:

### 옵션 1: 로컬 서버 사용 (권장)

`electron/main.js`를 수정하여 로컬 서버를 시작:

```javascript
// 프로덕션 모드에서도 localhost 사용
if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
} else {
    // 간단한 로컬 서버 시작 (예: http-server 사용)
    // 또는 Electron의 내장 서버 사용
    mainWindow.loadURL('http://localhost:8080');
}
```

그리고 Firebase 콘솔에 `localhost`를 추가 (이미 기본적으로 포함되어 있을 수 있음)

### 옵션 2: webSecurity 비활성화 (현재 설정)

현재 `webSecurity: false`로 설정되어 있으므로, 일부 보안 검사를 우회할 수 있습니다.

하지만 Firebase 인증의 경우 여전히 도메인 검증이 필요합니다.

---

## 🚀 다시 빌드하기

코드를 수정했으므로 다시 빌드해야 합니다:

```bash
cd D:\Scripts\RefBoard
npm run electron:build
```

---

## ✅ 확인 방법

1. **Firebase 콘솔에서 도메인 추가**
   - `refboard://` 또는 `refboard` 추가 시도
   - 안 되면 `localhost` 확인 (이미 포함되어 있을 수 있음)

2. **앱 재빌드**
   ```bash
   npm run electron:build
   ```

3. **앱 재시작 및 테스트**
   - 설치 파일로 다시 설치
   - 로그인 시도

---

## 🆘 여전히 문제가 있다면

### 방법 1: localhost 사용으로 변경

`electron/main.js`를 수정하여 프로덕션 모드에서도 `localhost`를 사용:

```javascript
// 프로덕션 모드에서 간단한 로컬 서버 사용
const http = require('http');
const serve = require('serve-static');
const finalhandler = require('finalhandler');

if (process.env.NODE_ENV !== 'development') {
    const serveStatic = serve(path.join(__dirname, '../dist'));
    const server = http.createServer((req, res) => {
        serveStatic(req, res, finalhandler(req, res));
    });
    server.listen(8080, () => {
        mainWindow.loadURL('http://localhost:8080');
    });
}
```

이 방법은 추가 패키지가 필요합니다.

### 방법 2: Firebase 설정 확인

Firebase 콘솔에서 `localhost`가 이미 포함되어 있는지 확인하세요.

일반적으로 다음 도메인들이 기본적으로 포함되어 있습니다:
- `localhost`
- `refboard-21681.firebaseapp.com`
- `refboard-21681.web.app`

---

## 📝 현재 상태

코드는 이미 수정되었습니다:
- ✅ 커스텀 프로토콜 `refboard://` 등록
- ✅ 프로덕션 모드에서 커스텀 프로토콜 사용

다음 단계:
1. Firebase 콘솔에서 `refboard://` 또는 `refboard` 추가 시도
2. 안 되면 `localhost` 확인
3. 앱 재빌드 및 테스트

---

## 🎯 빠른 해결책

가장 간단한 방법은 **로컬 서버를 사용**하는 것입니다. 하지만 현재 코드는 커스텀 프로토콜을 사용하도록 수정되었으므로, 먼저 Firebase 콘솔에서 `refboard://` 또는 `refboard`를 추가해보세요.

문제가 계속되면 알려주세요. 다른 해결 방법을 제시하겠습니다.




