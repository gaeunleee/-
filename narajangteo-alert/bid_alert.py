"""
나라장터(조달청) 입찰공고 자동 알림
- 용역/공사 두 API를 최근 며칠 구간으로 조회
- 회사 조건(주식회사 지일, 경쟁입찰참가자격등록증 기준)에 맞는 공고만 골라서
  아직 알림 보낸 적 없는 건에 한해 이메일로 발송한다.
- GitHub Actions 스케줄러가 주기적으로 이 스크립트를 실행한다.

회사 조건 (2025-08-28 발급 경쟁입찰참가자격등록증 기준):
  - 본사: 강원특별자치도 정선군 / 공장: 경기도 남양주시
  - 실내건축공사업 시공능력평가액: 4,835,195,000원
  - 금속창호·지붕건축물조립공사업 시공능력평가액: 3,593,485,000원

환경변수(GitHub Secrets)로 전달:
  PPS_SERVICE_KEY   나라장터 오픈API 인증키
  GMAIL_ADDRESS     발신 Gmail 주소
  GMAIL_APP_PASSWORD Gmail 앱 비밀번호 (일반 로그인 비밀번호 아님)
  ALERT_TO          수신 이메일 (미설정 시 GMAIL_ADDRESS로 발송)
"""

import os
import io
import json
import time
import smtplib
from datetime import date, datetime, timedelta
from email.mime.text import MIMEText
from pathlib import Path

import requests

SERVICE_KEY = os.environ["PPS_SERVICE_KEY"]
GMAIL_ADDRESS = os.environ["GMAIL_ADDRESS"]
GMAIL_APP_PASSWORD = os.environ["GMAIL_APP_PASSWORD"]
ALERT_TO = os.environ.get("ALERT_TO", GMAIL_ADDRESS)

ENDPOINTS = {
    "용역": "http://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoServcPPSSrch",
    "공사": "http://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoCnstwkPPSSrch",
}

KEYWORDS = ["전시", "체험", "제작설치", "전시관", "체험관", "콘텐츠", "미디어아트", "조성", "디자인", "도서관", "조형물"]

# 지역제한 조건: 지역제한이 없거나(전국 개방), 본사(강원)·공장(경기) 소재지가 포함되면 자격 있음
ALLOWED_REGION_KEYWORDS = ["강원", "경기"]

# 공사 공고에 한해 적용하는 시공능력평가액 상한 (초과하면 참가자격 미달)
CONSTRUCTION_BUDGET_CAP = 4_835_195_000  # 실내건축공사업 시공능력평가액 기준(2개 업종 중 상한값)

NUM_OF_ROWS = 999
LOOKBACK_DAYS = 3  # 스케줄 간격보다 넉넉하게 겹쳐서 조회 (누락 방지)
SLEEP_BETWEEN_CALLS = 0.4

STATE_FILE = Path(__file__).parent / "seen_bids.json"

CONTRACT_METHOD_FIELD_CANDIDATES = ["cntrctCnclsMthdNm", "cntrctMthdNm", "cntrctCnclsSttusNm"]
REGION_FIELD_CANDIDATES = ["prtcptPsblRgnNm", "rgnLmtBidLocplcJdgmBssNm", "rgstTyNm"]
URL_FIELD_CANDIDATES = ["bidNtceDtlUrl", "bidNtceUrl"]


def find_field(item, candidates):
    for key in candidates:
        if item.get(key):
            return item[key]
    return None


def get_contract_method(item):
    return find_field(item, CONTRACT_METHOD_FIELD_CANDIDATES) or ""


def get_region(item):
    return find_field(item, REGION_FIELD_CANDIDATES) or ""


def get_url(item):
    return find_field(item, URL_FIELD_CANDIDATES) or ""


def region_qualifies(region_value: str) -> bool:
    if not region_value or region_value.strip() in ("", "전국", "제한없음"):
        return True
    return any(kw in region_value for kw in ALLOWED_REGION_KEYWORDS)


