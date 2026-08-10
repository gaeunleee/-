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

// ─── 시트 레이아웃 (대시보드 상단 + 거래 테이블 하단) ─────────────────────────
var CHART_ROW    = 2000;  // 차트용 숨은 데이터 영역 (화면 밖)
var CHART_TOP    = 5;     // 전월비교 차트 그리는 시작행
var GP_TITLE_ROW = 4;     // 가계평가 타이틀바
var GP_HEAD_ROW  = 5;     // 가계평가 컬럼헤더
var GP_DATA_ROW  = 6;     // 가계평가 데이터 (6,7,8행)
var GP_TOTAL_ROW = 9;     // 가계평가 총합계
var COMMENT_TOP  = 20;    // "이번 달 분석" 코멘트 시작행 (19행이 라벨)
var HEADER_ROW   = 25;    // 거래 테이블 섹션 헤더
var SUM1_ROW     = 26;    // 카드별 합계 1
var SUM2_ROW     = 27;    // 카드별 합계 2 / 섹션 합계
var COLHEAD_ROW  = 28;    // 거래 테이블 컬럼헤더
var DATA_ROW     = 29;    // 거래 데이터 시작행

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

// ─── 유틸: 시트 크기 확보 / 열 번호 → 문자 ────────────────────────────────────
function ensureSize(sheet, rows, cols) {
  var curRows = sheet.getMaxRows();
  if (curRows < rows) sheet.insertRowsAfter(curRows, rows - curRows);
  var curCols = sheet.getMaxColumns();
  if (curCols < cols) sheet.insertColumnsAfter(curCols, cols - curCols);
}

