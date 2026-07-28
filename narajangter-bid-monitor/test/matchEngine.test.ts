import { describe, expect, it } from "vitest";
import { matchCodes } from "../src/matching/codeMatcher.js";
import { matchKeywords } from "../src/matching/keywordMatcher.js";
import { evaluateNotice, evaluateNotices, sortMatches } from "../src/matching/matchEngine.js";
import type { NormalizedNotice } from "../src/api/types.js";
import type { AppConfig } from "../src/config/loadJsonConfig.js";

function makeNotice(overrides: Partial<NormalizedNotice> = {}): NormalizedNotice {
  return {
    noticeNo: "N-1",
    title: "테스트 공고",
    institution: "테스트 기관",
    businessType: "물품",
    sourceType: "본공고",
    postedAt: "20260701",
    deadline: "20260710",
    budgetAmount: 10_000_000,
    detailUrl: "https://example.com",
    industryText: null,
    productClsfcNo: null,
    productClsfcName: null,
    raw: {},
    ...overrides,
  };
}

const config: AppConfig = {
  keywords: ["도서관", "전시"],
  productCodes: [{ code: "5512190301", name: "안내전광판" }],
  industryCodes: [{ code: "6815", name: "전시사업자" }],
  recipients: ["a@example.com"],
};

describe("matchCodes", () => {
  it("물품 공고는 세부품명번호 정확일치로 매칭된다", () => {
    const notice = makeNotice({ businessType: "물품", productClsfcNo: "5512190301" });
    const result = matchCodes(notice, config.productCodes, config.industryCodes);
    expect(result.matchedProductCodes).toHaveLength(1);
    expect(result.matchedProductCodes[0]?.code).toBe("5512190301");
  });

  it("물품 공고라도 코드가 다르면 매칭되지 않는다", () => {
    const notice = makeNotice({ businessType: "물품", productClsfcNo: "0000000000" });
    const result = matchCodes(notice, config.productCodes, config.industryCodes);
    expect(result.matchedProductCodes).toHaveLength(0);
  });

  it("용역/공사 공고는 투찰가능업종명 텍스트 부분일치로 매칭된다", () => {
    const notice = makeNotice({ businessType: "용역", industryText: "전시사업자, 이벤트업" });
    const result = matchCodes(notice, config.productCodes, config.industryCodes);
    expect(result.matchedIndustryCodes).toHaveLength(1);
    expect(result.matchedIndustryCodes[0]?.name).toBe("전시사업자");
  });

  it("industryText가 없으면 매칭되지 않는다", () => {
    const notice = makeNotice({ businessType: "공사", industryText: null });
    const result = matchCodes(notice, config.productCodes, config.industryCodes);
    expect(result.matchedIndustryCodes).toHaveLength(0);
  });
});

describe("matchKeywords", () => {
  it("제목에 키워드가 포함되면 매칭된다", () => {
    const notice = makeNotice({ title: "국립과학 도서관 리모델링 공사" });
    expect(matchKeywords(notice, config.keywords)).toEqual(["도서관"]);
  });

  it("여러 키워드가 매칭되면 모두 반환한다", () => {
    const notice = makeNotice({ title: "도서관 전시 공간 조성" });
    expect(matchKeywords(notice, config.keywords)).toEqual(["도서관", "전시"]);
  });

  it("키워드가 없으면 빈 배열을 반환한다", () => {
    const notice = makeNotice({ title: "도로 포장 공사" });
    expect(matchKeywords(notice, config.keywords)).toEqual([]);
  });
});

describe("evaluateNotice / confidence", () => {
  it("코드+키워드 모두 매칭되면 강력추천이다", () => {
    const notice = makeNotice({
      businessType: "물품",
      productClsfcNo: "5512190301",
      title: "전시 안내전광판 설치",
    });
    const result = evaluateNotice(notice, config);
    expect(result).not.toBeNull();
    expect(result?.confidence).toBe("강력추천");
  });

  it("코드만 매칭되면 참고용이다", () => {
    const notice = makeNotice({
      businessType: "물품",
      productClsfcNo: "5512190301",
      title: "안내표시장치 구매",
    });
    const result = evaluateNotice(notice, config);
    expect(result?.confidence).toBe("참고용");
  });

  it("키워드만 매칭되면 참고용이다", () => {
    const notice = makeNotice({ businessType: "물품", productClsfcNo: null, title: "도서관 리모델링" });
    const result = evaluateNotice(notice, config);
    expect(result?.confidence).toBe("참고용");
  });

  it("아무것도 매칭되지 않으면 null이다", () => {
    const notice = makeNotice({ businessType: "물품", productClsfcNo: null, title: "도로 포장 공사" });
    expect(evaluateNotice(notice, config)).toBeNull();
  });

  it("evaluateNotices는 매칭된 공고만 필터링한다", () => {
    const notices = [
      makeNotice({ title: "도서관 신축", noticeNo: "A" }),
      makeNotice({ title: "도로 공사", noticeNo: "B" }),
    ];
    const result = evaluateNotices(notices, config);
    expect(result).toHaveLength(1);
    expect(result[0]?.notice.noticeNo).toBe("A");
  });
});

describe("sortMatches", () => {
  it("강력추천을 참고용보다 앞에 정렬한다", () => {
    const weak = evaluateNotice(makeNotice({ title: "도서관", noticeNo: "weak" }), config)!;
    const strong = evaluateNotice(
      makeNotice({ title: "도서관 전시 안내전광판", productClsfcNo: "5512190301", noticeNo: "strong" }),
      config
    )!;
    const sorted = sortMatches([weak, strong]);
    expect(sorted[0]?.notice.noticeNo).toBe("strong");
  });
});