def budget_qualifies(item: dict, service_label: str) -> bool:
    if service_label != "공사":
        return True
    raw = item.get("presmptPrce", "")
    try:
        amount = float(str(raw).replace(",", ""))
    except (TypeError, ValueError):
        return True  # 금액 정보가 없으면 걸러내지 않고 통과시킨다
    if amount <= 0:
        return True
    return amount <= CONSTRUCTION_BUDGET_CAP


def matches_filters(item: dict, service_label: str) -> bool:
    title = item.get("bidNtceNm", "") or ""
    if not any(kw in title for kw in KEYWORDS):
        return False
    if not region_qualifies(get_region(item)):
        return False
    if not budget_qualifies(item, service_label):
        return False
    return True


def call_api(url, begin_dt, end_dt, page_no):
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


def extract_items(data):
    body = data.get("response", {}).get("body", {})
    items = body.get("items", [])
    if isinstance(items, dict):
        items = items.get("item", [])
    if isinstance(items, dict):
        items = [items]
    total_count = int(body.get("totalCount", 0) or 0)
    return items, total_count


def load_seen():
    if STATE_FILE.exists():
        return set(json.loads(STATE_FILE.read_text(encoding="utf-8")))
    return set()


def save_seen(seen: set):
    STATE_FILE.write_text(json.dumps(sorted(seen), ensure_ascii=False, indent=2), encoding="utf-8")


def collect_new_matches():
    seen = load_seen()
    new_items = []

    end_date = date.today()
    start_date = end_date - timedelta(days=LOOKBACK_DAYS)
    begin_dt = start_date.strftime("%Y%m%d0000")
    end_dt = end_date.strftime("%Y%m%d2359")

    for label, url in ENDPOINTS.items():
        page_no = 1
        while True:
            data = call_api(url, begin_dt, end_dt, page_no)
            items, total_count = extract_items(data)

            for item in items:
                bid_no = item.get("bidNtceNo", "")
                bid_ord = item.get("bidNtceOrd", "")
                uid = f"{bid_no}-{bid_ord}"
                if uid in seen:
                    continue
                if matches_filters(item, label):
                    new_items.append(item)
                seen.add(uid)

            if page_no * NUM_OF_ROWS >= total_count:
                break
            page_no += 1
            time.sleep(SLEEP_BETWEEN_CALLS)

        time.sleep(SLEEP_BETWEEN_CALLS)

    save_seen(seen)
    return new_items


def format_email_body(items):
    lines = [f"조건에 맞는 새 입찰공고 {len(items)}건을 찾았습니다.\n"]
    for item in items:
        lines.append(
            "-----------------------------\n"
            f"공고명: {item.get('bidNtceNm', '')}\n"
            f"공고번호: {item.get('bidNtceNo', '')}\n"
            f"발주기관: {item.get('ntceInsttNm', '')}\n"
            f"수요기관: {item.get('dminsttNm', '')}\n"
            f"계약방법: {get_contract_method(item)}\n"
            f"추정가격: {item.get('presmptPrce', '')}\n"
            f"공고일: {item.get('bidNtceDt', '')}\n"
            f"입찰마감일: {item.get('bidClseDt', '')}\n"
            f"지역제한: {get_region(item)}\n"
            f"원문 URL: {get_url(item)}\n"
        )
    return "\n".join(lines)


def send_email(subject: str, body: str):
    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = GMAIL_ADDRESS
    msg["To"] = ALERT_TO

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
        server.send_message(msg)


def main():
    new_items = collect_new_matches()
    print(f"[{datetime.now().isoformat(timespec='seconds')}] 새로 매칭된 공고 {len(new_items)}건")

    if new_items:
        subject = f"[나라장터 알림] 신규 입찰공고 {len(new_items)}건"
        body = format_email_body(new_items)
        send_email(subject, body)
        print("이메일 발송 완료")
    else:
        print("새로 알림 보낼 공고 없음")


if __name__ == "__main__":
    main()
