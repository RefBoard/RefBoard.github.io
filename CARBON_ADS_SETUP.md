# Carbon Ads 통합 가이드

## 📝 현재 상태
- ✅ `public/carbon-ad.html` 파일 생성 완료
- ✅ `AdBanner` 컴포넌트에서 iframe으로 로드
- ⏳ Carbon Ads 승인 대기 중

## 🚀 Carbon Ads 신청 방법

### 1. 웹사이트 방문
https://www.carbonads.net/

### 2. 신청서 작성
**Publishers 섹션**에서 신청:
- **Website URL**: GitHub 페이지 또는 `https://refboard-21681.web.app`
- **Monthly Visitors**: 예상 방문자 수 (최소 50,000 권장, 하지만 더 적어도 신청 가능)
- **Category**: Development Tools, Design Tools
- **Description**: 
  ```
  RefBoard is a visual reference board application for designers and developers.
  It allows users to collect, organize, and reference visual materials while working.
  Target audience: UI/UX designers, developers, digital artists.
  ```

### 3. 승인 대기
- 승인 기간: 보통 1-2주
- Carbon Ads 팀에서 트래픽과 콘텐츠 검토

## 🔧 승인 후 통합 방법

### Carbon Ads 코드를 받으면:

1. **`public/carbon-ad.html` 파일 열기**

2. **43-46번 줄의 주석 해제 및 수정**:
```html
<!-- 이 부분을 -->
<!-- 
<script async type="text/javascript" 
        src="//cdn.carbonads.com/carbon.js?serve=YOUR_ZONE_ID&placement=refboard" 
        id="_carbonads_js">
</script>
-->

<!-- 아래와 같이 변경 (YOUR_ZONE_ID를 실제 값으로) -->
<script async type="text/javascript" 
        src="//cdn.carbonads.com/carbon.js?serve=CE7DT2QY&placement=refboard" 
        id="_carbonads_js">
</script>
```

3. **50-60번 줄의 플레이스홀더 제거 (선택사항)**:
```html
<!-- 이 부분 삭제 -->
<div class="ad-placeholder" id="placeholder">
    ...
</div>
```

## 📊 대안: 다른 광고 네트워크

Carbon Ads가 승인되지 않을 경우:

### 1. **CodeFund** (개발자 친화적)
- https://codefund.io/
- 오픈소스 광고 플랫폼
- 낮은 승인 기준

### 2. **BuySellAds**
- https://www.buysellads.com/
- 직접 광고주 연결
- 더 유연한 조건

### 3. **제휴 마케팅**
- Amazon Associates
- Wacom 제휴 프로그램
- Adobe Creative Cloud 제휴

## 🧪 현재 테스트

현재 상태:
- 플레이스홀더가 표시됨
- 30초마다 휴식 메시지와 함께 배너 나타남
- Carbon Ads 승인 시 자동으로 실제 광고로 전환
