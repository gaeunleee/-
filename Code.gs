/**
 * 카카오톡 카드 승인 문자 자동 파싱 - Google Apps Script
 * Supabase DB 연동 포함
 */

// ── Supabase 설정 ──────────────────────────────────────────────

const SUPABASE_URL = 'https://onojnsqzisheaevphplu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5jdCIAmhtgcKGFjs-msNWg_dERKcluP';

const TELEGRAM_TOKEN  = '8254217822:AAGIDEhnBzxDEJU0cuUp1haYpIHrMke2z98';
const TELEGRAM_API    = 'https://api.telegram.org/bot' + TELEGRAM_TOKEN;
const SPREADSHEET_ID  = '1HDhrERTUA8R6lTulXVLBltODbqwYYKETQ7Jd5r40WxU';
const MY_CHAT_ID      = 8727551535;

const BUDGET = { joint: 1100000, gaeun: 600000, incheon: 600000 };

const NEWLYWED_CAT_AVG = {
  joint:    { '외식': 500000, '생활비': 400000, '여가': 200000, '교통비': 100000, '의료비': 80000 },
  personal: { '외식': 200000, '여가': 100000, '교통비': 80000, '의료비': 50000 },
};

// ── 상수 ──────────────────────────────────────────────────────

const DATA_START_ROW = 2;

const JOINT_MERCHANTS = ['지엠마트', '정육점', '다이소', '신선지엠', '슈퍼', '청과'];
const PERSONAL_MERCHANTS = ['올리브영', '미용실', '헤어'];

const CATEGORY_KEYWORDS = {
  '교통비': ['버스', '지하철', '택시', 'KTX', 'SRT', '주유', '주차', '고속도로', '철도', '공항', '티머니', '교통', '환승'],
  '의료비': ['병원', '의원', '약국', '클리닉', '한의원', '치과', '안과', '피부과', '정형외과'],
  '여가':   ['영화', '카페', '커피빈', '스타벅스', '투썸', '할리스', 'CGV', '메가박스', '롯데시네마', '노래방', 'PC방', '볼링', '헬스', '피트니스', '당구'],
  '여행':   ['호텔', '숙박', '펜션', '항공', '여행사', '리조트', '모텔', '게스트하우스'],
  '생활비': ['마트', '세탁', '이마트', '홈플러스', '롯데마트', '쿠팡'],
};

// DB categories 테이블 기본 sub_name 매핑
const CATEGORY_SUB_MAP = {
  '교통비': '대중교통',
  '의료비': '병원',
  '여가':   '문화생활',
  '여행':   '숙박',
  '생활비': '마트',
  '외식':   '식당',
};

// DB cards 테이블 name과 일치하도록 맞춤
const CARD_PATTERNS = [
  { pattern: /롯데3.3./,               card: '인천 로카', owner: 'incheon' },
  { pattern: /롯데7.4./,               card: '가은 로카', owner: 'gaeun'   },
  { pattern: /LIKIT/i,                 card: '인천 로카', owner: 'incheon' },
  { pattern: /\b365\b/,                card: '가은 로카', owner: 'gaeun'   },
  { pattern: /삼성카드|삼성페이/,      card: '삼성카드',  owner: 'incheon' },
  { pattern: /국민카드|KB카드|KB국민/, card: '국민카드',  owner: 'incheon' },
];

const NON_MERCHANT_PATTERNS = [
  /Web발신/i,
  /카드\s*(승인|취소|결제)/,
  /승인번호/,
  /일시불|할부/,
  /취소/,
  /\d{1,2}\/\d{1,2}/,
  /\d{4}[.\-]\d{2}[.\-]\d{2}/,
  /\d{2}:\d{2}/,
  /[\d,]+\s*원/,
  /LIKIT/i,
  /\[.*\]/,
  /^\d{1,2}일\s*$/,
  /^[0-9\-\s]+$/,
  /롯데\d+\*/,
  /누적[\d,]+원/,
];

const DATE_FORMAT = 'm"월" d"일"';

