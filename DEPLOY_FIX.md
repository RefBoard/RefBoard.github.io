# 배포 문제 해결 가이드

## 문제 상황
`D:\Scripts\RefBoard\refboard` 폴더에서 git 명령을 실행했지만, 이 폴더는 git 리포지토리가 아닙니다.

## 해결 방법

### 1단계: refboard-website 리포지토리 클론 또는 위치 확인

#### 옵션 A: 리포지토리를 클론해야 하는 경우

**CMD를 열고** 다음 명령 실행:

```bash
cd D:\Scripts
git clone https://github.com/trackk81/refboard-website.git
```

이렇게 하면 `D:\Scripts\refboard-website` 폴더가 생성됩니다.

#### 옵션 B: 리포지토리가 이미 다른 위치에 있는 경우

리포지토리가 있는 경로를 확인하세요. 예:
- `C:\Users\YourName\Documents\refboard-website`
- `D:\Projects\refboard-website`
- 다른 위치

---

### 2단계: 올바른 경로로 이동

리포지토리를 클론하거나 위치를 확인한 후:

```bash
# 예시: D:\Scripts\refboard-website로 이동
cd D:\Scripts\refboard-website

# 또는 실제 경로로 이동
cd [실제 경로]
```

---

### 3단계: 파일 복사 확인

리포지토리 폴더에 `refboard` 폴더가 있고, 그 안에 파일들이 있는지 확인:

```bash
# 리포지토리 폴더에서
dir refboard
```

파일이 없다면 다시 복사해야 합니다:

**Windows 탐색기 사용:**
1. `D:\Scripts\RefBoard\dist-web` 폴더 열기
2. 모든 파일 선택 (`Ctrl + A`)
3. 복사 (`Ctrl + C`)
4. `D:\Scripts\refboard-website` 폴더로 이동
5. `refboard` 폴더 만들기 (없는 경우)
6. `refboard` 폴더 안에 붙여넣기 (`Ctrl + V`)

**CMD 사용:**
```bash
# refboard 폴더 생성 (없는 경우)
mkdir D:\Scripts\refboard-website\refboard

# 파일 복사
xcopy /E /I /Y D:\Scripts\RefBoard\dist-web\* D:\Scripts\refboard-website\refboard\
```

---

### 4단계: Git 명령 실행

**올바른 리포지토리 폴더에서** 실행:

```bash
# 리포지토리 폴더로 이동
cd D:\Scripts\refboard-website

# 현재 위치 확인 (git 리포지토리인지 확인)
git status

# 파일 추가
git add refboard/

# 커밋
git commit -m "Deploy RefBoard app to /refboard folder"

# 푸시
git push origin main
```

---

## 체크리스트

- [ ] `refboard-website` 리포지토리가 로컬에 있는지 확인
- [ ] 없다면 `git clone https://github.com/trackk81/refboard-website.git` 실행
- [ ] 리포지토리 폴더로 이동 (`cd D:\Scripts\refboard-website`)
- [ ] `git status`로 git 리포지토리인지 확인
- [ ] `refboard` 폴더에 파일이 있는지 확인
- [ ] 없다면 `dist-web` 폴더의 내용을 복사
- [ ] `git add refboard/` 실행
- [ ] `git commit` 및 `git push` 실행

---

## 빠른 명령어 모음

```bash
# 1. 리포지토리 클론 (없는 경우)
cd D:\Scripts
git clone https://github.com/trackk81/refboard-website.git

# 2. 리포지토리로 이동
cd D:\Scripts\refboard-website

# 3. 파일 복사 (파일이 없는 경우)
mkdir refboard
xcopy /E /I /Y D:\Scripts\RefBoard\dist-web\* refboard\

# 4. Git 작업
git add refboard/
git commit -m "Deploy RefBoard app to /refboard folder"
git push origin main
```





