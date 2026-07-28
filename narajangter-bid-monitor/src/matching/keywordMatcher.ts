import type { NormalizedNotice } from "../api/types.js";

/**
 * 공고 제목(및 품목명)에 키워드가 포함되는지 확인한다.
 * 참고: data.go.kr API는 공고 "과업내용" 상세(첨부파일)까지는 제공하지 않으므로
 * 제목/품목명 텍스트를 기준으로 매칭한다 (README 참고).
 */
export function matchKeywords(notice: NormalizedNotice, keywords: string[]): string[] {
  const haystack = `${notice.title} ${notice.productClsfcName ?? ""}`;
  const matched: string[] = [];
  for (const keyword of keywords) {
    if (haystack.includes(keyword)) {
      matched.push(keyword);
    }
  }
  return matched;
}