// ── 텔레그램 웹훅 ─────────────────────────────────────────────

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    // iPhone 단축어에서 직접 보낸 경우
    if (body.sms_text) {
      var smsText = body.sms_text.trim().normalize('NFC');
      processSms(MY_CHAT_ID, smsText);
      return ContentService.createTextOutput('ok');
    }

    // 텔레그램 웹훅 형식
    var msg = body.message || body.channel_post;
    if (!msg || !msg.text) return ContentService.createTextOutput('ok');

    var chatId = msg.chat.id;
    var text   = msg.text.trim().normalize('NFC');
    processSms(chatId, text);

  } catch (err) {
    Logger.log('doPost 오류: ' + err.toString());
  }
  return ContentService.createTextOutput('ok');
}

function processSms(chatId, text) {
  var hasAmount   = text.indexOf('원') !== -1;
  var hasApproval = text.indexOf('승인') !== -1;
  var hasCancel   = text.indexOf('취소') !== -1;

  if (!hasAmount || (!hasApproval && !hasCancel)) {
    sendTelegramMessage(chatId, '내 채팅 ID: ' + chatId);
    return;
  }

  if (hasCancel && !hasApproval) {
    handleCancellation(chatId, text);
    return;
  }

  var parsed = parseCardMessage(text);
  if (!parsed) {
    sendTelegramMessage(chatId, '파싱 실패: 카드 승인 문자 형식을 확인해주세요.');
    return;
  }

  var classification = classifyExpense(parsed);
  var ownerLabel = classification.type === 'joint' ? '공동' : classification.owner === 'gaeun' ? '가은' : '인천';
  var reply = '✅ ' + parsed.merchant + ' ' + parsed.amount.toLocaleString() + '원\n'
            + ownerLabel + ' ' + classification.category + ' 기록 완료';
  sendTelegramMessage(chatId, reply);

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var monthSheet = getMonthSheet(ss, parsed.date);
    if (monthSheet) {
      if (!isDuplicate(monthSheet, parsed, classification)) {
        writeRecord(monthSheet, parsed, classification);
      } else {
        sendTelegramMessage(chatId, '⚠️ 중복 감지 — 이미 기록된 내역입니다.');
      }
    }
  } catch (sheetErr) {
    Logger.log('시트 오류: ' + sheetErr.toString());
  }
  saveToSupabase(parsed, classification);
}

function handleCancellation(chatId, text) {
  var parsed = parseCardMessage(text.replace(/취소/g, '승인'));
  if (!parsed) {
    sendTelegramMessage(chatId, '⚠️ 취소 문자 파싱 실패 — 수동 확인 필요');
    return;
  }
  var classification = classifyExpense(parsed);
  var deleted = deleteRecord(parsed, classification);
  if (deleted) {
    sendTelegramMessage(chatId, '🗑️ ' + parsed.merchant + ' ' + parsed.amount.toLocaleString() + '원 취소 처리 완료');
  } else {
    sendTelegramMessage(chatId, '⚠️ ' + parsed.merchant + ' ' + parsed.amount.toLocaleString() + '원 취소 — 기존 기록 없음, 수동 확인 필요');
  }
}

function isDuplicate(sheet, parsed, classification) {
  var lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return false;
  var numRows = lastRow - DATA_START_ROW + 1;
  var type = classification.type;
  var owner = classification.owner;
  var dateCol = (type === 'joint') ? 15 : (owner === 'incheon') ? 1 : 8;
  var data = sheet.getRange(DATA_START_ROW, dateCol, numRows, 2).getValues();
  var pd = parsed.date;
  for (var i = 0; i < data.length; i++) {
    var d = data[i][0];
    if (!d || !(d instanceof Date)) continue;
    if (d.getFullYear() === pd.getFullYear() &&
        d.getMonth()    === pd.getMonth()    &&
        d.getDate()     === pd.getDate()     &&
        data[i][1]      === parsed.amount) return true;
  }
  return false;
}

function deleteRecord(parsed, classification) {
  try {
    var ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = getMonthSheet(ss, parsed.date);
    var lastRow = sheet.getLastRow();
    if (lastRow < DATA_START_ROW) return false;
    var numRows = lastRow - DATA_START_ROW + 1;
    var type  = classification.type;
    var owner = classification.owner;
    var dateCol = (type === 'joint') ? 15 : (owner === 'incheon') ? 1 : 8;
    var startCol = dateCol;
    var data = sheet.getRange(DATA_START_ROW, dateCol, numRows, 2).getValues();
    var pd = parsed.date;
    for (var i = numRows - 1; i >= 0; i--) {
      var d = data[i][0];
      if (!d || !(d instanceof Date)) continue;
      if (d.getFullYear() === pd.getFullYear() &&
          d.getMonth()    === pd.getMonth()    &&
          d.getDate()     === pd.getDate()     &&
          data[i][1]      === parsed.amount) {
        sheet.getRange(DATA_START_ROW + i, startCol, 1, 6).clearContent();
        return true;
      }
    }
    return false;
  } catch (err) {
    Logger.log('deleteRecord 오류: ' + err.toString());
    return false;
  }
}

