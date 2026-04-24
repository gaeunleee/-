const https = require('https');
const { spawn } = require('child_process');

const TELEGRAM_TOKEN = '8254217822:AAGIDEhnBzxDEJU0cuUp1haYpIHrMke2z98';
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
    const env = { ...process.env, CLAUDE_CODE_GIT_BASH_PATH: 'C:\\Program Files\\Git\\bin\\bash.exe' };
    let output = '';
    const proc = spawn('claude', ['--print', prompt], { env, shell: true });
    proc.stdout.on('data', d => output += d.toString());
    proc.stderr.on('data', d => output += d.toString());
    proc.on('close', () => resolve(output.trim() || '(응답 없음)'));
    proc.on('error', err => resolve('오류: ' + err.message));
    setTimeout(() => { proc.kill(); resolve(output.trim() || '(시간 초과)'); }, 180000);
  });
}

async function poll() {
  try {
    const result = await telegramRequest('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
    if (result.ok && result.result && result.result.length > 0) {
      for (const update of result.result) {
        offset = update.update_id + 1;
        const msg = update.message;
        if (!msg || !msg.text || msg.chat.id !== ALLOWED_CHAT_ID) continue;
        if (msg.text.startsWith('/start')) {
          await telegramRequest('sendMessage', { chat_id: ALLOWED_CHAT_ID, text: '✅ Claude Code 봇 연결됨. 지시사항을 입력하세요.' });
          continue;
        }
        console.log('받은 메시지:', msg.text);
        await telegramRequest('sendMessage', { chat_id: ALLOWED_CHAT_ID, text: '⏳ 처리 중...' });
        const response = await runClaude(msg.text);
        const maxLen = 4000;
        for (let i = 0; i < response.length; i += maxLen) {
          await telegramRequest('sendMessage', { chat_id: ALLOWED_CHAT_ID, text: response.slice(i, i + maxLen) });
        }
      }
    }
  } catch (err) {
    console.error('오류:', err.message);
  }
  setTimeout(poll, 1000);
}

console.log('텔레그램 Claude Code 봇 시작됨');
poll();
