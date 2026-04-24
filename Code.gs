/**
 * 카카오톡 카드 승인 문자 자동 파싱 - Google Apps Script
 *
 * 사용법: "입력" 시트 A1에 카카오톡 카드 승인 문자를 붙여넣으면
 *        해당 월 시트의 올바른 섹션에 자동으로 기입됩니다.
 *
 * 시트 구조 (월별 시트):
 *   인천 지출: A(날짜) B(금액) C(카테고리) D(가맹점) F(카드)
 *   가은 지출: H(날짜) I(금액) J(카테고리) K(가맹점) M(카드)
 *   공동 지출: O(날짜) P(금액) Q(카테고리) R(가맹점) T(지불방법)
 */

// ── 상수 ──────────────────────────────────────────────────────

/** 데이터 시작 행 (1행 헤더인 경우 2, 헤더 없으면 1) */
var DATA_START_ROW = 2;

var JOINT_MERCHANTS   = ['지엠마트', '정육점', '다이소', '신선지엠'];
var PERSONAL_MERCHANTS = ['올리브영', '미용실', '헤어'];

var CATEGORY_KEYWORDS = {
  '교통비': ['버스', '지하철', '택시', 'KTX', 'SRT', '주유', '주차', '고속도로', '철도', '공항', '티머니', '교통', '환승'],
  '의료비': ['병원', '의원', '약국', '클리닉', '한의원', '치과', '안과', '피부과', '정형외과'],
  '여가':   ['영화', '카페', '커피빈', '스타벅스', '투썸', '할리스', 'CGV', '메가박스', '롯데시네마', '노래방', 'PC방', '볼링', '헬스', '피트니스', '당구'],
  '여행':   ['호텔', '숙박', '펜션', '항공', '여행사', '리조트', '모텔', '게스트하우스'],
  '생활비': ['마트', '편의점', 'GS25', 'CU', '세븐일레븐', '이마트24', '세탁', '이마트', '홈플러스', '롯데마트', '쿠팡', '배달의민족', '요기요'],
};

var CARD_PATTERNS = [
  { pattern: /LIKIT/i,                    card: '인천 로카', owner: 'incheon' },
  { pattern: /\b365\b/,                   card: '가은 로카', owner: 'gaeun'   },
  { pattern: /삼성카드|삼성페이/,         card: '인천 삼성', owner: 'incheon' },
  { pattern: /국민카드|KB카드|KB국민/,    card: '인천 국민', owner: 'incheon' },
];

var NON_MERCHANT_PATTERNS = [
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
];

var DATE_FORMAT = 'm"월" d"일"';

// ── 스프레드시트 열릴 때 커스텀 메뉴 등록 ─────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('💳 가계부')
    .addItem('A1 문자 지금 처리', 'manualProcess')
    .addItem('테스트 실행 (로그 확인)', 'testParse')
    .addToUi();
}

// ── onEdit 트리거 ──────────────────────────────────────────────
// ※ 주의: 단순 onEdit 트리거는 getUi().alert() 사용 불가
//          에러/결과는 "입력" 시트 B1에 표시합니다.

function onEdit(e) {
  try {
    var sheet = e.source.getActiveSheet();
    if (sheet.getName() !== '입력') return;

    var range = e.range;
    if (range.getRow() !== 1 || range.getColumn() !== 1) return;

    var message = range.getValue().toString().trim();
    if (!message) return;

    processMessage_(message, e.source, sheet);

  } catch (err) {
    // 에러를 B1에 기록 (getUi 사용 불가이므로 셀에 표시)
    try {
      var inputSheet = e.source.getSheetByName('입력');
      if (inputSheet) {
        inputSheet.getRange(1, 2).setValue('❌ 오류: ' + err.toString());
      }
    } catch (e2) { /* 최후 방어 */ }
    Logger.log('onEdit 오류: ' + err.toString());
  }
}

// ── 메뉴에서 수동 실행 ─────────────────────────────────────────

function manualProcess() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var inputSheet = ss.getSheetByName('입력');
  if (!inputSheet) {
    SpreadsheetApp.getUi().alert('"입력" 시트를 찾을 수 없습니다.');
    return;
  }

  var message = inputSheet.getRange(1, 1).getValue().toString().trim();
  if (!message) {
    SpreadsheetApp.getUi().alert('A1이 비어있습니다. 카드 승인 문자를 붙여넣으세요.');
    return;
  }

  processMessage_(message, ss, inputSheet);
}

// ── 공통 처리 로직 ─────────────────────────────────────────────

function processMessage_(message, ss, inputSheet) {
  var statusCell = inputSheet.getRange(1, 2); // B1에 상태 표시

  var parsed = parseCardMessage(message);
  if (!parsed) {
    statusCell.setValue('❌ 파싱 실패 - 문자 형식을 확인하세요');
    Logger.log('파싱 실패:\n' + message);
    return;
  }

  var classification = classifyExpense(parsed);
  var monthSheet = getMonthSheet(ss, parsed.date);
  if (!monthSheet) {
    var monthName = (parsed.date.getMonth() + 1) + '월';
    statusCell.setValue('❌ "' + monthName + '" 시트 없음 - 시트를 먼저 만드세요');
    return;
  }

  writeRecord(monthSheet, parsed, classification);

  // 처리 완료: A1 초기화, B1에 결과 요약
  inputSheet.getRange(1, 1).setValue('');
  var typeLabel = classification.type === 'joint' ? '공동' : '개인(' + (classification.owner === 'incheon' ? '인천' : '가은') + ')';
  statusCell.setValue(
    '✅ ' + formatDate(parsed.date) + ' | ' +
    parsed.merchant + ' | ' +
    parsed.amount.toLocaleString() + '원 | ' +
    classification.category + ' | ' + typeLabel
  );
}

