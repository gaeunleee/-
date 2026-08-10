var OLD_SS_ID  = '1HDhrERTUA8R6lTulXVLBltODbqwYYKETQ7Jd5r40WxU';
var NEW_SS_ID  = '1jMEQxxAhiT581RDyBIE9_0K3bVrnSad1PX8SEyzoGTw';
var MONTHS     = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
var INC_CARDS  = ['인천 로카','인천 삼성','인천 카카오'];
var GAE_CARDS  = ['가은 로카','가은 카카오','가은 하나'];
var JNT_CARDS  = ['인천 로카','가은 로카','인천 삼성','인천 카카오','현금','체크카드'];
var GUN_TYPES  = ['인천','가은','공동'];
var CATEGORIES = ['생활비','외식','교통비','의료비','여가','여행','경조사','쇼핑','기타'];
var FIXED_ITEMS= ['관리비','대출금','휴대폰','인터넷','가전','보험','회비 및 공돈','저축','적금','구독'];
var DATE_FMT   = 'M"월 "D"일 ("ddd")"';
var DATA_ROW   = 5;
var CHART_ROW  = 2000;
var PREV_MN    = {
  '1월':null,'2월':'1월','3월':'2월','4월':'3월','5월':'4월','6월':'5월',
  '7월':'6월','8월':'7월','9월':'8월','10월':'9월','11월':'10월','12월':'11월'
};

// ─── 메인 실행 ───────────────────────────────────────────────────────────────
function rebuildAll() {
  var ss = SpreadsheetApp.openById(NEW_SS_ID);
  ss.setSpreadsheetLocale('ko_KR');
  SpreadsheetApp.flush();

  MONTHS.forEach(function(mn, idx) {
    var sheet = ss.getSheetByName(mn) || ss.insertSheet(mn);
    sheet.clearContents();
    sheet.clearFormats();
    sheet.getCharts().forEach(function(c){ sheet.removeChart(c); });
    buildSheet(sheet, idx + 1, PREV_MN[mn]);
    SpreadsheetApp.flush();
    Logger.log(mn + ' 완료');
  });

  buildResultSheet(ss);
  reMigrate(ss);

  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction() === 'onDateEdit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onDateEdit').forSpreadsheet(ss).onEdit().create();
  Logger.log('✅ 전체 완료');
}