function colLetter(col) {
  var s = '';
  while (col > 0) {
    var m = (col - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}

// ─── 월별 시트 구성 ──────────────────────────────────────────────────────────
function buildSheet(sheet, mnNum, prevMn) {
  ensureSize(sheet, 2010, 85);

  sheet.setRowHeight(1, 32);
  sheet.setRowHeight(2, 24);
  sheet.setRowHeight(3, 10);
  sheet.setRowHeight(GP_TITLE_ROW, 24);
  for (var gr = GP_HEAD_ROW; gr <= GP_TOTAL_ROW; gr++) sheet.setRowHeight(gr, 20);
  sheet.setRowHeight(COMMENT_TOP - 1, 24);
  for (var cr2 = COMMENT_TOP; cr2 < COMMENT_TOP + 4; cr2++) sheet.setRowHeight(cr2, 26);
  sheet.setRowHeight(HEADER_ROW, 28);
  sheet.setRowHeight(SUM1_ROW, 22);
  sheet.setRowHeight(SUM2_ROW, 22);
  sheet.setRowHeight(COLHEAD_ROW, 22);

  // ── 0. 타이틀 + 요약 ──
  sheet.getRange(1, 1, 1, 20).merge().setValue(mnNum + '월 가계부')
    .setBackground('#1c4587').setFontColor('#fff').setFontSize(16)
    .setFontWeight('bold').setHorizontalAlignment('center');

  var totalCur = 'SUM(B$' + DATA_ROW + ':B$999)+SUM(I$' + DATA_ROW + ':I$999)+SUM(P$' + DATA_ROW + ':P$999)+SUM(W$' + DATA_ROW + ':W$999)';
  sheet.getRange(2, 1).setValue('이번 달 총지출').setFontWeight('bold');
  sheet.getRange(2, 3).setFormula('=' + totalCur).setNumberFormat('#,##0"원"').setFontWeight('bold').setFontSize(12);
  sheet.getRange(2, 6).setValue('전월대비');
  if (prevMn) {
    var prevTotal = 'IFERROR(SUM(INDIRECT("\'' + prevMn + '\'!B' + DATA_ROW + ':B999"))+SUM(INDIRECT("\'' + prevMn + '\'!I' + DATA_ROW + ':I999"))+SUM(INDIRECT("\'' + prevMn + '\'!P' + DATA_ROW + ':P999"))+SUM(INDIRECT("\'' + prevMn + '\'!W' + DATA_ROW + ':W999")),0)';
    sheet.getRange(2, 7).setFormula('=(' + totalCur + ')-(' + prevTotal + ')').setNumberFormat('+#,##0"원";-#,##0"원";0"원"');
    sheet.getRange(2, 9).setFormula('=IFERROR(((' + totalCur + ')-(' + prevTotal + '))/(' + prevTotal + '),0)').setNumberFormat('+0.0%;-0.0%;0%');
  } else {
    sheet.getRange(2, 7).setValue('-');
  }

  // ── 1. 가계평가 (AD~AI, 대시보드 상단에 고정 배치) ──
  mH(sheet, colLetter(30) + GP_TITLE_ROW + ':' + colLetter(35) + GP_TITLE_ROW, '가계평가', '#e69138');
  ['구분', '당월', '전월', '증감', '증감률', '평가'].forEach(function(v, i) {
    sheet.getRange(GP_HEAD_ROW, 30 + i).setValue(v).setBackground('#fce5cd').setFontWeight('bold');
  });
  buildGP(sheet, prevMn);

  // ── 2. 거래 테이블 섹션 헤더 ──
  mH(sheet, 'A' + HEADER_ROW + ':F' + HEADER_ROW, '인천 개인지출', '#4a86e8');
  mH(sheet, 'H' + HEADER_ROW + ':M' + HEADER_ROW, '가은 개인지출', '#cc0000');
  mH(sheet, 'O' + HEADER_ROW + ':T' + HEADER_ROW, '공동지출', '#38761d');
  mH(sheet, 'V' + HEADER_ROW + ':AB' + HEADER_ROW, '고정비', '#7030a0');

  // ── 3. 카드별 합계 ──
  lv(sheet, SUM1_ROW, 1, '인천 로카', '=SUMIF(F$' + DATA_ROW + ':F$999,"인천 로카",B$' + DATA_ROW + ':B$999)');
  lv(sheet, SUM1_ROW, 3, '인천 삼성', '=SUMIF(F$' + DATA_ROW + ':F$999,"인천 삼성",B$' + DATA_ROW + ':B$999)');
  lv(sheet, SUM1_ROW, 5, '인천 카카오', '=SUMIF(F$' + DATA_ROW + ':F$999,"인천 카카오",B$' + DATA_ROW + ':B$999)');
  lv(sheet, SUM1_ROW, 8, '가은 로카', '=SUMIF(M$' + DATA_ROW + ':M$999,"가은 로카",I$' + DATA_ROW + ':I$999)');
  lv(sheet, SUM1_ROW, 10, '가은 카카오', '=SUMIF(M$' + DATA_ROW + ':M$999,"가은 카카오",I$' + DATA_ROW + ':I$999)');
  lv(sheet, SUM1_ROW, 12, '가은 하나', '=SUMIF(M$' + DATA_ROW + ':M$999,"가은 하나",I$' + DATA_ROW + ':I$999)');
  lv(sheet, SUM1_ROW, 15, '인천 로카', '=SUMIF(T$' + DATA_ROW + ':T$999,"인천 로카",P$' + DATA_ROW + ':P$999)');
  lv(sheet, SUM1_ROW, 17, '가은 로카', '=SUMIF(T$' + DATA_ROW + ':T$999,"가은 로카",P$' + DATA_ROW + ':P$999)');
  lv(sheet, SUM1_ROW, 19, '인천 삼성', '=SUMIF(T$' + DATA_ROW + ':T$999,"인천 삼성",P$' + DATA_ROW + ':P$999)');
  lv(sheet, SUM1_ROW, 22, '인천 고정비', '=SUMIF(AA$' + DATA_ROW + ':AA$999,"인천",W$' + DATA_ROW + ':W$999)');
  lv(sheet, SUM1_ROW, 25, '가은 고정비', '=SUMIF(AA$' + DATA_ROW + ':AA$999,"가은",W$' + DATA_ROW + ':W$999)');

  sheet.getRange(SUM2_ROW, 1).setValue('합계').setFontWeight('bold');
  sheet.getRange(SUM2_ROW, 2).setFormula('=SUM(B$' + DATA_ROW + ':B$999)').setFontWeight('bold').setNumberFormat('#,##0"원"');
  sheet.getRange(SUM2_ROW, 8).setValue('합계').setFontWeight('bold');
  sheet.getRange(SUM2_ROW, 9).setFormula('=SUM(I$' + DATA_ROW + ':I$999)').setFontWeight('bold').setNumberFormat('#,##0"원"');
  lv(sheet, SUM2_ROW, 15, '인천 카카오', '=SUMIF(T$' + DATA_ROW + ':T$999,"인천 카카오",P$' + DATA_ROW + ':P$999)');
  lv(sheet, SUM2_ROW, 17, '현금·체크', '=SUMIF(T$' + DATA_ROW + ':T$999,"현금",P$' + DATA_ROW + ':P$999)+SUMIF(T$' + DATA_ROW + ':T$999,"체크카드",P$' + DATA_ROW + ':P$999)');
  sheet.getRange(SUM2_ROW, 19).setValue('합계').setFontWeight('bold');
  sheet.getRange(SUM2_ROW, 20).setFormula('=SUM(P$' + DATA_ROW + ':P$999)').setFontWeight('bold').setNumberFormat('#,##0"원"');
  lv(sheet, SUM2_ROW, 22, '공동 고정비', '=SUMIF(AA$' + DATA_ROW + ':AA$999,"공동",W$' + DATA_ROW + ':W$999)');
  sheet.getRange(SUM2_ROW, 25).setValue('고정비 합계').setFontWeight('bold');
  sheet.getRange(SUM2_ROW, 26).setFormula('=SUM(W$' + DATA_ROW + ':W$999)').setFontWeight('bold').setNumberFormat('#,##0"원"');

  // ── 4. 컬럼 헤더 ──
  var ch = ['날짜', '금액', '카테고리', '내용', '메모', '카드'];
  for (var i = 0; i < 6; i++) {
    sheet.getRange(COLHEAD_ROW, 1 + i).setValue(ch[i]);
    sheet.getRange(COLHEAD_ROW, 8 + i).setValue(ch[i]);
    sheet.getRange(COLHEAD_ROW, 15 + i).setValue(ch[i]);
  }
  ['날짜', '금액', '항목', '내용', '메모', '구분', '카드'].forEach(function(v, i) { sheet.getRange(COLHEAD_ROW, 22 + i).setValue(v); });

  sheet.getRange('A' + COLHEAD_ROW + ':F' + COLHEAD_ROW).setBackground('#c9daf8').setFontWeight('bold');
  sheet.getRange('H' + COLHEAD_ROW + ':M' + COLHEAD_ROW).setBackground('#f4cccc').setFontWeight('bold');
  sheet.getRange('O' + COLHEAD_ROW + ':T' + COLHEAD_ROW).setBackground('#d9ead3').setFontWeight('bold');
  sheet.getRange('V' + COLHEAD_ROW + ':AB' + COLHEAD_ROW).setBackground('#ead1dc').setFontWeight('bold');

  // ── 드롭다운 ──
  dd(sheet, DATA_ROW, 6, 500, INC_CARDS);
  dd(sheet, DATA_ROW, 13, 500, GAE_CARDS);
  dd(sheet, DATA_ROW, 20, 500, JNT_CARDS);
  dd(sheet, DATA_ROW, 3, 500, CATEGORIES);
  dd(sheet, DATA_ROW, 10, 500, CATEGORIES);
  dd(sheet, DATA_ROW, 17, 500, CATEGORIES);
  dd(sheet, DATA_ROW, 27, 500, GUN_TYPES);
  dd(sheet, DATA_ROW, 24, 500, FIXED_ITEMS);
  dd(sheet, DATA_ROW, 28, 500, ['인천 로카', '가은 로카', '인천 삼성', '현금', '체크카드']);

  // ── 날짜/금액 포맷 ──
  [1, 8, 15, 22].forEach(function(c) { sheet.getRange(DATA_ROW, c, 500, 1).setNumberFormat(DATE_FMT); });
  [2, 9, 16, 23].forEach(function(c) { sheet.getRange(DATA_ROW, c, 500, 1).setNumberFormat('#,##0'); });

  // ── 열 너비 ──
  var w = {
    1:72,  2:82,  3:82,  4:130, 5:60,  6:95,  7:12,
    8:72,  9:82, 10:82, 11:130,12:60, 13:95, 14:12,
   15:72, 16:82, 17:82, 18:130,19:60, 20:95, 21:12,
   22:72, 23:82, 24:90, 25:130,26:60, 27:70, 28:95, 29:12,
   30:90, 31:90, 32:90, 33:90, 34:70, 35:180
  };
  Object.keys(w).forEach(function(c){ sheet.setColumnWidth(+c, w[c]); });

  sheet.setFrozenRows(COLHEAD_ROW);
  buildCharts(sheet, prevMn);
}

// ─── 가계평가 섹션 (AD~AI 열) ────────────────────────────────────────────────
function buildGP(sheet, prevMn) {
  function pRef(col) {
    return 'INDIRECT("\'' + prevMn + '\'!' + col + DATA_ROW + ':' + col + '999")';
  }

  var sections = [
    {
      label: '인천 (개인+고정)',
      curF:  '=SUM(B$' + DATA_ROW + ':B$999)+SUMIF(AA$' + DATA_ROW + ':AA$999,"인천",W$' + DATA_ROW + ':W$999)',
      prevF: prevMn ? '=IFERROR(SUM('+pRef('B')+')+SUMIF('+pRef('AA')+',"인천",'+pRef('W')+'),0)' : null
    },
    {
      label: '가은 (개인+고정)',
      curF:  '=SUM(I$' + DATA_ROW + ':I$999)+SUMIF(AA$' + DATA_ROW + ':AA$999,"가은",W$' + DATA_ROW + ':W$999)',
      prevF: prevMn ? '=IFERROR(SUM('+pRef('I')+')+SUMIF('+pRef('AA')+',"가은",'+pRef('W')+'),0)' : null
    },
    {
      label: '공동 (지출+고정)',
      curF:  '=SUM(P$' + DATA_ROW + ':P$999)+SUMIF(AA$' + DATA_ROW + ':AA$999,"공동",W$' + DATA_ROW + ':W$999)',
      prevF: prevMn ? '=IFERROR(SUM('+pRef('P')+')+SUMIF('+pRef('AA')+',"공동",'+pRef('W')+'),0)' : null
    }
  ];

  sections.forEach(function(sec, i) {
    var r = GP_DATA_ROW + i;
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
      '=IF(AH'+r+'>0.1,"⚠️ "&TEXT(ABS(AG'+r+'),"#,##0")&"원 초과",'
      +'IF(AH'+r+'<-0.1,"✅ "&TEXT(ABS(AG'+r+'),"#,##0")&"원 절약","🟢 유사 수준"))');
  });

  var r0 = GP_DATA_ROW, r2 = GP_DATA_ROW + 2, rt = GP_TOTAL_ROW;
  var bg = '#fff2cc';
  sheet.getRange(rt, 30).setValue('총 합계').setFontWeight('bold').setBackground(bg);
  sheet.getRange(rt, 31).setFormula('=SUM(AE'+r0+':AE'+r2+')').setFontWeight('bold').setBackground(bg).setNumberFormat('#,##0');
  sheet.getRange(rt, 32).setFormula('=SUM(AF'+r0+':AF'+r2+')').setFontWeight('bold').setBackground(bg).setNumberFormat('#,##0');
  sheet.getRange(rt, 33).setFormula('=AE'+rt+'-AF'+rt).setFontWeight('bold').setBackground(bg).setNumberFormat('+#,##0;-#,##0;0');
  sheet.getRange(rt, 34).setFormula('=IFERROR(AG'+rt+'/AF'+rt+',0)').setFontWeight('bold').setBackground(bg).setNumberFormat('0.0%');
  sheet.getRange(rt, 35).setFormula('=IF(AH'+rt+'>0.05,"📊 전체 지출 증가","📊 전체 지출 안정/감소")').setBackground(bg);
}

// ─── 전월비교 차트 3개 + 카테고리 분석 헬퍼 데이터 ────────────────────────────
function buildCharts(sheet, prevMn) {
  var chartDefs = [
    {title:'인천 전월비교', name:'인천', aC:'B', cC:'C', anchorCol:1},
    {title:'가은 전월비교', name:'가은', aC:'I', cC:'J', anchorCol:8},
    {title:'공동 전월비교', name:'공동', aC:'P', cC:'Q', anchorCol:15}
  ];

  var helperAddrs = [];

  chartDefs.forEach(function(d, idx) {
    var dc = 42 + idx * 12;
    var catRow = CHART_ROW, curRow = CHART_ROW+1, prevRow = CHART_ROW+2, incRow = CHART_ROW+3;

    sheet.getRange(catRow,  dc).setValue('카테고리');
    sheet.getRange(curRow,  dc).setValue('당월');
    sheet.getRange(prevRow, dc).setValue('전월');
    sheet.getRange(incRow,  dc).setValue('증감');

    CATEGORIES.forEach(function(cat, ci) {
      var c = dc + 1 + ci;
      sheet.getRange(catRow, c).setValue(cat);
      sheet.getRange(curRow, c).setFormula(
        '=SUMIF('+d.cC+'$'+DATA_ROW+':'+d.cC+'$999,"'+cat+'",'+d.aC+'$'+DATA_ROW+':'+d.aC+'$999)');
      if (prevMn) {
        sheet.getRange(prevRow, c).setFormula(
          '=IFERROR(SUMIF(INDIRECT("\''+prevMn+'\'!'+d.cC+DATA_ROW+':'+d.cC+'999"),"'+cat+'",'
          +'INDIRECT("\''+prevMn+'\'!'+d.aC+DATA_ROW+':'+d.aC+'999")),0)');
      } else {
        sheet.getRange(prevRow, c).setValue(0);
      }
      var colL = colLetter(c);
      sheet.getRange(incRow, c).setFormula('='+colL+curRow+'-'+colL+prevRow);
    });

    var catRange = colLetter(dc+1)+catRow+':'+colLetter(dc+9)+catRow;
    var curRange = colLetter(dc+1)+curRow+':'+colLetter(dc+9)+curRow;
    var incRange = colLetter(dc+1)+incRow+':'+colLetter(dc+9)+incRow;

    var hCol = dc + 11;
    sheet.getRange(catRow,  hCol).setFormula('=INDEX('+catRange+',MATCH(MAX('+curRange+'),'+curRange+',0))');
    sheet.getRange(curRow,  hCol).setFormula('=MAX('+curRange+')');
    sheet.getRange(prevRow, hCol).setFormula('=IFERROR('+colLetter(hCol)+curRow+'/SUM('+curRange+'),0)');
    sheet.getRange(incRow,  hCol).setFormula('=INDEX('+incRange+',MATCH(MAX('+curRange+'),'+curRange+',0))');

    helperAddrs.push({
      name:     d.name,
      topCat:   colLetter(hCol)+catRow,
      topAmt:   colLetter(hCol)+curRow,
      topShare: colLetter(hCol)+prevRow,
      topInc:   colLetter(hCol)+incRow
    });

    var chart = sheet.newChart()
      .setChartType(Charts.ChartType.COLUMN)
      .addRange(sheet.getRange(catRow, dc, 3, CATEGORIES.length + 1))
      .setOption('title', d.title)
      .setOption('legend', {position:'bottom'})
      .setOption('vAxis', {format:'#,##0'})
      .setOption('hAxis', {textStyle:{fontSize:9}, slantedText:true, slantedTextAngle:30})
      .setOption('colors', ['#4285F4','#EA4335'])
      .setOption('useFirstColumnAsDomain', true)
      .setOption('width', 480).setOption('height', 260)
      .setPosition(CHART_TOP, d.anchorCol, 0, 0)
      .build();
    sheet.insertChart(chart);
  });

  buildComments(sheet, helperAddrs);
}

// ─── "이번 달 분석" 코멘트 (인천/가은/공동 각각 + 종합) ───────────────────────
function buildComments(sheet, helperAddrs) {
  sheet.getRange(COMMENT_TOP - 1, 1, 1, 20).merge()
    .setValue('💬 이번 달 분석').setFontWeight('bold').setFontSize(12);

  helperAddrs.forEach(function(h, i) {
    var r = COMMENT_TOP + i;
    var f = '="💬 '+h.name+': " & '+h.topCat+' & " " & TEXT('+h.topAmt+',"#,##0") & "원으로 이번 달 '+h.name+' 지출의 " & TEXT('+h.topShare+',"0%") & " 차지" & '
      + 'IF('+h.topShare+'>0.3," ⚠️ 비중이 큰 편이라 줄이는 걸 권장해요.", '
      + 'IF('+h.topInc+'>30000," 📈 전월보다 "&TEXT('+h.topInc+',"#,##0")&"원 늘었어요.", '
      + 'IF('+h.topInc+'<-30000," 📉 전월보다 "&TEXT(-('+h.topInc+'),"#,##0")&"원 줄었어요. 잘하고 있어요!", " 무난한 수준이에요.")))';
    sheet.getRange(r, 1, 1, 20).merge().setFormula(f).setFontSize(11).setVerticalAlignment('middle');
  });

  var r2 = COMMENT_TOP + helperAddrs.length;
  var f2 = '="💬 종합: " & IF(B'+SUM2_ROW+'>I'+SUM2_ROW+',"이번 달은 인천 개인지출이 가은보다 "&TEXT(B'+SUM2_ROW+'-I'+SUM2_ROW+',"#,##0")&"원 더 많았어요.",'
    + 'IF(I'+SUM2_ROW+'>B'+SUM2_ROW+',"이번 달은 가은 개인지출이 인천보다 "&TEXT(I'+SUM2_ROW+'-B'+SUM2_ROW+',"#,##0")&"원 더 많았어요.",'
    + '"이번 달 인천과 가은 개인지출이 비슷했어요.")) & " 공동지출 중 가장 큰 항목은 " & '+helperAddrs[2].topCat+' & "이에요."';
  sheet.getRange(r2, 1, 1, 20).merge().setFormula(f2).setFontSize(11).setVerticalAlignment('middle');
}

// ─── 결산(2026년) 시트 ──────────────────────────────────────────────────────
function buildResultSheet(ss) {
  var shName = '결산(2026년)';
  var sh = ss.getSheetByName(shName) || ss.insertSheet(shName);
  sh.clearContents(); sh.clearFormats();
  sh.getCharts().forEach(function(c){ sh.removeChart(c); });

  sh.getRange('A1:F1').merge().setValue('2026년 가계부 결산')
    .setBackground('#1c4587').setFontColor('#fff').setFontSize(14)
    .setFontWeight('bold').setHorizontalAlignment('center');
  sh.setRowHeight(1, 36);

  ['월','인천 개인','가은 개인','공동','고정비','합계'].forEach(function(h,i){
    sh.getRange(2,i+1).setValue(h).setBackground('#434343').setFontColor('#fff').setFontWeight('bold').setHorizontalAlignment('center');
  });

  MONTHS.forEach(function(mn, i) {
    var r = 3 + i;
    sh.getRange(r,1).setValue(mn).setFontWeight('bold');
    sh.getRange(r,2).setFormula('=IFERROR(SUM(INDIRECT("\''+mn+'\'!B'+DATA_ROW+':B999")),0)').setNumberFormat('#,##0');
    sh.getRange(r,3).setFormula('=IFERROR(SUM(INDIRECT("\''+mn+'\'!I'+DATA_ROW+':I999")),0)').setNumberFormat('#,##0');
    sh.getRange(r,4).setFormula('=IFERROR(SUM(INDIRECT("\''+mn+'\'!P'+DATA_ROW+':P999")),0)').setNumberFormat('#,##0');
    sh.getRange(r,5).setFormula('=IFERROR(SUM(INDIRECT("\''+mn+'\'!W'+DATA_ROW+':W999")),0)').setNumberFormat('#,##0');
    sh.getRange(r,6).setFormula('=SUM(B'+r+':E'+r+')').setNumberFormat('#,##0').setFontWeight('bold');
    if (i % 2 === 0) sh.getRange(r,1,1,6).setBackground('#f3f3f3');
  });

  sh.getRange(15,1).setValue('연간 합계').setFontWeight('bold').setBackground('#cfe2f3');
  ['B','C','D','E','F'].forEach(function(col){
    sh.getRange(15, col.charCodeAt(0)-64).setFormula('=SUM('+col+'3:'+col+'14)')
      .setNumberFormat('#,##0').setFontWeight('bold').setBackground('#cfe2f3');
  });

  sh.setColumnWidth(1,70);
  [2,3,4,5,6].forEach(function(c){ sh.setColumnWidth(c,100); });

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
        +'SUMIF(INDIRECT("\''+mn+'\'!C'+DATA_ROW+':C999"),"'+cat+'",INDIRECT("\''+mn+'\'!B'+DATA_ROW+':B999"))+'
        +'SUMIF(INDIRECT("\''+mn+'\'!J'+DATA_ROW+':J999"),"'+cat+'",INDIRECT("\''+mn+'\'!I'+DATA_ROW+':I999"))+'
        +'SUMIF(INDIRECT("\''+mn+'\'!Q'+DATA_ROW+':Q999"),"'+cat+'",INDIRECT("\''+mn+'\'!P'+DATA_ROW+':P999"))'
        +',0)').setNumberFormat('#,##0');
    });
    if (i % 2 === 0) sh.getRange(r,1,1,10).setBackground('#f3f3f3');
  });

  sh.getRange(31,1).setValue('합계').setFontWeight('bold').setBackground('#cfe2f3');
  CATEGORIES.forEach(function(cat, ci) {
    var col = String.fromCharCode(66+ci);
    sh.getRange(31, 2+ci).setFormula('=SUM('+col+'19:'+col+'30)')
      .setNumberFormat('#,##0').setFontWeight('bold').setBackground('#cfe2f3');
  });

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

function normalizeCard(card, sc) {
  var c = String(card).trim();
  if (sc === 1) {        // 인천 개인
    if (/로카|롯데/.test(c)) return '인천 로카';
    if (/삼성/.test(c))     return '인천 삼성';
    if (/카카오/.test(c))   return '인천 카카오';
  } else if (sc === 8) {  // 가은 개인
    if (/로카|롯데/.test(c)) return '가은 로카';
    if (/카카오/.test(c))   return '가은 카카오';
    if (/하나/.test(c))     return '가은 하나';
  }
  return c;
}

function wSec(sheet, rows, sc) {
  rows.forEach(function(row, i) {
    var r = DATA_ROW + i;
    for (var c = 0; c < 6; c++) {
      if (row[c] === '' || row[c] == null) continue;
      var cell = sheet.getRange(r, sc + c);
      var val = row[c];
      if (c === 5) val = normalizeCard(val, sc);
      if (val instanceof Date) cell.setValue(val).setNumberFormat(DATE_FMT);
      else cell.setValue(val);
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