function sendTelegramMessage(chatId, text) {
  UrlFetchApp.fetch(TELEGRAM_API + '/sendMessage', {
    method:      'post',
    contentType: 'application/json',
    payload:     JSON.stringify({ chat_id: chatId, text: text }),
    muteHttpExceptions: true
  });
}

// ── 메인 트리거 ────────────────────────────────────────────────

function onEdit(e) {
  try {
    const sheet = e.source.getActiveSheet();
    if (sheet.getName() !== '입력') return;

    const range = e.range;
    if (range.getRow() !== 1 || range.getColumn() !== 1) return;

    const message = range.getValue().toString().trim();
    if (!message) return;

    const parsed = parseCardMessage(message);
    if (!parsed) {
      Logger.log('파싱 실패:\n' + message);
      SpreadsheetApp.getUi().alert('카드 승인 문자를 파싱하지 못했습니다.\n로그를 확인하세요.');
      return;
    }

    const classification = classifyExpense(parsed);
    const monthSheet = getMonthSheet(e.source, parsed.date);
    if (!monthSheet) return;

    writeRecord(monthSheet, parsed, classification);
    saveToSupabase(parsed, classification);

    range.setValue('');
    range.setNote('마지막 처리: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'));

  } catch (err) {
    Logger.log('오류: ' + err.toString());
  }
}

// ── 메시지 파싱 ────────────────────────────────────────────────

function parseCardMessage(msg) {
  const lines = msg.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });

  var card = '';
  var cardOwner = '';
  var date = null;
  var time = null;
  var amount = 0;
  var merchant = '';
  var usedIndices = {};

  // 1. 카드 식별
  for (var li = 0; li < lines.length; li++) {
    for (var ci = 0; ci < CARD_PATTERNS.length; ci++) {
      if (CARD_PATTERNS[ci].pattern.test(lines[li])) {
        card = CARD_PATTERNS[ci].card;
        cardOwner = CARD_PATTERNS[ci].owner;
        break;
      }
    }
    if (card) break;
  }

  // 2. 날짜 & 시간 추출
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var m;

    m = line.match(/(\d{1,2})\/(\d{1,2})(?:\([가-힣일월화수목금토]\))?\s+(\d{2}):(\d{2})/);
    if (m) {
      date = makeDate(null, parseInt(m[1]), parseInt(m[2]));
      time = { hour: parseInt(m[3]), min: parseInt(m[4]) };
      usedIndices[i] = true;
      break;
    }

    m = line.match(/(\d{4})[.\-](\d{2})[.\-](\d{2})\s+(\d{2}):(\d{2})/);
    if (m) {
      date = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
      time = { hour: parseInt(m[4]), min: parseInt(m[5]) };
      usedIndices[i] = true;
      break;
    }

    m = line.match(/^(\d{1,2})일\s+(\d{2}):(\d{2})$/);
    if (m) {
      var now = new Date();
      date = new Date(now.getFullYear(), now.getMonth(), parseInt(m[1]));
      time = { hour: parseInt(m[2]), min: parseInt(m[3]) };
      usedIndices[i] = true;
      break;
    }

    m = line.match(/^(\d{1,2})\/(\d{1,2})(?:\([가-힣일월화수목금토]\))?$/);
    if (m && i + 1 < lines.length) {
      var tm = lines[i + 1].match(/^(\d{2}):(\d{2})/);
      if (tm) {
        date = makeDate(null, parseInt(m[1]), parseInt(m[2]));
        time = { hour: parseInt(tm[1]), min: parseInt(tm[2]) };
        usedIndices[i] = true;
        usedIndices[i + 1] = true;
        break;
      }
    }

    m = line.match(/(\d{1,2})일(\d{2}):(\d{2})/);
    if (m) {
      var now2 = new Date();
      date = new Date(now2.getFullYear(), now2.getMonth(), parseInt(m[1]));
      time = { hour: parseInt(m[2]), min: parseInt(m[3]) };
      usedIndices[i] = true;
      break;
    }
  }

  // 3. 금액 추출
  for (var j = 0; j < lines.length; j++) {
    var am = lines[j].match(/([\d,]+)\s*원/);
    if (am) {
      amount = parseInt(am[1].replace(/,/g, ''));
      usedIndices[j] = true;
      break;
    }
  }

  // 4. 가맹점 추출
  for (var k = 0; k < lines.length; k++) {
    if (usedIndices[k]) continue;
    var ln = lines[k];
    var skip = false;
    for (var pi = 0; pi < NON_MERCHANT_PATTERNS.length; pi++) {
      if (NON_MERCHANT_PATTERNS[pi].test(ln)) { skip = true; break; }
    }
    if (skip || ln.length < 2) continue;

    var name = ln.replace(/^가맹점명?\s*[:：]\s*/, '').trim();
    merchant = cleanMerchantName(name);
    break;
  }

  // 단일 줄 SMS 형식 fallback: [Web발신] 가맹점 금액원 승인 ...
  if (!merchant) {
    var fm = msg.match(/\[Web발신\]\s+(.+?)\s+[\d,]+원/);
    if (fm) {
      var cand = fm[1].trim();
      if (cand.length >= 2) merchant = cleanMerchantName(cand);
    }
  }

  if (!date || !merchant || amount <= 0) {
    Logger.log('불완전 파싱 - date:' + date + ', merchant:"' + merchant + '", amount:' + amount);
    return null;
  }

  return { date: date, time: time, amount: amount, merchant: merchant, card: card, cardOwner: cardOwner };
}