// ─── 월별 시트 구성 ──────────────────────────────────────────────────────────
function buildSheet(sheet, mnNum, prevMn) {
  sheet.setRowHeight(1, 28);
  sheet.setRowHeight(2, 22);
  sheet.setRowHeight(3, 22);
  sheet.setRowHeight(4, 22);

  // 1행: 섹션 헤더
  mH(sheet, 'A1:F1', '인천 개인지출', '#4a86e8');
  mH(sheet, 'H1:M1', '가은 개인지출', '#cc0000');
  mH(sheet, 'O1:T1', '공동지출',      '#38761d');
  mH(sheet, 'V1:AB1','고정비',         '#7030a0');
  mH(sheet, 'AD1:AI1','가계평가',      '#e69138');

  // 2행: 카드별 합계
  lv(sheet,2,1, '인천 로카',   '=SUMIF(F$5:F$999,"인천 로카",B$5:B$999)');
  lv(sheet,2,3, '인천 삼성',   '=SUMIF(F$5:F$999,"인천 삼성",B$5:B$999)');
  lv(sheet,2,5, '인천 카카오', '=SUMIF(F$5:F$999,"인천 카카오",B$5:B$999)');
  lv(sheet,2,8, '가은 로카',   '=SUMIF(M$5:M$999,"가은 로카",I$5:I$999)');
  lv(sheet,2,10,'가은 카카오', '=SUMIF(M$5:M$999,"가은 카카오",I$5:I$999)');
  lv(sheet,2,12,'가은 하나',   '=SUMIF(M$5:M$999,"가은 하나",I$5:I$999)');
  lv(sheet,2,15,'인천 로카',   '=SUMIF(T$5:T$999,"인천 로카",P$5:P$999)');
  lv(sheet,2,17,'가은 로카',   '=SUMIF(T$5:T$999,"가은 로카",P$5:P$999)');
  lv(sheet,2,19,'인천 삼성',   '=SUMIF(T$5:T$999,"인천 삼성",P$5:P$999)');
  lv(sheet,2,22,'인천 고정비', '=SUMIF(AA$5:AA$999,"인천",W$5:W$999)');
  lv(sheet,2,25,'가은 고정비', '=SUMIF(AA$5:AA$999,"가은",W$5:W$999)');

  // 3행: 섹션 합계
  sheet.getRange(3,1).setValue('합계').setFontWeight('bold');
  sheet.getRange(3,2).setFormula('=SUM(B$5:B$999)').setFontWeight('bold').setNumberFormat('#,##0"원"');
  sheet.getRange(3,8).setValue('합계').setFontWeight('bold');
  sheet.getRange(3,9).setFormula('=SUM(I$5:I$999)').setFontWeight('bold').setNumberFormat('#,##0"원"');
  lv(sheet,3,15,'인천 카카오', '=SUMIF(T$5:T$999,"인천 카카오",P$5:P$999)');
  lv(sheet,3,17,'현금·체크',   '=SUMIF(T$5:T$999,"현금",P$5:P$999)+SUMIF(T$5:T$999,"체크카드",P$5:P$999)');
  sheet.getRange(3,19).setValue('합계').setFontWeight('bold');
  sheet.getRange(3,20).setFormula('=SUM(P$5:P$999)').setFontWeight('bold').setNumberFormat('#,##0"원"');
  lv(sheet,3,22,'공동 고정비', '=SUMIF(AA$5:AA$999,"공동",W$5:W$999)');
  sheet.getRange(3,25).setValue('고정비 합계').setFontWeight('bold');
  sheet.getRange(3,26).setFormula('=SUM(W$5:W$999)').setFontWeight('bold').setNumberFormat('#,##0"원"');

  // 4행: 컬럼 헤더
  var ch = ['날짜','금액','카테고리','내용','메모','카드'];
  for (var i = 0; i < 6; i++) {
    sheet.getRange(4, 1+i).setValue(ch[i]);
    sheet.getRange(4, 8+i).setValue(ch[i]);
    sheet.getRange(4,15+i).setValue(ch[i]);
  }
  ['날짜','금액','항목','내용','메모','구분','카드'].forEach(function(v,i){ sheet.getRange(4,22+i).setValue(v); });
  ['구분','당월','전월','증감','증감률','평가'].forEach(function(v,i){ sheet.getRange(4,30+i).setValue(v); });

  sheet.getRange('A4:F4').setBackground('#c9daf8').setFontWeight('bold');
  sheet.getRange('H4:M4').setBackground('#f4cccc').setFontWeight('bold');
  sheet.getRange('O4:T4').setBackground('#d9ead3').setFontWeight('bold');
  sheet.getRange('V4:AB4').setBackground('#ead1dc').setFontWeight('bold');
  sheet.getRange('AD4:AI4').setBackground('#fce5cd').setFontWeight('bold');

  // 드롭다운
  dd(sheet,5, 6,500,INC_CARDS);
  dd(sheet,5,13,500,GAE_CARDS);
  dd(sheet,5,20,500,JNT_CARDS);
  dd(sheet,5, 3,500,CATEGORIES);
  dd(sheet,5,10,500,CATEGORIES);
  dd(sheet,5,17,500,CATEGORIES);
  dd(sheet,5,27,500,GUN_TYPES);
  dd(sheet,5,24,500,FIXED_ITEMS);
  dd(sheet,5,28,500,['인천 로카','가은 로카','인천 삼성','현금','체크카드']);

  // 날짜/금액 포맷
  [1,8,15,22].forEach(function(c){ sheet.getRange(5,c,500,1).setNumberFormat(DATE_FMT); });
  [2,9,16,23].forEach(function(c){ sheet.getRange(5,c,500,1).setNumberFormat('#,##0'); });

  // 열 너비
  var w = {
    1:72,  2:82,  3:82,  4:130, 5:60,  6:95,  7:12,
    8:72,  9:82, 10:82, 11:130,12:60, 13:95, 14:12,
   15:72, 16:82, 17:82, 18:130,19:60, 20:95, 21:12,
   22:72, 23:82, 24:90, 25:130,26:60, 27:70, 28:95, 29:12,
   30:90, 31:90, 32:90, 33:90, 34:70, 35:180
  };
  Object.keys(w).forEach(function(c){ sheet.setColumnWidth(+c, w[c]); });

  sheet.setFrozenRows(4);
  buildGP(sheet, prevMn);
  buildCharts(sheet, prevMn);
}

