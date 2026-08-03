import type { NormalizedNotice } from "../api/types.js";
import type { AppConfig } from "../config/loadJsonConfig.js";
import { matchCodes } from "./codeMatcher.js";
import { matchExcludeKeyword, matchKeywords } from "./keywordMatcher.js";
import type { MatchedNotice } from "./types.js";

/**
 * 공고 하나를 코드+키워드 기준으로 평가하고 결과를 반환한다 (매칭 안 되면 null).
 *
 * 세부품명번호(물품)는 정확일치라 정밀도가 높아 단독으로도 포함시키지만,
 * 업종코드(용역/공사)는 "투찰가능업종명" 텍스트 부분일치라 정밀도가 낮다 — 무관한 공사도
 * 참가 가능 업종 중 하나로 "실내건축공사업" 등을 폭넓게 포함하는 경우가 많기 때문이다.
 * 따라서 업종코드는 제목 키워드가 함께 매칭될 때만 결과에 포함시킨다 (단독으로는 제외).
 */
export function evaluateNotice(notice: NormalizedNotice, config: AppConfig): MatchedNotice | null {
  if (matchExcludeKeyword(notice, config.excludeKeywords)) return null;

  if (config.minBudgetAmount != null && notice.budgetAmount != null && notice.budgetAmount < config.minBudgetAmount) {
    return null;
  }

  const { matchedProductCodes, matchedIndustryCodes } = matchCodes(notice, config.productCodes, config.industryCodes);
  const matchedKeywords = matchKeywords(notice, config.keywords);

  const productCodeMatched = matchedProductCodes.length > 0;
  const industryCodeMatched = matchedIndustryCodes.length > 0;
  const keywordMatched = matchedKeywords.length > 0;

  if (!productCodeMatched && !keywordMatched) return null;

  const codeMatched = productCodeMatched || industryCodeMatched;

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