function makeDate(year, month, day) {
  var y = year || new Date().getFullYear();
  return new Date(y, month - 1, day);
}

function cleanMerchantName(name) {
  return name
    .replace(/\s*\d+호점$/, '')
    .replace(/\s*\d+점$/, '')
    .replace(/\s*점\d+호$/, '')
    .replace(/\s*점$/, '')
    .replace(/\s+[가-힣]+$/, '')
    .trim();
}

// ── 지출 분류 ──────────────────────────────────────────────────

function classifyExpense(parsed) {
  var date      = parsed.date;
  var time      = parsed.time;
  var merchant  = parsed.merchant;
  var card      = parsed.card;
  var cardOwner = parsed.cardOwner;

  for (var ji = 0; ji < JOINT_MERCHANTS.length; ji++) {
    if (merchant.indexOf(JOINT_MERCHANTS[ji]) !== -1) {
      return { type: 'joint', category: '생활비', payMethod: card };
    }
  }

  for (var pi = 0; pi < PERSONAL_MERCHANTS.length; pi++) {
    if (merchant.indexOf(PERSONAL_MERCHANTS[pi]) !== -1) {
      return { type: 'personal', category: determineCategory(merchant), owner: cardOwner };
    }
  }

  var dow = date.getDay();
  if (dow === 0 || dow === 6) {
    return { type: 'joint', category: determineCategory(merchant), payMethod: card };
  }

  if (time) {
    var totalMin = time.hour * 60 + time.min;
    if (totalMin >= 8 * 60 && totalMin < 19 * 60) {
      return { type: 'personal', category: determineCategory(merchant), owner: cardOwner };
    }
  }

  return { type: 'joint', category: determineCategory(merchant), payMethod: card };
}

function determineCategory(merchant) {
  var cats = Object.keys(CATEGORY_KEYWORDS);
  for (var ci = 0; ci < cats.length; ci++) {
    var cat = cats[ci];
    var keywords = CATEGORY_KEYWORDS[cat];
    for (var ki = 0; ki < keywords.length; ki++) {
      if (merchant.indexOf(keywords[ki]) !== -1) return cat;
    }
  }
  return '외식';
}

// ── 시트 조회 ──────────────────────────────────────────────────

