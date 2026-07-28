import { logger } from "../logger.js";
import { toApiDateTime } from "./dateUtil.js";
import type { FieldCandidates } from "./fieldCandidates.js";
import { fetchAllPages } from "./httpClient.js";
import { normalizeRawItem } from "./normalize.js";
import type { BusinessType, FetchResult, FetchWindow, SourceType } from "./types.js";
import { toErrorMessage } from "../errors.js";

export interface FetchNoticesConfig {
  sourceLabel: string; // "본공고" | "사전규격" (로그용)
  sourceType: SourceType;
  baseUrl: string;
  serviceKey: string;
  operations: Record<BusinessType, string>;
  fieldCandidates: FieldCandidates;
  window: FetchWindow;
  numOfRows: number;
  maxPages: number;
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  requestIntervalMs: number;
}

/**
 * 물품/용역/공사 3개 업무구분을 각각 조회한다. 한 업무구분 조회가 실패해도 나머지는 계속 진행하며
 * (부분 실패 허용), 실패 여부는 FetchResult.failed 로 리포트에 반영된다.
 */
export async function fetchNoticesBySourceType(config: FetchNoticesConfig): Promise<FetchResult[]> {
  const results: FetchResult[] = [];
  const businessTypes = Object.keys(config.operations) as BusinessType[];

  for (const businessType of businessTypes) {
    const operation = config.operations[businessType];
    const label = `${config.sourceLabel}/${businessType}`;

    try {
      const rawItems = await fetchAllPages(
        {
          baseUrl: config.baseUrl,
          operation,
          serviceKey: config.serviceKey,
          params: {
            inqryDiv: "1",
            inqryBgnDt: toApiDateTime(config.window.begin),
            inqryEndDt: toApiDateTime(config.window.end),
          },
          timeoutMs: config.timeoutMs,
          maxRetries: config.maxRetries,
          retryDelayMs: config.retryDelayMs,
          label,
        },
        {
          numOfRows: config.numOfRows,
          maxPages: config.maxPages,
          requestIntervalMs: config.requestIntervalMs,
        }
      );

      const notices = rawItems.map((raw) => normalizeRawItem(raw, businessType, config.sourceType, config.fieldCandidates));
      logger.info(`${label} 조회 완료`, { count: notices.length });
      results.push({ businessType, notices, failed: false });
    } catch (err) {
      logger.error(`${label} 조회 실패`, { error: toErrorMessage(err) });
      results.push({ businessType, notices: [], failed: true, errorMessage: err instanceof Error ? err.message : String(err) });
    }

    if (config.requestIntervalMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, config.requestIntervalMs));
    }
  }

  return results;
}

/** 조회 결과 배열에서 공고번호 기준 중복 제거 (동일 공고가 페이지 경계 등으로 중복 수집된 경우 대비) */
export function dedupeNotices(results: FetchResult[]): FetchResult[] {
  return results.map((r) => {
    const seen = new Set<string>();
    const deduped = r.notices.filter((n) => {
      if (seen.has(n.noticeNo)) return false;
      seen.add(n.noticeNo);
      return true;
    });
    return { ...r, notices: deduped };
  });
}