// ─── 가계평가 섹션 (AD~AI 열) ────────────────────────────────────────────────
function buildGP(sheet, prevMn) {
  function pRef(col) {
    return 'INDIRECT("\'' + prevMn + '\'!' + col + '5:' + col + '999")';
  }

  var sections = [
    {
      label: '인천 (개인+고정)',
      curF:  '=SUM(B$5:B$999)+SUMIF(AA$5:AA$999,"인천",W$5:W$999)',
      prevF: prevMn ? '=IFERROR(SUM('+pRef('B')+')+SUMIF('+pRef('AA')+',"인천",'+pRef('W')+'),0)' : null
    },
    {
      label: '가은 (개인+고정)',
      curF:  '=SUM(I$5:I$999)+SUMIF(AA$5:AA$999,"가은",W$5:W$999)',
      prevF: prevMn ? '=IFERROR(SUM('+pRef('I')+')+SUMIF('+pRef('AA')+',"가은",'+pRef('W')+'),0)' : null
    },
    {
      label: '공동 (지출+고정)',
      curF:  '=SUM(P$5:P$999)+SUMIF(AA$5:AA$999,"공동",W$5:W$999)',
      prevF: prevMn ? '=IFERROR(SUM('+pRef('P')+')+SUMIF('+pRef('AA')+',"공동",'+pRef('W')+'),0)' : null
    }
  ];

  sections.forEach(function(sec, i) {
    var r = DATA_ROW + i;
    sheet.getRange(r, 30).setValue(sec.label).setFontWeight('bold');
    sheet.getRange(r, 31).setFormula(sec.curF).setNumberFormat('#,##0');
    if (sec.prevF) {
      sheet.getRange(r, 32).setFormula(sec.prevF).setNumberFormat('#,##0');
    } else {
      sheet.getRange(r, 32).setValue(0).setNumberFormat('#,##0');
    }
    sheet.getRange(r, 33).setFormula('=AE'+r+'-AF'+r).setNumberFormat('+#,##0;-#,##0;0');
    sheet.getRange(r, 34).setFormula('=IFERROR(AG'+r+'/AF'+r+',0)').setNumberFormat('0.0%');
    sheet.getRange(r, 35).setFormula(
      '=IF(AH'+r+'>0.1,"⚠️ "+TEXT(ABS(AG'+r+'),"#,##0")+"원 초과",'
      +'IF(AH'+r+'<-0.1,"✅ "+TEXT(ABS(AG'+r+'),"#,##0")+"원 절약","🟢 유사 수준"))');
  });

  // 총합 행
  var rt = DATA_ROW + 3;
  var bg = '#fff2cc';
  sheet.getRange(rt, 30).setValue('총 합계').setFontWeight('bold').setBackground(bg);
  sheet.getRange(rt, 31).setFormula('=SUM(AE5:AE7)').setFontWeight('bold').setBackground(bg).setNumberFormat('#,##0');
  sheet.getRange(rt, 32).setFormula('=SUM(AF5:AF7)').setFontWeight('bold').setBackground(bg).setNumberFormat('#,##0');
  sheet.getRange(rt, 33).setFormula('=AE'+rt+'-AF'+rt).setFontWeight('bold').setBackground(bg).setNumberFormat('+#,##0;-#,##0;0');
  sheet.getRange(rt, 34).setFormula('=IFERROR(AG'+rt+'/AF'+rt+',0)').setFontWeight('bold').setBackground(bg).setNumberFormat('0.0%');
  sheet.getRange(rt, 35).setFormula('=IF(AH'+rt+'>0.05,"📊 전체 지출 증가","📊 전체 지출 안정/감소")').setBackground(bg);
}

// ─── 전월비교 차트 3개 (인천/가은/공동) ──────────────────────────────────────
function buildCharts(sheet, prevMn) {
  var chartDefs = [
    {title:'인천 전월비교', aC:'B', cC:'C', chartCol:1},
    {title:'가은 전월비교', aC:'I', cC:'J', chartCol:8},
    {title:'공동 전월비교', aC:'P', cC:'Q', chartCol:15}
  ];

  chartDefs.forEach(function(d, idx) {
    var dc = 42 + idx * 12;
    sheet.getRange(CHART_ROW,   dc).setValue('카테고리');
    sheet.getRange(CHART_ROW+1, dc).setValue('당월');
    sheet.getRange(CHART_ROW+2, dc).setValue('전월');

    CATEGORIES.forEach(function(cat, ci) {
      var c = dc + 1 + ci;
      sheet.getRange(CHART_ROW,   c).setValue(cat);
      sheet.getRange(CHART_ROW+1, c).setFormula(
        '=SUMIF('+d.cC+'$5:'+d.cC+'$999,"'+cat+'",'+d.aC+'$5:'+d.aC+'$999)');
      if (prevMn) {
        sheet.getRange(CHART_ROW+2, c).setFormula(
          '=IFERROR(SUMIF(INDIRECT("\''+prevMn+'\'!'+d.cC+'5:'+d.cC+'999"),"'+cat+'",'
          +'INDIRECT("\''+prevMn+'\'!'+d.aC+'5:'+d.aC+'999")),0)');
      } else {
        sheet.getRange(CHART_ROW+2, c).setValue(0);
      }
    });

    var chart = sheet.newChart()
      .setChartType(Charts.ChartType.COLUMN)
      .addRange(sheet.getRange(CHART_ROW, dc, 3, CATEGORIES.length + 1))
      .setOption('title', d.title)
      .setOption('legend', {position:'bottom'})
      .setOption('vAxis', {format:'#,##0'})
      .setOption('hAxis', {textStyle:{fontSize:9}})
      .setOption('colors', ['#4285F4','#EA4335'])
      .setOption('useFirstColumnAsDomain', true)
      .setOption('width', 440).setOption('height', 260)
      .setPosition(1, d.chartCol, 0, 0)
      .build();
    sheet.insertChart(chart);
  });
}