function getMonthSheet(ss, date) {
  var name = (date.getMonth() + 1) + '월';
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    Logger.log('"' + name + '" 시트 없음 - 자동 생성');
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

// ── 시트 기록 ──────────────────────────────────────────────────

function writeRecord(sheet, parsed, classification) {
  var date      = parsed.date;
  var amount    = parsed.amount;
  var merchant  = parsed.merchant;
  var card      = parsed.card;
  var type      = classification.type;
  var category  = classification.category;
  var payMethod = classification.payMethod;
  var owner     = classification.owner;

  if (type === 'joint') {
    var row = getNextEmptyRow(sheet, 15);
    sheet.getRange(row, 15).setValue(date).setNumberFormat(DATE_FORMAT);
    sheet.getRange(row, 16).setValue(amount);
    sheet.getRange(row, 17).setValue(category);
    sheet.getRange(row, 18).setValue(merchant);
    sheet.getRange(row, 20).setValue(payMethod || card);

  } else if (owner === 'incheon') {
    var row = getNextEmptyRow(sheet, 1);
    sheet.getRange(row, 1).setValue(date).setNumberFormat(DATE_FORMAT);
    sheet.getRange(row, 2).setValue(amount);
    sheet.getRange(row, 3).setValue(category);
    sheet.getRange(row, 4).setValue(merchant);
    sheet.getRange(row, 6).setValue(card);

  } else if (owner === 'gaeun') {
    var row = getNextEmptyRow(sheet, 8);
    sheet.getRange(row, 8).setValue(date).setNumberFormat(DATE_FORMAT);
    sheet.getRange(row, 9).setValue(amount);
    sheet.getRange(row, 10).setValue(category);
    sheet.getRange(row, 11).setValue(merchant);
    sheet.getRange(row, 13).setValue(card);
  }
}

function getNextEmptyRow(sheet, col) {
  var lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return DATA_START_ROW;

  var values = sheet.getRange(DATA_START_ROW, col, lastRow - DATA_START_ROW + 1).getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    if (values[i][0] !== '' && values[i][0] !== null) {
      return DATA_START_ROW + i + 1;
    }
  }
  return DATA_START_ROW;
}

// ── Supabase 저장 ──────────────────────────────────────────────

function saveToSupabase(parsed, classification) {
  try {
    var categoryId = getCategoryId(classification.category);
    var cardId     = getCardId(parsed.card);
    var owner      = classification.type === 'joint' ? 'shared' : classification.owner;
    var dateStr    = Utilities.formatDate(parsed.date, Session.getScriptTimeZone(), 'yyyy-MM-dd');

    var record = {
      type:             'expense',
      owner:            owner,
      amount:           parsed.amount,
      category_id:      categoryId,
      merchant:         parsed.merchant,
      card_id:          cardId,
      transaction_date: dateStr,
      is_auto_parsed:   true
    };

    var response = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/transactions', {
      method:      'post',
      contentType: 'application/json',
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer':        'return=minimal'
      },
      payload:           JSON.stringify(record),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() >= 400) {
      Logger.log('Supabase 저장 실패: ' + response.getContentText());
    } else {
      Logger.log('Supabase 저장 완료: ' + parsed.merchant + ' ' + parsed.amount + '원');
    }
  } catch (err) {
    Logger.log('Supabase 오류: ' + err.toString());
  }
}

function getCategoryId(categoryName) {
  var subName  = CATEGORY_SUB_MAP[categoryName] || '식당';
  var url      = SUPABASE_URL + '/rest/v1/categories'
               + '?name=eq.'     + encodeURIComponent(categoryName)
               + '&sub_name=eq.' + encodeURIComponent(subName)
               + '&select=id&limit=1';

  var response = UrlFetchApp.fetch(url, {
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY
    },
    muteHttpExceptions: true
  });

  var data = JSON.parse(response.getContentText());
  return data.length > 0 ? data[0].id : null;
}

function getCardId(cardName) {
  if (!cardName) return null;
  var url = SUPABASE_URL + '/rest/v1/cards'
          + '?name=eq.' + encodeURIComponent(cardName)
          + '&select=id&limit=1';

  var response = UrlFetchApp.fetch(url, {
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY
    },
    muteHttpExceptions: true
  });

  var data = JSON.parse(response.getContentText());
  return data.length > 0 ? data[0].id : null;
}

// ── 월말 리포트 ────────────────────────────────────────────────

function setupMonthlyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'checkAndSendMonthlyReport') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('checkAndSendMonthlyReport')
    .timeBased()
    .everyDays(1)
    .atHour(22)
    .create();
  Logger.log('월말 리포트 트리거 설정 완료 (매일 22시 실행)');
}

function checkAndSendMonthlyReport() {
  var today = new Date();
  var tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (tomorrow.getDate() !== 1) return;
  sendMonthlyReport(today);
}

