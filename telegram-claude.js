const https = require('https');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TELEGRAM_TOKEN = '8521350924:AAEElry8SllGT93ILmmRFjrkeTzhUQzZP4Q';
const ALLOWED_CHAT_ID = 8727551535;

let offset = 0;

function telegramRequest(method, params) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(params);
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${TELEGRAM_TOKEN}/${method}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { resolve({}); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function runClaude(prompt) {
  return new Promise((resolve) => {
    // 프롬프트를 임시 파일에 저장해서 stdin으로 넘김
    const tmpFile = path.join(os.tmpdir(), 'claude_prompt_' + Date.now() + '.txt');
    fs.writeFileSync(tmpFile, prompt, 'utf8');

    let output = '';
    let finished = false;

    const proc = spawn(
      'cmd',
      ['/c', `type "${tmpFile}" | claude --print`],
      {
        env: { ...process.env, CLAUDE_CODE_GIT_BASH_PATH: 'C:\\Program Files\\Git\\bin\\bash.exe' },
        shell: false
      }
    );

    proc.stdout.on('data', d => { output += d.toString(); });
    proc.stderr.on('data', d => { output += d.toString(); });

    proc.on('close', (code) => {
      if (finished) return;
      finished = true;
      fs.unlink(tmpFile, () => {});
      console.log('claude 종료 코드:', code);
      console.log('출력 미리보기:', output.substring(0, 200));
      resolve(output.trim() || '(응답 없음)');
    });

    proc.on('error', (err) => {
      if (finished) return;
      finished = true;
      fs.unlink(tmpFile, () => {});
      console.error('프로세스 오류:', err.message);
      resolve('오류: ' + err.message);
    });

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      fs.unlink(tmpFile, () => {});
      proc.kill();
      resolve(output.trim() || '(시간 초과 - 3분)');
    }, 180000);

    proc.on('close', () => clearTimeout(timer));
  });
}

async function poll() {
  try {
    const result = await telegramRequest('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
    if (result.ok && result.result && result.result.length > 0) {
      for (const update of result.result) {
        offset = update.update_id + 1;
        const msg = update.message;
        if (!msg || !msg.text) continue;
        if (msg.chat.id !== ALLOWED_CHAT_ID) {
          console.log('허용되지 않은 chat_id:', msg.chat.id);
          continue;
        }
        if (msg.text.startsWith('/start')) {
          await telegramRequest('sendMessage', { chat_id: ALLOWED_CHAT_ID, text: '✅ Claude Code 봇 연결됨. 지시사항을 입력하세요.' });
          continue;
        }
        console.log('받은 메시지 [chat_id=' + msg.chat.id + ']:', msg.text);
        await telegramRequest('sendMessage', { chat_id: ALLOWED_CHAT_ID, text: '⏳ 처리 중...' });
        const response = await runClaude(msg.text);
        const maxLen = 4000;
        for (let i = 0; i < response.length; i += maxLen) {
          await telegramRequest('sendMessage', { chat_id: ALLOWED_CHAT_ID, text: response.slice(i, i + maxLen) });
        }
      }
    }
  } catch (err) {
    console.error('poll 오류:', err.message);
  }
  setTimeout(poll, 1000);
}

console.log('텔레그램 Claude Code 봇 시작됨');
console.log('허용 chat_id:', ALLOWED_CHAT_ID);
poll();