// ─── 결산(2026년) 시트 ──────────────────────────────────────────────────────
function buildResultSheet(ss) {
  var shName = '결산(2026년)';
  var sh = ss.getSheetByName(shName) || ss.insertSheet(shName);
  sh.clearContents(); sh.clearFormats();
  sh.getCharts().forEach(function(c){ sh.removeChart(c); });

  // 타이틀
  sh.getRange('A1:F1').merge().setValue('2026년 가계부 결산')
    .setBackground('#1c4587').setFontColor('#fff').setFontSize(14)
    .setFontWeight('bold').setHorizontalAlignment('center');
  sh.setRowHeight(1, 36);

  // 헤더
  ['월','인천 개인','가은 개인','공동','고정비','합계'].forEach(function(h,i){
    sh.getRange(2,i+1).setValue(h).setBackground('#434343').setFontColor('#fff').setFontWeight('bold').setHorizontalAlignment('center');
  });

  // 월별 합산 (INDIRECT)
  MONTHS.forEach(function(mn, i) {
    var r = 3 + i;
    sh.getRange(r,1).setValue(mn).setFontWeight('bold');
    sh.getRange(r,2).setFormula('=IFERROR(SUM(INDIRECT("\''+mn+'\'!B5:B999")),0)').setNumberFormat('#,##0');
    sh.getRange(r,3).setFormula('=IFERROR(SUM(INDIRECT("\''+mn+'\'!I5:I999")),0)').setNumberFormat('#,##0');
    sh.getRange(r,4).setFormula('=IFERROR(SUM(INDIRECT("\''+mn+'\'!P5:P999")),0)').setNumberFormat('#,##0');
    sh.getRange(r,5).setFormula('=IFERROR(SUM(INDIRECT("\''+mn+'\'!W5:W999")),0)').setNumberFormat('#,##0');
    sh.getRange(r,6).setFormula('=SUM(B'+r+':E'+r+')').setNumberFormat('#,##0').setFontWeight('bold');
    if (i % 2 === 0) sh.getRange(r,1,1,6).setBackground('#f3f3f3');
  });

  // 연간 합계
  sh.getRange(15,1).setValue('연간 합계').setFontWeight('bold').setBackground('#cfe2f3');
  ['B','C','D','E','F'].forEach(function(col){
    sh.getRange(15, col.charCodeAt(0)-64).setFormula('=SUM('+col+'3:'+col+'14)')
      .setNumberFormat('#,##0').setFontWeight('bold').setBackground('#cfe2f3');
  });

  // 열 너비
  sh.setColumnWidth(1,70);
  [2,3,4,5,6].forEach(function(c){ sh.setColumnWidth(c,100); });

  // 카테고리별 연간 지출 테이블
  sh.getRange('A17:J17').merge().setValue('카테고리별 연간 지출')
    .setBackground('#1c4587').setFontColor('#fff').setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange(18,1).setValue('월').setBackground('#434343').setFontColor('#fff').setFontWeight('bold');
  CATEGORIES.forEach(function(cat,i){
    sh.getRange(18,2+i).setValue(cat).setBackground('#434343').setFontColor('#fff').setFontWeight('bold');
    sh.setColumnWidth(2+i, 80);
  });

  MONTHS.forEach(function(mn, i) {
    var r = 19 + i;
    sh.getRange(r,1).setValue(mn);
    CATEGORIES.forEach(function(cat, ci) {
      sh.getRange(r, 2+ci).setFormula(
        '=IFERROR('
        +'SUMIF(INDIRECT("\''+mn+'\'!C5:C999"),"'+cat+'",INDIRECT("\''+mn+'\'!B5:B999"))+'
        +'SUMIF(INDIRECT("\''+mn+'\'!J5:J999"),"'+cat+'",INDIRECT("\''+mn+'\'!I5:I999"))+'
        +'SUMIF(INDIRECT("\''+mn+'\'!Q5:Q999"),"'+cat+'",INDIRECT("\''+mn+'\'!P5:P999"))'
        +',0)').setNumberFormat('#,##0');
    });
    if (i % 2 === 0) sh.getRange(r,1,1,10).setBackground('#f3f3f3');
  });

  // 카테고리 합계 행
  sh.getRange(31,1).setValue('합계').setFontWeight('bold').setBackground('#cfe2f3');
  CATEGORIES.forEach(function(cat, ci) {
    var col = String.fromCharCode(66+ci);
    sh.getRange(31, 2+ci).setFormula('=SUM('+col+'19:'+col+'30)')
      .setNumberFormat('#,##0').setFontWeight('bold').setBackground('#cfe2f3');
  });

  // 차트 데이터 (row 50)
  var cr = 50;
  sh.getRange(cr,1).setValue('월');
  ['인천 개인','가은 개인','공동','고정비'].forEach(function(h,i){ sh.getRange(cr,2+i).setValue(h); });
  MONTHS.forEach(function(mn, i) {
    sh.getRange(cr+1+i, 1).setValue(mn);
    sh.getRange(cr+1+i, 2).setFormula('=B'+(3+i));
    sh.getRange(cr+1+i, 3).setFormula('=C'+(3+i));
    sh.getRange(cr+1+i, 4).setFormula('=D'+(3+i));
    sh.getRange(cr+1+i, 5).setFormula('=E'+(3+i));
  });

  // 월별 합계 누적 차트
  sh.insertChart(sh.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(sh.getRange(cr, 1, 13, 5))
    .setOption('title', '2026년 월별 지출 현황')
    .setOption('isStacked', true)
    .setOption('legend', {position:'bottom'})
    .setOption('vAxis', {format:'#,##0'})
    .setOption('colors', ['#4a86e8','#cc0000','#38761d','#7030a0'])
    .setOption('useFirstColumnAsDomain', true)
    .setOption('width', 600).setOption('height', 300)
    .setPosition(2, 8, 0, 0)
    .build());

  Logger.log('결산(2026년) 완료');
}