function sendMonthlyReport(date) {
  var monthNum  = date.getMonth() + 1;
  var monthName = monthNum + '월';

  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(monthName);
    if (!sheet) { sendTelegramMessage(MY_CHAT_ID, monthName + ' 데이터가 없습니다.'); return; }

    var lastRow = sheet.getLastRow();
    if (lastRow < DATA_START_ROW) { sendTelegramMessage(MY_CHAT_ID, monthName + ' 기록 없음'); return; }

    var numRows = lastRow - DATA_START_ROW + 1;
    var allData = sheet.getRange(DATA_START_ROW, 1, numRows, 20).getValues();

    var incheonTotal = 0, gaeunTotal = 0, jointTotal = 0;
    var incheonCats = {}, gaeunCats = {}, jointCats = {};

    for (var i = 0; i < allData.length; i++) {
      var row = allData[i];
      if (row[0] !== '' && row[1] > 0) {
        incheonTotal += row[1];
        var ic = row[2] || '기타';
        incheonCats[ic] = (incheonCats[ic] || 0) + row[1];
      }
      if (row[7] !== '' && row[8] > 0) {
        gaeunTotal += row[8];
        var gc = row[9] || '기타';
        gaeunCats[gc] = (gaeunCats[gc] || 0) + row[8];
      }
      if (row[14] !== '' && row[15] > 0) {
        jointTotal += row[15];
        var jc = row[16] || '기타';
        jointCats[jc] = (jointCats[jc] || 0) + row[15];
      }
    }

    var total = incheonTotal + gaeunTotal + jointTotal;

    var r = '📊 ' + monthName + ' 가계부 결산\n';
    r += '━━━━━━━━━━━━━━\n\n';

    // 예산 대비
    r += '💰 예산 대비 지출\n';
    r += budgetLine('🏠 공동', jointTotal,   BUDGET.joint);
    r += budgetLine('👩 가은', gaeunTotal,   BUDGET.gaeun);
    r += budgetLine('👨 인천', incheonTotal, BUDGET.incheon);
    r += '합계 ' + total.toLocaleString() + '원\n\n';

    // 카테고리 상세
    r += '━━━━━━━━━━━━━━\n';
    r += '📋 카테고리별 상세\n\n';
    r += catDetail('🏠 공동', jointCats,   NEWLYWED_CAT_AVG.joint);
    r += catDetail('👩 가은', gaeunCats,   NEWLYWED_CAT_AVG.personal);
    r += catDetail('👨 인천', incheonCats, NEWLYWED_CAT_AVG.personal);

    // 절약 포인트
    var tips = makeTips(jointTotal, gaeunTotal, incheonTotal, jointCats, gaeunCats, incheonCats);
    if (tips) {
      r += '━━━━━━━━━━━━━━\n';
      r += '💡 이달의 절약 포인트\n' + tips;
    }

    sendTelegramMessage(MY_CHAT_ID, r);
  } catch (err) {
    Logger.log('월간 리포트 오류: ' + err.toString());
  }
}

function budgetLine(label, actual, budget) {
  var diff = budget - actual;
  var pct  = Math.round(Math.abs(diff) / budget * 100);
  var mark = diff >= 0 ? '✅' : '⚠️';
  var desc = diff >= 0
    ? actual.toLocaleString() + '원 / ' + budget.toLocaleString() + '원 (' + pct + '% 절약) ' + mark
    : actual.toLocaleString() + '원 / ' + budget.toLocaleString() + '원 (' + pct + '% 초과) ' + mark;
  return label + ' ' + desc + '\n';
}

function catDetail(label, cats, avg) {
  var sorted = sortByValue(cats);
  if (sorted.length === 0) return '';
  var s = label + '\n';
  for (var i = 0; i < Math.min(sorted.length, 5); i++) {
    var cat = sorted[i][0];
    var amt = sorted[i][1];
    var ref = avg[cat];
    var mark = '';
    if (ref && amt > ref) mark = ' ⚠️ 평균 초과';
    s += '  • ' + cat + ' ' + amt.toLocaleString() + '원' + mark + '\n';
  }
  return s + '\n';
}

