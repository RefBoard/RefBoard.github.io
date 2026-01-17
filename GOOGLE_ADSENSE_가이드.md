# Google AdSense 통합 가이드

## 📋 Google AdSense FAQ

### Q1: Google AdSense를 배너에 넣을 수 있나요?
**답변: 네, 가능합니다!**
- 현재 Carbon Ads와 동일한 방식으로 iframe을 통해 표시할 수 있습니다
- Electron 앱에서도 정상 작동합니다

### Q2: 앱 검수부터 받아야 하나요?
**답변: 아니요, 앱 검수와는 별개입니다!**
- Google AdSense는 **웹사이트 검수**가 필요합니다 (앱 검수와는 별개)
- Electron 앱의 경우, 웹 버전(GitHub Pages 등)이 있으면 그 웹사이트로 신청할 수 있습니다
- Microsoft Store 앱 검수와 Google AdSense 검수는 **독립적**입니다

### Q3: 웹사이트가 없으면 안 되나요?
**답변: 웹사이트가 필요합니다**
- Google AdSense는 웹사이트 URL이 필요합니다
- GitHub Pages, Firebase Hosting 등 공개 웹사이트가 있으면 됩니다
- ⚠️ **중요**: AdSense 신청 시 **최상위 도메인**만 입력 (`https://trackk81.github.io`)
- 서브패스는 광고 단위 생성 시 지정 가능

---

## 🚀 Google AdSense 신청 방법

### 1단계: Google AdSense 계정 생성

1. **웹사이트 접속**
   - https://www.google.com/adsense/
   - Google 계정으로 로그인

2. **계정 생성**
   - "시작하기" 클릭
   - ⚠️ **중요**: 웹사이트 URL은 **최상위 도메인**만 입력해야 합니다
   - 웹사이트 URL 입력: `https://trackk81.github.io` (서브패스 제외!)
   - 국가/지역 선택: 대한민국
   - 결제 정보 입력 (나중에 수익이 발생하면 필요)

### 2단계: 웹사이트 검수 신청

1. **사이트 추가**
   - AdSense 대시보드에서 "사이트" 메뉴 클릭
   - "사이트 추가" 클릭
   - ⚠️ **중요**: 웹사이트 URL은 **최상위 도메인**만 입력해야 합니다
   - 웹사이트 URL 입력: `https://trackk81.github.io` (서브패스 `/refboard-website/` 제외!)
   - ❌ 잘못된 예: `https://trackk81.github.io/refboard-website/`
   - ✅ 올바른 예: `https://trackk81.github.io`

2. **AdSense 코드 삽입**
   - Google에서 제공하는 코드를 웹사이트에 삽입해야 합니다
   - GitHub Pages의 경우 `index.html`의 `<head>` 태그에 코드 추가
   - 코드 예시:
   ```html
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXX"
           crossorigin="anonymous"></script>
   ```

3. **검수 제출**
   - 코드 삽입 후 "검토 요청" 클릭
   - 검수 기간: 보통 1-2주 (최대 4주까지 소요 가능)

### 3단계: 광고 단위 생성

검수 승인 후:

1. **광고 단위 생성**
   - AdSense 대시보드에서 "광고" → "광고 단위" 클릭
   - "새 광고 단위" 클릭
   - 광고 형식 선택: **리더보드 (728x90)** ← 현재 배너 크기
   - 이름 입력: "RefBoard Banner"

2. **광고 코드 받기**
   - 생성된 광고 단위의 코드 복사
   - 예시:
   ```html
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXX"
           crossorigin="anonymous"></script>
   <ins class="adsbygoogle"
        style="display:block"
        data-ad-client="ca-pub-XXXXXXXXXX"
        data-ad-slot="XXXXXXXXXX"
        data-ad-format="auto"
        data-full-width-responsive="true"></ins>
   <script>
        (adsbygoogle = window.adsbygoogle || []).push({});
   </script>
   ```

---

## 🔧 Google AdSense 통합 방법

### 방법 1: 기존 Carbon Ads 파일 교체 (권장)

1. **`public/google-adsense.html` 파일 열기**
   - 이미 생성되어 있습니다

2. **광고 코드 활성화**
   - 30-40번 줄의 주석 해제
   - `YOUR_AD_CLIENT_ID`를 실제 AdSense 클라이언트 ID로 교체
   - `YOUR_AD_SLOT_ID`를 실제 광고 슬롯 ID로 교체

3. **`src/components/AdBanner.tsx` 수정**
   ```typescript
   // 기존:
   const adUrl = '/carbon-ad.html';
   
   // 변경:
   const adUrl = '/google-adsense.html';
   ```

