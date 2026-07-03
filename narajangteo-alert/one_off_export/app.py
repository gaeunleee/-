"""
나라장터 입찰공고 검색 프로그램 (내 컴퓨터에서 실행하는 웹 화면)

실행 방법 (최초 1회만 설치):
    pip install streamlit requests openpyxl pandas

실행 (이후에는 이 명령어만 반복 실행):
    streamlit run app.py

실행하면 브라우저가 자동으로 열리고, 검색 조건을 입력한 뒤
"검색 시작" 버튼을 누르면 나라장터에서 데이터를 모아서 화면에 보여주고
엑셀 다운로드 버튼도 생긴다.
"""

import time
import io
from datetime import date, timedelta

import requests
import pandas as pd
import streamlit as st
from openpyxl import Workbook

DEFAULT_SERVICE_KEY = "151205e2da4e686d92e3ac14b43cc10d2a6c16b983392dea3e59a9308ffc7397"

ENDPOINTS = {
    "용역": "http://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoServcPPSSrch",
    "공사": "http://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoCnstwkPPSSrch",
}

DEFAULT_KEYWORDS = "전시,체험,제작설치,전시관,체험관,콘텐츠,미디어아트,조성,디자인,도서관,조형물"

CONTRACT_METHOD_FIELD_CANDIDATES = ["cntrctCnclsMthdNm", "cntrctMthdNm", "cntrctCnclsSttusNm"]
REGION_FIELD_CANDIDATES = ["prtcptPsblRgnNm", "rgnLmtBidLocplcJdgmBssNm", "rgstTyNm"]
URL_FIELD_CANDIDATES = ["bidNtceDtlUrl", "bidNtceUrl"]

COLUMN_HEADERS = ["공고번호", "공고명", "발주기관", "수요기관", "계약방법",
                   "추정가격(예산)", "공고일", "입찰마감일", "지역제한", "원문 URL"]


def find_field(item: dict, candidates):
    for key in candidates:
        if item.get(key):
            return key, item[key]
    return None, None


def find_by_scan(item: dict, needle: str):
    if not needle:
        return None, None
    for key, value in item.items():
        if isinstance(value, str) and needle in value:
            return key, value
    return None, None


def get_contract_method(item: dict, target: str):
    _, value = find_field(item, CONTRACT_METHOD_FIELD_CANDIDATES)
    if value:
        return value
    _, value = find_by_scan(item, target)
    return value or ""


def get_region(item: dict, target: str):
    _, value = find_field(item, REGION_FIELD_CANDIDATES)
    if value:
        return value
    _, value = find_by_scan(item, target)
    return value or ""


def get_url(item: dict):
    _, value = find_field(item, URL_FIELD_CANDIDATES)
    return value or ""


def matches_filters(item: dict, region_kw: str, keywords: list, contract_kw: str) -> bool:
    if region_kw:
        region_value = get_region(item, region_kw)
        if region_kw not in (region_value or ""):
            return False

    if keywords:
        title = item.get("bidNtceNm", "") or ""
        if not any(kw in title for kw in keywords):
            return False

    if contract_kw:
        contract_method = get_contract_method(item, contract_kw)
        if contract_kw not in (contract_method or ""):
            return False

    return True


def date_chunks(start: date, end: date, days: int):
    cur = start
    while cur <= end:
        chunk_end = min(cur + timedelta(days=days - 1), end)
        yield cur, chunk_end
        cur = chunk_end + timedelta(days=1)


def call_api(url, service_key, begin_dt, end_dt, page_no, num_of_rows):
    params = {
        "ServiceKey": service_key,
        "inqryDiv": "1",
        "inqryBgnDt": begin_dt,
        "inqryEndDt": end_dt,
        "numOfRows": num_of_rows,
        "pageNo": page_no,
        "type": "json",
    }
    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def extract_items(data):
    body = data.get("response", {}).get("body", {})
    items = body.get("items", [])
    if isinstance(items, dict):
        items = items.get("item", [])
    if isinstance(items, dict):
        items = [items]
    total_count = int(body.get("totalCount", 0) or 0)
    return items, total_count


def build_row(item, region_kw, contract_kw):
    return {
        "공고번호": item.get("bidNtceNo", ""),
        "공고명": item.get("bidNtceNm", ""),
        "발주기관": item.get("ntceInsttNm", ""),
        "수요기관": item.get("dminsttNm", ""),
        "계약방법": get_contract_method(item, contract_kw),
        "추정가격(예산)": item.get("presmptPrce", ""),
        "공고일": item.get("bidNtceDt", ""),
        "입찰마감일": item.get("bidClseDt", ""),
        "지역제한": get_region(item, region_kw),
        "원문 URL": get_url(item),
    }


