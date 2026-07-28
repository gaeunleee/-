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

/**
 * 특정 공고의 면허제한(참가자격) 정보를 조회해 제한그룹 목록으로 정리한다.
 * 조회 실패/데이터 없음은 예외 없이 빈 배열을 반환한다 (호출측에서 fail-open 정책으로 처리하기 위함).
 */
export async function fetchLicenseLimitGroups(env: Env, noticeNo: string, window: { begin: Date; end: Date }): Promise<LicenseLimitGroup[]> {
  try {
    const rawItems = await fetchAllPages(
      {
        baseUrl: env.naraBidBaseUrl ?? DEFAULT_BID_NOTICE_BASE_URL,
        operation: LICENSE_LIMIT_OPERATION,
        serviceKey: env.naraBidServiceKey,
        params: {
          inqryBgnDt: toApiDateTime(window.begin),
          inqryEndDt: toApiDateTime(window.end),
          bidNtceNo: noticeNo,
        },
        timeoutMs: env.apiTimeoutMs,
        maxRetries: env.apiMaxRetries,
        retryDelayMs: env.apiRetryDelayMs,
        label: `면허제한정보/${noticeNo}`,
      },
      { numOfRows: 100, maxPages: 5, requestIntervalMs: 0 }
    );

    return groupRawItems(rawItems, noticeNo);
  } catch (err) {
    logger.warn(`면허제한정보 조회 실패 (자격 필터를 건너뛰고 통과시킴)`, { noticeNo, error: toErrorMessage(err) });
    return [];
  }
}

export function groupRawItems(rawItems: RawItem[], noticeNo: string): LicenseLimitGroup[] {
  const groups = new Map<string, string[]>();

  for (const item of rawItems) {
    const groupNo = pickString(item, LICENSE_LIMIT_FIELD_CANDIDATES.groupNo);
    if (!groupNo) {
      warnMissingFieldOnce("면허제한정보", "groupNo", Object.keys(item));
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

    const existing = groups.get(groupNo) ?? [];
    groups.set(groupNo, [...existing, ...names]);
  }

  if (rawItems.length > 0 && groups.size === 0) {
    logger.warn("면허제한정보 응답은 있었지만 그룹으로 정리하지 못했습니다 (필드명 확인 필요)", { noticeNo });
  }

  return [...groups.entries()].map(([groupNo, allowedNames]) => ({ groupNo, allowedNames }));
}

/** "A, B / C" 같은 나열 텍스트를 개별 항목으로 분리 */
function splitList(text: string): string[] {
  return text
    .split(/[,\/·、]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
