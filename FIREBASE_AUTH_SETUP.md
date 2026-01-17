# Firebase Authentication 설정 가이드

## 완료한 작업
✅ Firebase Authentication 서비스 구현 (`src/services/firebaseAuth.ts`)
✅ 로그인 화면 생성 및 통합
✅ App.tsx에 인증 상태 관리 추가

## 다음 단계: Firebase Console에서 Google 로그인 활성화

### 1. Firebase Console 접속
https://console.firebase.google.com/ 접속

### 2. RefBoard 프로젝트 선택
프로젝트 목록에서 **refboard-21681** 프로젝트 클릭

### 3. Authentication 설정
1. 왼쪽 메뉴에서 **Build** → **Authentication** 클릭
2. **Get started** 또는 **시작하기** 버튼 클릭
3. **Sign-in method** (로그인 제공업체) 탭 클릭
4. **Google** 선택
5. **사용 설정** 토글을 ON으로 전환
6. **프로젝트 지원 이메일** 드롭다운에서 본인 이메일 선택
7. **저장** 버튼 클릭

### 4. 완료!
설정이 완료되면 앱에서 Google 로그인을 사용할 수 있습니다.

---

## 다음 실행 방법

설정 완료 후:
```bash
npm run electron:dev
```

로그인 화면이 나타나고, "Google로 로그인" 버튼을 클릭하면 팝업에서 Google 계정을 선택할 수 있습니다!