function makeTips(jt, gt, it, jCats, gCats, iCats) {
  var tips = '';
  if (jt > BUDGET.joint)   tips += '• 공동 지출 예산 ' + (jt - BUDGET.joint).toLocaleString() + '원 초과\n';
  if (gt > BUDGET.gaeun)   tips += '• 가은 개인 예산 ' + (gt - BUDGET.gaeun).toLocaleString() + '원 초과\n';
  if (it > BUDGET.incheon) tips += '• 인천 개인 예산 ' + (it - BUDGET.incheon).toLocaleString() + '원 초과\n';

  // 카테고리별 신혼 평균 초과 체크
  function checkCats(cats, avg, who) {
    for (var cat in cats) {
      if (avg[cat] && cats[cat] > avg[cat] * 1.3) {
        tips += '• ' + who + ' ' + cat + '비 신혼 평균 대비 '
              + Math.round(cats[cat] / avg[cat] * 100 - 100) + '% 많음\n';
      }
    }
  }
  checkCats(jCats, NEWLYWED_CAT_AVG.joint,    '공동');
  checkCats(gCats, NEWLYWED_CAT_AVG.personal, '가은');
  checkCats(iCats, NEWLYWED_CAT_AVG.personal, '인천');

  // 외식 합산 체크
  var totalEat = (jCats['외식'] || 0) + (gCats['외식'] || 0) + (iCats['외식'] || 0);
  if (totalEat > 900000) {
    tips += '• 외식 합산 ' + totalEat.toLocaleString() + '원 — 신혼부부 평균 외식비(70만원) 초과\n';
  }

  if (!tips) tips = '• 이달은 예산 내에서 잘 관리했습니다 👍\n';
  return tips;
}

function sortByValue(obj) {
  var arr = [];
  for (var key in obj) arr.push([key, obj[key]]);
  arr.sort(function(a, b) { return b[1] - a[1]; });
  return arr;
}

// ── 수동 테스트 함수 ───────────────────────────────────────────

function testParse() {
  var testCases = [
    {
      label: '인천 로카 / 주말 / 지엠마트 (→ 공동 생활비)',
      msg: '[Web발신]\n롯데카드(LIKIT)\n04/19(토) 14:30\n지엠마트연수점\n45,000원 승인\n일시불'
    },
    {
      label: '가은 로카 / 평일 업무시간 / 버스 (→ 가은 개인 교통비)',
      msg: '[Web발신]\n롯데카드(365)\n04/18(금) 09:15\n버스요금\n1,300원 승인'
    },
    {
      label: '인천 로카 / 평일 업무시간 / 스타벅스 (→ 인천 개인 여가)',
      msg: '[Web발신]롯데카드(LIKIT)\n04/17(목) 12:00\n스타벅스코리아\n6,500원 승인\n일시불'
    },
    {
      label: '인천 로카 / 평일 저녁 / 식당 (→ 공동 외식)',
      msg: '[Web발신]\n롯데카드(LIKIT)\n04/17(목) 19:30\n홍콩반점0410\n28,000원 승인\n일시불'
    },
    {
      label: '인천 로카 / 올리브영 (→ 인천 개인)',
      msg: '[Web발신]\n롯데카드(LIKIT)\n04/16(수) 15:00\n올리브영인천점\n32,500원 승인'
    },
  ];

  var dow = ['일', '월', '화', '수', '목', '금', '토'];

  for (var i = 0; i < testCases.length; i++) {
    var tc = testCases[i];
    Logger.log('══ 테스트 ' + (i + 1) + ': ' + tc.label);
    var parsed = parseCardMessage(tc.msg);
    if (!parsed) {
      Logger.log('  ❌ 파싱 실패');
      continue;
    }
    var cl = classifyExpense(parsed);
    Logger.log('  가맹점  : ' + parsed.merchant);
    Logger.log('  금액    : ' + parsed.amount.toLocaleString() + '원');
    Logger.log('  날짜    : ' + (parsed.date.getMonth() + 1) + '월 ' + parsed.date.getDate() + '일 (' + dow[parsed.date.getDay()] + ')');
    Logger.log('  시간    : ' + (parsed.time ? parsed.time.hour + ':' + String(parsed.time.min).padStart(2, '0') : '미상'));
    Logger.log('  카드    : ' + parsed.card + ' (' + parsed.cardOwner + ')');
    Logger.log('  분류    : ' + (cl.type === 'joint' ? '공동' : '개인') + ' / ' + cl.category);
    if (cl.type === 'joint') {
      Logger.log('  지불방법: ' + cl.payMethod);
    } else {
      Logger.log('  소유자  : ' + cl.owner);
    }
    Logger.log('');
  }
}
