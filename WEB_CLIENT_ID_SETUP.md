# Web Client ID 설정 가이드 (필수)

현재 발생하는 `400 invalid_request` 에러는 "Desktop"용 Client ID를 웹(localhost)에서 사용하려고 해서 발생합니다. 개발 환경(localhost)을 위해 **Web Application**용 Client ID가 하나 더 필요합니다.

## 1. Google Cloud Console 접속
[Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials) 페이지로 이동합니다.

## 2. 새 Client ID 생성
1. **+ CREATE CREDENTIALS** 클릭 → **OAuth client ID** 선택
2. Application type: **Web application** 선택 (중요!)
3. Name: `RefBoard Web (Dev)` 등 알아보기 쉬운 이름 입력

## 3. URL 설정 (매우 중요)
다음 항목을 정확히 입력해야 합니다:

### Authorized JavaScript origins (승인된 자바스크립트 원본)
- `http://localhost:5173`
- `http://localhost:5000` (혹시 모를 포트 변경 대비)

### Authorized redirect URIs (승인된 리디렉션 URI)
- `http://localhost:5173`
- `http://localhost:5173/` (끝에 슬래시 포함)

## 4. 생성 및 복사
1. **CREATE** 클릭
2. 생성된 **Client ID**를 복사하세요.
   - 형식: `xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com`

## 5. 코드에 적용
복사한 Client ID를 알려주시면 코드에 적용하겠습니다!
