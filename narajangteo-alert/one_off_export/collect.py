"""
나라장터(조달청) 입찰공고 수집 - 강원 지역제한 / 전시체험 키워드 / 협상에의한계약 필터
용역 + 공사 두 API를 2025-01-01 ~ 2026-12-31 기간을 15일 단위로 나눠서 호출한다.

실행 방법:
  1) Google Colab (colab.research.google.com) 에서 새 노트북 생성 후 이 코드 전체를 붙여넣고 실행
     (첫 셀에 !pip install openpyxl requests 를 먼저 실행해도 되고, 대부분 기본 설치되어 있음)
  2) 또는 로컬 PC에 Python이 있다면:
       pip install requests openpyxl
       python collect.py

실행이 끝나면 같은 폴더에 강원도_전시체험_협상계약_2025_2026.xlsx 파일이 생성되고,
총 몇 건이 수집됐는지 화면에 출력된다.
"""

import time
import json
from datetime import date, timedelta
import requests
from openpyxl import Workbook

SERVICE_KEY = "151205e2da4e686d92e3ac14b43cc10d2a6c16b983392dea3e59a9308ffc7397"

ENDPOINTS = {
    "용역": "http://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoServcPPSSrch",
    "공사": "http://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoCnstwkPPSSrch",
}

KEYWORDS = ["전시", "체험", "제작설치", "전시관", "체험관", "콘텐츠", "미디어아트", "조성", "디자인", "도서관", "조형물"]
TARGET_CONTRACT_METHOD = "협상에의한계약"
TARGET_REGION_KEYWORD = "강원"

START_DATE = date(2025, 1, 1)
END_DATE = date(2026, 12, 31)
CHUNK_DAYS = 15
NUM_OF_ROWS = 999
SLEEP_BETWEEN_CALLS = 0.4  # 과다호출 차단 방지용 텀

OUTPUT_FILE = "강원도_전시체험_협상계약_2025_2026.xlsx"
DEBUG_SAMPLE_FILE = "debug_sample_response.json"

COLUMNS = [
    ("공고번호", "bidNtceNo"),
    ("공고명", "bidNtceNm"),
    ("발주기관", "ntceInsttNm"),
    ("수요기관", "dminsttNm"),
    ("계약방법", None),   # 아래 find_contract_method 로 별도 처리
    ("추정가격(예산)", "presmptPrce"),
    ("공고일", "bidNtceDt"),
    ("입찰마감일", "bidClseDt"),
    ("지역제한", None),   # 아래 find_region 로 별도 처리
    ("원문 URL", None),   # bidNtceDtlUrl 우선, 없으면 bidNtceUrl
]

# 계약방법을 담고 있을 가능성이 있는 필드명 후보 (실제 필드명은 최초 응답에서 확인 필요)
CONTRACT_METHOD_FIELD_CANDIDATES = [
    "cntrctCnclsMthdNm", "cntrctMthdNm", "cntrctCnclsSttusNm",
]
# 지역제한을 담고 있을 가능성이 있는 필드명 후보
REGION_FIELD_CANDIDATES = [
    "prtcptPsblRgnNm", "rgnLmtBidLocplcJdgmBssNm", "rgstTyNm",
]
URL_FIELD_CANDIDATES = ["bidNtceDtlUrl", "bidNtceUrl"]


def find_field(item: dict, candidates):
    for key in candidates:
        if key in item and item[key]:
            return key, item[key]
    return None, None


def find_by_scan(item: dict, needle: str):
    """후보 필드명이 안 맞을 경우를 대비해, 값 전체를 훑어서 needle 을 포함하는 첫 필드를 찾는다."""
    for key, value in item.items():
        if isinstance(value, str) and needle in value:
            return key, value
    return None, None


def get_contract_method(item: dict):
    key, value = find_field(item, CONTRACT_METHOD_FIELD_CANDIDATES)
    if value:
        return value
    # fallback: 값 자체가 "협상에의한계약" 등 계약방법 문자열인 필드를 스캔
    key, value = find_by_scan(item, TARGET_CONTRACT_METHOD)
    return value or ""


