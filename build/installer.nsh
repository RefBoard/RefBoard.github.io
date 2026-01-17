; RefBoard 파일 연결 및 아이콘 설정

; 설치 시 실행되는 매크로
!macro customInstall
  ; .refboard 파일 확장자 등록
  WriteRegStr HKCR ".refboard" "" "RefBoard.File"
  WriteRegStr HKCR "RefBoard.File" "" "RefBoard Board File"
  ; 아이콘 설정 (EXE 파일의 첫 번째 아이콘 리소스 사용)
  WriteRegStr HKCR "RefBoard.File\DefaultIcon" "" "$INSTDIR\RefBoard.exe,0"
  ; 파일 열기 명령 설정
  WriteRegStr HKCR "RefBoard.File\shell\open\command" "" '"$INSTDIR\RefBoard.exe" "%1"'
  
  ; Windows 탐색기 새로고침 (아이콘 즉시 반영)
  System::Call 'shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend

; 제거 시 실행되는 매크로
!macro customUninstall
  ; 파일 확장자 제거
  DeleteRegKey HKCR ".refboard"
  DeleteRegKey HKCR "RefBoard.File"
  
  ; Windows 탐색기 새로고침
  System::Call 'shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend
