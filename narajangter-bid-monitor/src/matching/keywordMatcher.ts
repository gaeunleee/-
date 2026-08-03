import type { NormalizedNotice } from "../api/types.js";

/**
 * 공고 제목 표기가 "운영 용역"/"운영용역"처럼 공백 유무만 다른 경우가 많아,
 * 매칭 전 공백을 모두 제거해 비교한다 (keywords.json 쪽 등록 문구는 공백을 넣어도/빼도 무방).
 */
function stripWhitespace(value: string): string {
  return value.replace(/\s+/g, "");
}

/**
 * 공고 제목(및 품목명)에 키워드가 포함되는지 확인한다.
 * 참고: data.go.kr API는 공고 "과업내용" 상세(첨부파일)까지는 제공하지 않으므로
 * 제목/품목명 텍스트를 기준으로 매칭한다 (README 참고).
 */
export function matchKeywords(notice: NormalizedNotice, keywords: string[]): string[] {
  const haystack = stripWhitespace(`${notice.title} ${notice.productClsfcName ?? ""}`);
  const matched: string[] = [];
  for (const keyword of keywords) {
    if (haystack.includes(stripWhitespace(keyword))) {
      matched.push(keyword);
    }
  }
  return matched;
}

/**
 * 제목에 제외 키워드가 포함되면 코드/키워드가 매칭되어도 결과에서 뺀다.
 * 일반 구매/정비/공사처럼 코드·업종상으로는 걸리지만 실제로는 전시업과 무관한 공고를 걸러내기 위함.
 */
export function matchExcludeKeyword(notice: NormalizedNotice, excludeKeywords: string[]): string | null {
  const haystack = stripWhitespace(notice.title);
  for (const keyword of excludeKeywords) {
    if (haystack.includes(stripWhitespace(keyword))) return keyword;
  }
  return null;
}
