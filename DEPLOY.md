# RefBoard 웹사이트 GitHub Pages 배포 가이드

## 준비물
- GitHub 계정
- git 설치

## 배포 단계

### 1. GitHub에 새 저장소 만들기

1. https://github.com/new 접속
2. Repository name: `refboard-website` (또는 원하는 이름)
3. Public 선택
4. **"Add a README file"은 체크 해제**
5. Create repository 클릭

### 2. 로컬에서 Git 초기화 및 푸시

```bash
# website 폴더로 이동
cd d:/Scripts/RefBoard/website

# Git 초기화
git init

# 모든 파일 추가
git add .

# 커밋
git commit -m "Initial commit - RefBoard website"

# GitHub 저장소 연결 (본인의 username으로 변경)
git remote add origin https://github.com/YOUR_USERNAME/refboard-website.git

# 푸시
git branch -M main
git push -u origin main
```

### 3. GitHub Pages 활성화

1. GitHub 저장소 페이지로 이동
2. **Settings** 탭 클릭
3. 왼쪽 메뉴에서 **Pages** 클릭
4. Source: **Deploy from a branch** 선택
5. Branch: **main** 선택, 폴더: **/ (root)** 선택
6. **Save** 클릭

### 4. 배포 확인

5-10분 후, 다음 주소로 접속:
```
https://YOUR_USERNAME.github.io/refboard-website/
```

## OAuth 설정에 추가할 URL

배포 완료 후, Google Cloud Console OAuth 동의 화면에 다음 URL들을 추가하세요:

**앱 도메인**
- 홈페이지: `https://YOUR_USERNAME.github.io/refboard-website/`
- 개인정보처리방침: `https://YOUR_USERNAME.github.io/refboard-website/privacy.html`
- 서비스 약관: `https://YOUR_USERNAME.github.io/refboard-website/terms.html`

## 커스텀 도메인 (선택사항)

만약 본인 도메인이 있다면:

1. GitHub Pages 설정에서 Custom domain 입력
2. DNS 설정에서 CNAME 레코드 추가:
   ```
   www  CNAME  YOUR_USERNAME.github.io
   ```

## 업데이트 방법

파일 수정 후:
```bash
cd d:/Scripts/RefBoard/website
git add .
git commit -m "Update content"
git push
```

자동으로 재배포됩니다!

---

**완료!** 이제 RefBoard의 공식 홈페이지가 생겼습니다! 🎉
