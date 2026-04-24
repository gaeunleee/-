# 텔레그램으로 Claude Code PC 원격 제어 - 설정 가이드

## 이게 뭐야?

핸드폰 텔레그램 앱에서 메시지를 보내면, 집에 있는 PC의 Claude(AI)가 그 지시를 받아서 실행해주는 시스템입니다.

예를 들어 밖에서 핸드폰으로 "Desktop에 보고서.txt 만들어줘" 라고 보내면, PC에서 실제로 파일이 만들어집니다.

---

## 전체 구조

```
[내 핸드폰 텔레그램] → [텔레그램 서버] → [PC의 봇 스크립트] → [Claude Code] → [PC 파일/작업 실행]
```

1. 핸드폰에서 텔레그램으로 메시지 전송
2. PC에서 실행 중인 봇 스크립트가 메시지를 받음
3. 메시지를 Claude Code CLI에 전달
4. Claude가 작업 실행 (파일 읽기/쓰기/수정 등)
5. 결과를 텔레그램으로 답장

---

## 구성 요소

### 1. 텔레그램 봇 (gaeun_claude_bot)
- BotFather에서 생성한 봇
- 봇 토큰: 텔레그램 서버와 통신하는 비밀 열쇠
- 허용된 사용자 ID만 사용 가능 (보안)

### 2. 봇 스크립트 (telegram-claude.js)
- 위치: `C:\Users\kkk\telegram-claude.js`
- Node.js로 작성된 프로그램
- 텔레그램 메시지를 받아서 Claude에 전달하고, 응답을 다시 텔레그램으로 전송

### 3. Claude Code CLI
- Anthropic에서 만든 AI 도구
- 파일 읽기/쓰기, 코드 실행 등 PC 작업 가능
- `--dangerously-skip-permissions` 옵션으로 허가 없이 작업 실행

### 4. Git Bash
- 위치: `C:\Program Files\Git\bin\bash.exe`
- 한국어 텍스트를 Claude에 올바르게 전달하기 위해 사용
- Windows CMD는 한국어 인코딩 문제가 있어서 Git Bash를 통해 우회

### 5. 자동시작 스크립트 (start-bot.vbs)
- 위치: `C:\Users\kkk\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\`
- PC 켤 때 봇이 자동으로 백그라운드에서 시작됨
- CMD 창 없이 조용히 실행

---

## 파일 목록

| 파일 | 위치 | 역할 |
|------|------|------|
| telegram-claude.js | C:\Users\kkk\ | 메인 봇 스크립트 |
| start-bot.vbs | 시작프로그램 폴더 | PC 켤 때 자동 실행 |

---

## 봇 스크립트 핵심 코드 설명

```javascript
// 텔레그램에서 메시지 받기
async function poll() { ... }

// Claude에게 메시지 전달하고 응답 받기
function runClaude(prompt) {
    // 1. 메시지를 임시 파일에 저장 (한국어 깨짐 방지)
    fs.writeFileSync(tmpFile, fullPrompt, 'utf8');
    
    // 2. Git Bash를 통해 Claude 실행
    exec(`bash.exe -c "claude --print --dangerously-skip-permissions < '파일경로'"`)
    
    // 3. 결과를 텔레그램으로 전송
}
```

---

## 사용 방법

### 기본 대화
텔레그램에서 그냥 말하면 됩니다.
```
안녕
오늘 날씨 어때?
파이썬 코드 짜줘
```

### 파일 작업
```
Desktop에 test.txt 파일 만들고 "안녕"이라고 써줘
Documents 폴더에 뭐가 있어?
C:\Users\kkk\test.txt 내용 보여줘
C:\Users\kkk\test.txt에서 "안녕"을 "반가워"로 바꿔줘
```

### 시스템 작업
```
현재 실행 중인 프로그램 알려줘
Downloads 폴더에서 가장 최근 파일 뭐야?
```

---

## 보안 설정

- `ALLOWED_CHAT_ID`: 본인 텔레그램 ID만 허용 (8727551535)
- 다른 사람이 봇에 메시지 보내도 무시됨

---

## 봇 수동 실행/종료 방법

**실행:**
```cmd
node C:\Users\kkk\telegram-claude.js
```

**종료:**
```cmd
taskkill /f /im node.exe
```

**자동시작 비활성화:**
- `C:\Users\kkk\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\` 폴더에서 `start-bot.vbs` 삭제

---

## 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| 봇이 응답 안 함 | node 꺼짐 | `node C:\Users\kkk\telegram-claude.js` 실행 |
| 답변이 이상함 | Claude API 문제 | PC에서 `claude` 명령어 직접 실행해서 확인 |
| 재시작 후 봇 안됨 | VBS 등록 문제 | 시작프로그램 폴더에 start-bot.vbs 있는지 확인 |

---

## 현재 한계

- PC가 켜져 있어야 사용 가능 (절전 모드 주의)
- 응답에 시간이 걸림 (Claude 처리 시간)
- PC와 인터넷 연결 필요

---

## 다음 예정 작업

- [ ] Google Drive MCP 연결 (드라이브 파일 원격 접근)