// ── 메시지 파싱 ────────────────────────────────────────────────

function parseCardMessage(msg) {
  var lines = msg.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });

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

    // MM/DD(요일) HH:MM 또는 MM/DD HH:MM
    m = line.match(/(\d{1,2})\/(\d{1,2})(?:\([가-힣일월화수목금토]\))?\s+(\d{2}):(\d{2})/);
    if (m) {
      date = makeDate(null, parseInt(m[1]), parseInt(m[2]));
      time = { hour: parseInt(m[3]), min: parseInt(m[4]) };
      usedIndices[i] = true;
      break;
    }

    // YYYY.MM.DD HH:MM 또는 YYYY-MM-DD HH:MM
    m = line.match(/(\d{4})[.\-](\d{2})[.\-](\d{2})\s+(\d{2}):(\d{2})/);
    if (m) {
      date = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
      time = { hour: parseInt(m[4]), min: parseInt(m[5]) };
      usedIndices[i] = true;
      break;
    }

    // DD일 HH:MM (공백 있는 버전)
    m = line.match(/^(\d{1,2})일\s+(\d{2}):(\d{2})$/);
    if (m) {
      var now = new Date();
      date = new Date(now.getFullYear(), now.getMonth(), parseInt(m[1]));
      time = { hour: parseInt(m[2]), min: parseInt(m[3]) };
      usedIndices[i] = true;
      break;
    }

    // 롯데카드 형식: "24일14:30" (공백 없음)
    m = line.match(/(\d{1,2})일(\d{2}):(\d{2})/);
    if (m) {
      var now2 = new Date();
      date = new Date(now2.getFullYear(), now2.getMonth(), parseInt(m[1]));
      time = { hour: parseInt(m[2]), min: parseInt(m[3]) };
      usedIndices[i] = true;
      break;
    }

    // MM/DD(요일) 단독 줄 + 다음 줄 HH:MM
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

  if (!date || !merchant || amount <= 0) {
    Logger.log('불완전 파싱 - date:' + date + ', merchant:"' + merchant + '", amount:' + amount);
    Logger.log('원본 줄 목록:\n' + lines.join('\n---\n'));
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
    if (totalMin >= 8 * 60 && totalMin <= 18 * 60 + 30) {
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
  return ss.getSheetByName(name); // 없으면 null 반환 (호출측에서 처리)
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

function formatDate(date) {
  return (date.getMonth() + 1) + '월 ' + date.getDate() + '일';
}

// ── 수동 테스트 ────────────────────────────────────────────────

function testParse() {
  var testCases = [
    { label: '인천 로카 / 주말 / 지엠마트 → 공동 생활비',
      msg: '[Web발신]\n롯데카드(LIKIT)\n04/19(토) 14:30\n지엠마트연수점\n45,000원 승인\n일시불' },
    { label: '가은 로카 / 평일 업무시간 / 버스 → 가은 개인 교통비',
      msg: '[Web발신]\n롯데카드(365)\n04/18(금) 09:15\n버스요금\n1,300원 승인' },
    { label: '인천 로카 / 평일 점심 / 스타벅스 → 인천 개인 여가',
      msg: '[Web발신]롯데카드(LIKIT)\n04/17(목) 12:00\n스타벅스코리아\n6,500원 승인\n일시불' },
    { label: '인천 로카 / 평일 저녁 / 식당 → 공동 외식',
      msg: '[Web발신]\n롯데카드(LIKIT)\n04/17(목) 19:30\n홍콩반점0410\n28,000원 승인\n일시불' },
    { label: '인천 로카 / 올리브영 → 인천 개인',
      msg: '[Web발신]\n롯데카드(LIKIT)\n04/16(수) 15:00\n올리브영인천점\n32,500원 승인' },
  ];

  var dow = ['일', '월', '화', '수', '목', '금', '토'];

  for (var i = 0; i < testCases.length; i++) {
    var tc = testCases[i];
    Logger.log('══ 테스트 ' + (i + 1) + ': ' + tc.label);
    var parsed = parseCardMessage(tc.msg);
    if (!parsed) { Logger.log('  ❌ 파싱 실패\n'); continue; }
    var cl = classifyExpense(parsed);
    Logger.log('  가맹점  : ' + parsed.merchant);
    Logger.log('  금액    : ' + parsed.amount.toLocaleString() + '원');
    Logger.log('  날짜    : ' + formatDate(parsed.date) + ' (' + dow[parsed.date.getDay()] + ')');
    Logger.log('  시간    : ' + (parsed.time ? parsed.time.hour + ':' + String(parsed.time.min).padStart(2, '0') : '미상'));
    Logger.log('  카드    : ' + parsed.card + ' (' + parsed.cardOwner + ')');
    Logger.log('  분류    : ' + (cl.type === 'joint' ? '공동' : '개인') + ' / ' + cl.category);
    Logger.log('');
  }
}