### 방법 2: 두 가지 광고 모두 지원 (선택 가능)

`AdBanner.tsx`를 수정하여 설정에 따라 선택할 수 있도록:

```typescript
const adType = 'adsense'; // 'carbon' 또는 'adsense'
const adUrl = adType === 'adsense' ? '/google-adsense.html' : '/carbon-ad.html';
```

---

## ⚠️ Google AdSense 정책 및 주의사항

### 필수 정책 준수

1. **클릭 유도 금지**
   - 사용자에게 광고 클릭을 강요하지 않기
   - "광고를 클릭하세요" 같은 문구 사용 금지

2. **자동 클릭 금지**
   - 프로그램으로 광고를 자동 클릭하지 않기
   - 본인 또는 친구에게 클릭 요청 금지

3. **콘텐츠 정책**
   - 저작권 침해 콘텐츠 없기
   - 성인 콘텐츠, 폭력, 불법 콘텐츠 금지

4. **트래픽 정책**
   - 인위적인 트래픽 증가 금지
   - 봇 트래픽, 자동 새로고침 금지

### Electron 앱에서의 주의사항

1. **웹사이트 필수**
   - Electron 앱만으로는 AdSense 신청 불가
   - 반드시 공개 웹사이트가 있어야 함

2. **iframe 사용**
   - 현재 구현처럼 iframe을 통해 표시 가능
   - `sandbox="allow-scripts allow-same-origin"` 속성 필요

3. **외부 링크 처리**
   - 광고 클릭 시 외부 브라우저로 열기
   - Electron의 `shell.openExternal` 사용

---

## 📊 Carbon Ads vs Google AdSense 비교

| 항목 | Carbon Ads | Google AdSense |
|------|-----------|----------------|
| **승인 난이도** | 중간 (개발자 친화적) | 높음 (엄격한 정책) |
| **승인 기간** | 1-2주 | 1-4주 |
| **수익 잠재력** | 중간 | 높음 |
| **광고 품질** | 개발자 타겟, 깔끔 | 일반 광고, 다양함 |
| **웹사이트 필요** | 권장 | 필수 |
| **Electron 지원** | 우수 | 가능 (iframe) |
| **최소 트래픽** | 낮음 | 높음 (권장) |

---

## 🎯 권장 순서

### 옵션 1: Google AdSense 먼저 시도
1. Google AdSense 신청 (1-4주)
2. 승인되면 통합
3. 거부되면 Carbon Ads로 대체

### 옵션 2: Carbon Ads 먼저 시도 (권장)
1. Carbon Ads 신청 (1-2주, 승인 확률 높음)
2. 승인되면 통합
3. 나중에 Google AdSense도 추가 가능 (두 개 동시 사용 가능)

### 옵션 3: 둘 다 동시 신청
1. Carbon Ads와 Google AdSense 동시 신청
2. 먼저 승인된 것부터 통합
3. 둘 다 승인되면 선택적으로 사용

---

## ✅ 통합 체크리스트

- [ ] Google AdSense 계정 생성
- [ ] 웹사이트에 AdSense 코드 삽입 (GitHub Pages)
- [ ] 검수 제출
- [ ] 검수 승인 대기 (1-4주)
- [ ] 광고 단위 생성 (728x90 리더보드)
- [ ] `public/google-adsense.html` 파일 수정
- [ ] `src/components/AdBanner.tsx`에서 경로 변경
- [ ] 테스트: 광고가 표시되는지 확인
- [ ] 테스트: 광고 클릭이 정상 작동하는지 확인

---

## 🔗 유용한 링크

- **Google AdSense**: https://www.google.com/adsense/
- **AdSense 정책**: https://support.google.com/adsense/answer/48182
- **AdSense 도움말**: https://support.google.com/adsense/
- **GitHub Pages**: https://pages.github.com/

---

## 💡 팁

1. **웹사이트 콘텐츠 준비**
   - AdSense 검수 시 웹사이트 콘텐츠를 확인합니다
   - GitHub Pages에 충분한 콘텐츠(소개, 기능 설명 등)가 있어야 합니다

2. **개인정보 처리방침**
   - AdSense 사용 시 개인정보 처리방침에 광고 관련 내용 추가 권장
   - Google의 요구사항은 아니지만, 투명성을 위해 좋습니다

3. **트래픽 증가**
   - AdSense는 트래픽이 많을수록 승인 확률이 높습니다
   - 하지만 필수는 아닙니다

4. **인내심**
   - AdSense 검수는 시간이 걸립니다
   - 거부되면 이유를 확인하고 수정 후 재신청 가능합니다

