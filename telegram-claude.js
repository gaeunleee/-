const https = require('https');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

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
    const tmpFile = path.join(os.tmpdir(), `claude_${Date.now()}.txt`);
    const fullPrompt = '항상 존댓말로 답변해주세요. Never use markdown symbols like **, *, #, ` in your response. Plain text only.\n\n' + prompt;
    fs.writeFileSync(tmpFile, fullPrompt, 'utf8');

    const bashPath = tmpFile.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (m, d) => `/${d.toLowerCase()}`);
    const env = { ...process.env, NO_COLOR: '1', CLAUDE_CODE_GIT_BASH_PATH: 'C:\\Program Files\\Git\\bin\\bash.exe' };
    const cmd = `"C:\\Program Files\\Git\\bin\\bash.exe" -c "claude --print --dangerously-skip-permissions < '${bashPath}'"`;

    exec(cmd, { env, encoding: 'utf8', timeout: 180000, maxBuffer: 10 * 1024 * 1024, cwd: 'C:\\Users\\kkk' }, (error, stdout) => {
      try { fs.unlinkSync(tmpFile); } catch(e) {}
      resolve((stdout || '').trim() || '(no response)');
    });
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
          await telegramRequest('sendMessage', { chat_id: ALLOWED_CHAT_ID, text: 'Claude Code bot connected.' });
          continue;
        }

        const response = await runClaude(msg.text);
        for (let i = 0; i < response.length; i += 4000) {
          await telegramRequest('sendMessage', { chat_id: ALLOWED_CHAT_ID, text: response.slice(i, i + 4000) });
        }
      }
    }
  } catch (err) {
    console.error('error:', err.message);
  }
  setTimeout(poll, 1000);
}

console.log('bot started');
poll();