def get_region(item: dict):
    key, value = find_field(item, REGION_FIELD_CANDIDATES)
    if value:
        return value
    key, value = find_by_scan(item, TARGET_REGION_KEYWORD)
    return value or ""


def get_url(item: dict):
    key, value = find_field(item, URL_FIELD_CANDIDATES)
    return value or ""


def matches_filters(item: dict) -> bool:
    region_value = get_region(item)
    if TARGET_REGION_KEYWORD not in (region_value or ""):
        return False

    title = item.get("bidNtceNm", "") or ""
    if not any(kw in title for kw in KEYWORDS):
        return False

    contract_method = get_contract_method(item)
    if TARGET_CONTRACT_METHOD not in (contract_method or ""):
        return False

    return True


def date_chunks(start: date, end: date, days: int):
    cur = start
    while cur <= end:
        chunk_end = min(cur + timedelta(days=days - 1), end)
        yield cur, chunk_end
        cur = chunk_end + timedelta(days=1)


def call_api(url: str, begin_dt: str, end_dt: str, page_no: int):
    params = {
        "ServiceKey": SERVICE_KEY,
        "inqryDiv": "1",
        "inqryBgnDt": begin_dt,
        "inqryEndDt": end_dt,
        "numOfRows": NUM_OF_ROWS,
        "pageNo": page_no,
        "type": "json",
    }
    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def collect():
    all_matched = []
    debug_saved = False

    for label, url in ENDPOINTS.items():
        for start, end in date_chunks(START_DATE, END_DATE, CHUNK_DAYS):
            begin_dt = start.strftime("%Y%m%d0000")
            end_dt = end.strftime("%Y%m%d2359")

            page_no = 1
            while True:
                try:
                    data = call_api(url, begin_dt, end_dt, page_no)
                except Exception as e:
                    print(f"[에러] {label} {begin_dt}~{end_dt} page {page_no}: {e}")
                    time.sleep(1.0)
                    break

                body = data.get("response", {}).get("body", {})
                items = body.get("items", [])
                if isinstance(items, dict):
                    items = items.get("item", [])
                if isinstance(items, dict):
                    items = [items]

                if not debug_saved and items:
                    with open(DEBUG_SAMPLE_FILE, "w", encoding="utf-8") as f:
                        json.dump(items[0], f, ensure_ascii=False, indent=2)
                    print(f"[디버그] 첫 응답 샘플을 {DEBUG_SAMPLE_FILE} 에 저장했습니다. "
                          f"계약방법/지역제한 실제 필드명을 확인하세요.")
                    debug_saved = True

                for item in items:
                    if matches_filters(item):
                        all_matched.append(item)

                total_count = int(body.get("totalCount", 0) or 0)
                print(f"{label} {begin_dt}~{end_dt} page {page_no}: "
                      f"{len(items)}건 조회 / 누적매칭 {len(all_matched)}건 (totalCount={total_count})")

                if page_no * NUM_OF_ROWS >= total_count:
                    break
                page_no += 1
                time.sleep(SLEEP_BETWEEN_CALLS)

            time.sleep(SLEEP_BETWEEN_CALLS)

    return all_matched


def save_excel(items):
    wb = Workbook()
    ws = wb.active
    ws.title = "강원_협상계약"
    ws.append([col[0] for col in COLUMNS])

    for item in items:
        row = []
        for header, field in COLUMNS:
            if header == "계약방법":
                row.append(get_contract_method(item))
            elif header == "지역제한":
                row.append(get_region(item))
            elif header == "원문 URL":
                row.append(get_url(item))
            else:
                row.append(item.get(field, ""))
        ws.append(row)

    wb.save(OUTPUT_FILE)


if __name__ == "__main__":
    matched = collect()
    save_excel(matched)
    print(f"\n완료. 총 {len(matched)}건을 {OUTPUT_FILE} 파일로 저장했습니다.")
