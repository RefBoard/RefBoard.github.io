# 광고 통합 및 앱 심사 가이드

## 📺 광고 통합 방법

### 1. Carbon Ads (권장)

#### 신청 방법
1. **웹사이트 방문**: https://www.carbonads.net/
2. **Publishers 섹션**에서 "Apply to be a Publisher" 클릭
3. **신청서 작성**:
   - **Website URL**: 앱의 공개 URL (예: GitHub Pages, Firebase Hosting)
   - **Monthly Visitors**: 예상 월 방문자 수 (최소 50,000 권장, 하지만 더 적어도 신청 가능)
   - **Category**: Development Tools, Design Tools
   - **Description**: 
     ```
     RefBoard is a visual reference board application for designers and developers.
     It allows users to collect, organize, and reference visual materials while working.
     Target audience: UI/UX designers, developers, digital artists.
     ```
4. **승인 대기**: 보통 1-2주 소요

#### 승인 후 통합
1. Carbon Ads에서 제공하는 Zone ID를 받습니다
2. `public/carbon-ad.html` 파일을 열고 다음 코드를 활성화:
```html
<script async type="text/javascript" 
        src="//cdn.carbonads.com/carbon.js?serve=YOUR_ZONE_ID&placement=refboard" 
        id="_carbonads_js">
</script>
```
3. `YOUR_ZONE_ID`를 실제 Zone ID로 교체

### 2. CodeFund (대안)

- **웹사이트**: https://codefund.io/
- **특징**: 오픈소스 친화적, 낮은 승인 기준
- **신청**: 웹사이트에서 Publisher로 등록

### 3. Google AdSense (일반 웹사이트용)

- **웹사이트**: https://www.google.com/adsense/
- **주의**: Electron 앱에서는 제한적 (웹 버전이 있는 경우)
- **신청**: Google 계정으로 로그인 후 신청

## 📱 Google Play Store 앱 심사 방법

### 1. 준비 사항

#### 필수 요구사항
- Google Play Console 계정 ($25 일회성 등록비)
- 앱 서명 키 (키스토어 파일)
- 앱 아이콘 (512x512 PNG)
- 스크린샷 (최소 2개, 권장 5개)
- 앱 설명 및 개인정보 처리방침

#### 앱 정보
- **앱 이름**: RefBoard
- **짧은 설명**: Visual reference board for designers and developers
- **전체 설명**: 
  ```
  RefBoard는 디자이너와 개발자를 위한 시각적 참조 보드 애플리케이션입니다.
  작업 중 시각 자료를 수집, 정리, 참조할 수 있습니다.
  
  주요 기능:
  - 이미지 및 동영상 참조 보드
  - 실시간 협업
  - Google Drive 통합
  - PSD 파일 지원
  - 펜 도구 및 텍스트 편집
  ```

### 2. 앱 빌드 및 서명

#### 1) 앱 빌드
```bash
npm run build
```

#### 2) Electron 앱 패키징
```bash
npm run build:electron
# 또는
npm run dist
```

#### 3) 앱 서명 (Android)
```bash
# 키스토어 생성 (최초 1회)
keytool -genkey -v -keystore refboard-release-key.keystore -alias refboard -keyalg RSA -keysize 2048 -validity 10000

# APK 서명
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore refboard-release-key.keystore app-release-unsigned.apk refboard
```

### 3. Google Play Console 설정

#### 1) 앱 생성
1. Google Play Console (https://play.google.com/console) 접속
2. "앱 만들기" 클릭
3. 앱 정보 입력:
   - 앱 이름: RefBoard
   - 기본 언어: 한국어
   - 앱 또는 게임: 앱
   - 무료 또는 유료: 무료

#### 2) 스토어 등록 정보
- **앱 아이콘**: 512x512 PNG 업로드
- **기능 그래픽**: 1024x500 PNG (선택사항)
- **스크린샷**: 최소 2개, 권장 5개
- **앱 설명**: 한국어 및 영어
- **카테고리**: 생산성 도구 또는 디자인 도구

#### 3) 콘텐츠 등급
- 앱의 콘텐츠 등급 설문 완료
- 일반적으로 "Everyone" 등급

#### 4) 개인정보 보호
- **개인정보 처리방침 URL**: 필수
- **데이터 보안**: 데이터 수집 및 사용 명시

#### 5) 앱 액세스 권한
- 필요한 권한 명시:
  - 인터넷 (네트워크 접근)
  - 저장소 (파일 읽기/쓰기)
  - 카메라 (선택사항, 이미지 캡처용)

### 4. 앱 업로드

#### 1) 프로덕션 트랙에 앱 업로드
1. "프로덕션" 트랙 선택
2. "새 버전 만들기" 클릭
3. 서명된 APK 또는 AAB 파일 업로드
4. 릴리스 노트 작성

#### 5. 심사 제출
1. 모든 필수 정보 입력 확인
2. "검토 제출" 클릭
3. 심사 대기 (보통 1-3일)

### 6. 심사 통과 후
- 앱이 자동으로 Google Play Store에 게시됩니다
- 업데이트는 동일한 프로세스로 진행

## 🍎 Apple App Store 심사 방법 (macOS)

### 1. Apple Developer 계정
- **비용**: $99/년
- **등록**: https://developer.apple.com/

### 2. 앱 서명 및 공증
```bash
# 앱 서명
codesign --deep --force --verify --verbose --sign "Developer ID Application: Your Name" RefBoard.app

# 공증 (notarization)
xcrun altool --notarize-app --primary-bundle-id "com.refboard.app" --username "your@email.com" --password "@keychain:AC_PASSWORD" --file RefBoard.zip
```

### 3. App Store Connect 설정
1. https://appstoreconnect.apple.com/ 접속
2. "내 앱" > "+" 클릭
3. 앱 정보 입력 및 업로드

## 📝 체크리스트

### 광고 통합
- [ ] Carbon Ads 또는 다른 광고 네트워크 신청
- [ ] 광고 코드 통합
- [ ] 광고 표시 테스트

### Google Play Store
- [ ] Google Play Console 계정 생성 ($25)
- [ ] 앱 아이콘 준비 (512x512)
- [ ] 스크린샷 준비 (최소 2개)
- [ ] 앱 설명 작성
- [ ] 개인정보 처리방침 작성
- [ ] 앱 빌드 및 서명
- [ ] APK/AAB 업로드
- [ ] 심사 제출

### Apple App Store (macOS)
- [ ] Apple Developer 계정 ($99/년)
- [ ] 앱 서명 및 공증
- [ ] App Store Connect 설정
- [ ] 심사 제출