// ─── 데이터 마이그레이션 ─────────────────────────────────────────────────────
function reMigrate(newSS) {
  var oldSS = SpreadsheetApp.openById(OLD_SS_ID);
  MONTHS.forEach(function(mn) {
    var old = oldSS.getSheetByName(mn); if (!old) return;
    var nw  = newSS.getSheetByName(mn); if (!nw)  return;
    var last = old.getLastRow(); if (last < 2) return;
    var data = old.getRange(2, 1, last-1, 20).getValues();
    var inc = [], gae = [], jnt = [];
    data.forEach(function(r) {
      if (r[0] && r[1])   inc.push(r.slice(0,  6));
      if (r[7] && r[8])   gae.push(r.slice(7,  13));
      if (r[14] && r[15]) jnt.push(r.slice(14, 20));
    });
    wSec(nw, inc, 1); wSec(nw, gae, 8); wSec(nw, jnt, 15);
    Logger.log(mn+': 인천'+inc.length+'/가은'+gae.length+'/공동'+jnt.length);
  });
}

function wSec(sheet, rows, sc) {
  rows.forEach(function(row, i) {
    var r = DATA_ROW + i;
    for (var c = 0; c < 6; c++) {
      if (row[c] === '' || row[c] == null) continue;
      var cell = sheet.getRange(r, sc + c);
      if (row[c] instanceof Date) cell.setValue(row[c]).setNumberFormat(DATE_FMT);
      else cell.setValue(row[c]);
    }
  });
}

// ─── 헬퍼 ───────────────────────────────────────────────────────────────────
function mH(sheet, range, label, color) {
  sheet.getRange(range).merge().setValue(label)
    .setBackground(color).setFontColor('#fff')
    .setFontWeight('bold').setFontSize(11).setHorizontalAlignment('center');
}

function lv(sheet, row, col, label, formula) {
  sheet.getRange(row, col).setValue(label).setFontWeight('bold');
  sheet.getRange(row, col+1).setFormula(formula).setNumberFormat('#,##0"원"');
}

function dd(sheet, startRow, col, rows, items) {
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(items, true).setAllowInvalid(true).build();
  sheet.getRange(startRow, col, rows, 1).setDataValidation(rule);
}