def to_excel_bytes(rows):
    wb = Workbook()
    ws = wb.active
    ws.title = "검색결과"
    ws.append(COLUMN_HEADERS)
    for row in rows:
        ws.append([row.get(h, "") for h in COLUMN_HEADERS])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


st.set_page_config(page_title="나라장터 입찰공고 검색", layout="wide")
st.title("나라장터 입찰공고 검색 프로그램")
st.caption("조달청 나라장터 공개 API를 이용해 조건에 맞는 입찰공고를 모아서 엑셀로 저장합니다.")

with st.sidebar:
    st.header("검색 조건")
    service_key = st.text_input("인증키 (ServiceKey)", value=DEFAULT_SERVICE_KEY)
    service_types = st.multiselect("공고 종류", list(ENDPOINTS.keys()), default=list(ENDPOINTS.keys()))
    col1, col2 = st.columns(2)
    with col1:
        start_date = st.date_input("조회 시작일", value=date(2025, 1, 1))
    with col2:
        end_date = st.date_input("조회 종료일", value=date(2026, 12, 31))

    region_kw = st.text_input("지역제한 필터 (비워두면 지역 필터 안 함)", value="강원")
    keyword_text = st.text_area("공고명 키워드 (쉼표로 구분, 하나라도 포함되면 매칭)", value=DEFAULT_KEYWORDS, height=100)
    contract_kw = st.text_input("계약방법 필터 (비워두면 계약방법 필터 안 함)", value="협상에의한계약")
    num_of_rows = st.number_input("페이지당 조회 건수", value=999, min_value=10, max_value=999)
    sleep_sec = st.slider("호출 사이 대기 시간(초) - 차단 방지", min_value=0.1, max_value=2.0, value=0.4, step=0.1)

    search_clicked = st.button("검색 시작", type="primary", use_container_width=True)

if "results" not in st.session_state:
    st.session_state.results = []
if "sample_item" not in st.session_state:
    st.session_state.sample_item = None

if search_clicked:
    keywords = [k.strip() for k in keyword_text.split(",") if k.strip()]
    chunks = list(date_chunks(start_date, end_date, 15))
    total_steps = len(chunks) * max(len(service_types), 1)
    progress = st.progress(0.0, text="검색 준비 중...")
    log_box = st.empty()
    results = []
    step = 0
    errors = []

    for label in service_types:
        url = ENDPOINTS[label]
        for c_start, c_end in chunks:
            begin_dt = c_start.strftime("%Y%m%d0000")
            end_dt = c_end.strftime("%Y%m%d2359")
            page_no = 1
            while True:
                try:
                    data = call_api(url, service_key, begin_dt, end_dt, page_no, num_of_rows)
                except Exception as e:
                    errors.append(f"{label} {begin_dt}~{end_dt} page{page_no}: {e}")
                    break

                items, total_count = extract_items(data)
                if items and st.session_state.sample_item is None:
                    st.session_state.sample_item = items[0]

                for item in items:
                    if matches_filters(item, region_kw, keywords, contract_kw):
                        results.append(build_row(item, region_kw, contract_kw))

                if page_no * num_of_rows >= total_count:
                    break
                page_no += 1
                time.sleep(sleep_sec)

            step += 1
            progress.progress(min(step / total_steps, 1.0),
                               text=f"{label} {c_start}~{c_end} 조회 중... (누적 매칭 {len(results)}건)")
            time.sleep(sleep_sec)

    progress.progress(1.0, text="검색 완료")
    st.session_state.results = results

    if errors:
        with st.expander(f"호출 중 오류 {len(errors)}건 (참고용)"):
            for e in errors:
                st.text(e)

if st.session_state.sample_item:
    with st.expander("실제 API 응답 필드명 확인 (계약방법/지역제한 필드명이 다르면 여기서 확인)"):
        st.json(st.session_state.sample_item)

if st.session_state.results:
    df = pd.DataFrame(st.session_state.results, columns=COLUMN_HEADERS)
    st.success(f"총 {len(df)}건 검색됨")
    st.dataframe(df, use_container_width=True)

    excel_bytes = to_excel_bytes(st.session_state.results)
    st.download_button(
        label="엑셀(xlsx) 다운로드",
        data=excel_bytes,
        file_name="강원도_전시체험_협상계약_2025_2026.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
elif search_clicked:
    st.warning("조건에 맞는 공고가 없습니다.")
