# GitHub Releases 사용 가이드

## 📋 개요

GitHub Releases를 사용하면:
- ✅ 대용량 파일을 저장소에 직접 올리지 않아도 됩니다
- ✅ 버전 관리가 쉬워집니다
- ✅ 릴리즈 노트를 작성할 수 있습니다
- ✅ 다운로드 통계를 확인할 수 있습니다

---

## 🚀 GitHub Releases에 설치 파일 업로드하기

### 방법 1: GitHub 웹사이트 사용 (가장 쉬움) ⭐

1. **GitHub 리포지토리 접속**
   - `https://github.com/trackk81/refboard-website` 접속

2. **Releases 페이지로 이동**
   - 오른쪽 사이드바에서 **"Releases"** 클릭
   - 또는 URL 직접 접속: `https://github.com/trackk81/refboard-website/releases`

3. **새 릴리즈 생성**
   - **"Create a new release"** 또는 **"Draft a new release"** 버튼 클릭

4. **릴리즈 정보 입력**
   - **Tag version**: `v0.0.0` (또는 원하는 버전)
   - **Release title**: `RefBoard v0.0.0` (또는 원하는 제목)
   - **Description**: 릴리즈 노트 작성 (선택사항)
     ```
     ## RefBoard v0.0.0
     
     첫 번째 Windows 설치 파일 릴리즈입니다.
     
     ### 주요 기능
     - 무한 캔버스
     - PSD 파일 지원
     - 실시간 협업
     - Google Drive 통합
     ```

5. **파일 업로드**
   - **"Attach binaries by dropping them here or selecting them"** 영역에
   - `RefBoard Setup 0.0.0.exe` 파일을 드래그 앤 드롭
   - 또는 **"selecting them"** 클릭하여 파일 선택

6. **릴리즈 발행**
   - **"Publish release"** 버튼 클릭

7. **다운로드 URL 확인**
   - 릴리즈가 생성되면 파일 다운로드 URL이 생성됩니다
   - 예: `https://github.com/trackk81/refboard-website/releases/download/v0.0.0/RefBoard-Setup-0.0.0.exe`

---

## 🔗 홈페이지에서 Releases 링크 사용하기

### 옵션 1: 직접 다운로드 링크 사용

`website/index.html`을 수정:

```html
<a href="https://github.com/trackk81/refboard-website/releases/download/v0.0.0/RefBoard-Setup-0.0.0.exe" 
   class="cta-button" 
   download>Windows 설치 파일 다운로드</a>
```

### 옵션 2: Releases 페이지로 이동

```html
<a href="https://github.com/trackk81/refboard-website/releases" 
   class="cta-button" 
   target="_blank">Windows 설치 파일 다운로드</a>
```

---

## 📝 현재 상태 (선택사항)

현재 상태로도 작동하지만, 다음 중 하나를 선택할 수 있습니다:

### 옵션 A: 현재 상태 유지
- ✅ 이미 업로드되었고 작동합니다
- ⚠️ 경고만 표시될 뿐 문제 없습니다
- ⚠️ 저장소 크기가 커집니다

### 옵션 B: Releases로 이동 (권장)
- ✅ 저장소 크기 절약
- ✅ 버전 관리 용이
- ✅ 릴리즈 노트 작성 가능
- ⚠️ 홈페이지 링크 수정 필요

---

## 🛠️ Releases로 전환하는 방법

1. **GitHub Releases에 파일 업로드** (위 방법 참고)

2. **저장소에서 파일 삭제**
   ```bash
   cd D:\Scripts\refboard-website
   git rm downloads/RefBoard-Setup-0.0.0.exe
   git commit -m "Move installer to GitHub Releases"
   git push origin main
   ```

3. **홈페이지 링크 수정**
   - `website/index.html`의 다운로드 링크를 Releases URL로 변경

---

## 📊 비교

| 방법 | 장점 | 단점 |
|------|------|------|
| **저장소 직접 업로드** | 간단함, 바로 사용 가능 | 저장소 크기 증가, 경고 표시 |
| **GitHub Releases** | 저장소 크기 절약, 버전 관리 용이 | 설정 필요, 링크 수정 필요 |

---

## ✅ 권장 사항

**현재는 그대로 사용해도 됩니다!** 

다음 릴리즈부터 GitHub Releases를 사용하는 것을 권장합니다.



