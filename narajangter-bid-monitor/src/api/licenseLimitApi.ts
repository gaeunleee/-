import type { Env } from "../config/env.js";
import { LICENSE_LIMIT_FIELD_CANDIDATES } from "./fieldCandidates.js";
import { pickString, warnMissingFieldOnce, type RawItem } from "./fieldResolver.js";
import { fetchAllPages } from "./httpClient.js";
import { DEFAULT_BID_NOTICE_BASE_URL, LICENSE_LIMIT_OPERATION } from "./endpoints.js";
import { toApiDateTime } from "./dateUtil.js";
import { logger } from "../logger.js";
import { toErrorMessage } from "../errors.js";

/** 제한그룹 하나(=자격조건 하나). 그룹 내 항목 중 하나라도 우리가 보유하면 그 그룹은 충족된 것으로 본다. */
export interface LicenseLimitGroup {
  groupNo: string;
  /** 해당 그룹에서 허용되는 업종/면허명 목록 (이 중 하나라도 보유하면 충족) */
  allowedNames: string[];
}

/** "A, B / C" 같은 나열 텍스트를 개별 항목으로 분리 */
function splitList(text: string): string[] {
  return text
    .split(/[,\/·、]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * 면허제한정보조회 원본 응답을 입찰공고번호별 제한그룹 목록으로 정리한다.
 *
 * 주의: 이 오퍼레이션은 bidNtceNo 파라미터를 서버가 필터링해주지 않고 조회기간 내 전체를
 * 페이지 단위로 내려준다(2026-07-28 실측 확인). 그래서 공고 1건씩 호출하는 대신
 * 조회기간 전체를 한 번에 받아 여기서 공고번호별로 묶어 로컬에서 조회하는 방식으로 설계했다.
 */
export function groupRawItemsByNotice(rawItems: RawItem[]): Map<string, LicenseLimitGroup[]> {
  const byNotice = new Map<string, Map<string, string[]>>();

  for (const item of rawItems) {
    const noticeNo = pickString(item, LICENSE_LIMIT_FIELD_CANDIDATES.noticeNo);
    const groupNo = pickString(item, LICENSE_LIMIT_FIELD_CANDIDATES.groupNo);
    if (!noticeNo || !groupNo) {
      warnMissingFieldOnce("면허제한정보", "noticeNo/groupNo", Object.keys(item));
      continue;
    }

    const names: string[] = [];
    const licenseLimitName = pickString(item, LICENSE_LIMIT_FIELD_CANDIDATES.licenseLimitName);
    if (licenseLimitName) names.push(licenseLimitName);
    const allowedIndustryList = pickString(item, LICENSE_LIMIT_FIELD_CANDIDATES.allowedIndustryList);
    if (allowedIndustryList) names.push(...splitList(allowedIndustryList));

    if (names.length === 0) {
      warnMissingFieldOnce("면허제한정보", "licenseLimitName/allowedIndustryList", Object.keys(item));
      continue;
    }

    const groupsForNotice = byNotice.get(noticeNo) ?? new Map<string, string[]>();
    groupsForNotice.set(groupNo, [...(groupsForNotice.get(groupNo) ?? []), ...names]);
    byNotice.set(noticeNo, groupsForNotice);
  }

  const result = new Map<string, LicenseLimitGroup[]>();
  for (const [noticeNo, groupsForNotice] of byNotice) {
    result.set(
      noticeNo,
      [...groupsForNotice.entries()].map(([groupNo, allowedNames]) => ({ groupNo, allowedNames }))
    );
  }
  return result;
}

/**
 * 조회기간 내 전체 면허제한정보를 한 번에 받아 입찰공고번호별로 정리해 반환한다.
 * 조회 실패 시 예외 없이 빈 Map을 반환한다 (호출측에서 fail-open 정책으로 처리하기 위함).
 */
export async function fetchAllLicenseLimitGroups(env: Env, window: { begin: Date; end: Date }): Promise<Map<string, LicenseLimitGroup[]>> {
  try {
    const rawItems = await fetchAllPages(
      {
        baseUrl: env.naraBidBaseUrl ?? DEFAULT_BID_NOTICE_BASE_URL,
        operation: LICENSE_LIMIT_OPERATION,
        serviceKey: env.naraBidServiceKey,
        params: {
          inqryDiv: "1",
          inqryBgnDt: toApiDateTime(window.begin),
          inqryEndDt: toApiDateTime(window.end),
        },
        timeoutMs: env.apiTimeoutMs,
        maxRetries: env.apiMaxRetries,
        retryDelayMs: env.apiRetryDelayMs,
        label: "면허제한정보",
      },
      { numOfRows: env.apiNumOfRows, maxPages: env.apiMaxPages, requestIntervalMs: env.apiRequestIntervalMs }
    );

    logger.info("면허제한정보 전체 조회 완료", { rawCount: rawItems.length });
    return groupRawItemsByNotice(rawItems);
  } catch (err) {
    logger.warn("면허제한정보 조회 실패 (자격조건 필터를 건너뛰고 모두 통과시킴)", { error: toErrorMessage(err) });
    return new Map();
  }
}
