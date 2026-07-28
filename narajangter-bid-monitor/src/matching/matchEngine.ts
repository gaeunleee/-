import type { NormalizedNotice } from "../api/types.js";
import type { AppConfig } from "../config/loadJsonConfig.js";
import { matchCodes } from "./codeMatcher.js";
import { matchExcludeKeyword, matchKeywords } from "./keywordMatcher.js";
import type { MatchedNotice } from "./types.js";

/** 공고 하나를 코드+키워드 기준으로 평가하고, 둘 중 하나라도 매칭되면 결과를 반환한다 (아니면 null). */
export function evaluateNotice(notice: NormalizedNotice, config: AppConfig): MatchedNotice | null {
  if (matchExcludeKeyword(notice, config.excludeKeywords)) return null;

  const { matchedProductCodes, matchedIndustryCodes } = matchCodes(notice, config.productCodes, config.industryCodes);
  const matchedKeywords = matchKeywords(notice, config.keywords);

  const codeMatched = matchedProductCodes.length > 0 || matchedIndustryCodes.length > 0;
  const keywordMatched = matchedKeywords.length > 0;

  if (!codeMatched && !keywordMatched) return null;

  return {
    notice,
    matchedProductCodes,
    matchedIndustryCodes,
    matchedKeywords,
    confidence: codeMatched && keywordMatched ? "강력추천" : "참고용",
  };
}

export function evaluateNotices(notices: NormalizedNotice[], config: AppConfig): MatchedNotice[] {
  const matched: MatchedNotice[] = [];
  for (const notice of notices) {
    const result = evaluateNotice(notice, config);
    if (result) matched.push(result);
  }
  return matched;
}

/** 강력추천 우선, 그 다음 마감일(있으면) 빠른 순으로 정렬 */
export function sortMatches(matches: MatchedNotice[]): MatchedNotice[] {
  return [...matches].sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return a.confidence === "강력추천" ? -1 : 1;
    }
    const da = a.notice.deadline ?? "";
    const db = b.notice.deadline ?? "";
    return da.localeCompare(db);
  });
}
