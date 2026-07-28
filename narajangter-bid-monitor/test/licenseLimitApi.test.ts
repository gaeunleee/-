import { describe, expect, it } from "vitest";
import { groupRawItemsByNotice } from "../src/api/licenseLimitApi.js";

describe("groupRawItemsByNotice", () => {
  it("공고번호별로 나누고, 같은 제한그룹번호끼리 묶는다", () => {
    const raw = [
      { bidNtceNo: "N-1", rstrctGroupNo: "1", lcnsLmtNm: "전시사업자" },
      { bidNtceNo: "N-1", rstrctGroupNo: "1", lcnsLmtNm: "실내건축공사업" },
      { bidNtceNo: "N-1", rstrctGroupNo: "2", lcnsLmtNm: "전기공사업" },
      { bidNtceNo: "N-2", rstrctGroupNo: "1", lcnsLmtNm: "소프트웨어사업자" },
    ];
    const byNotice = groupRawItemsByNotice(raw);
    expect(byNotice.size).toBe(2);

    const n1Groups = byNotice.get("N-1") ?? [];
    expect(n1Groups).toHaveLength(2);
    expect(n1Groups.find((g) => g.groupNo === "1")?.allowedNames).toEqual(["전시사업자", "실내건축공사업"]);
    expect(n1Groups.find((g) => g.groupNo === "2")?.allowedNames).toEqual(["전기공사업"]);

    const n2Groups = byNotice.get("N-2") ?? [];
    expect(n2Groups).toEqual([{ groupNo: "1", allowedNames: ["소프트웨어사업자"] }]);
  });

  it("실제 확인된 필드명(lmtGrpNo, permsnIndstrytyList)으로도 정상 파싱된다", () => {
    const raw = [{ bidNtceNo: "N-1", lmtGrpNo: "1", permsnIndstrytyList: "전시사업자, 실내건축공사업" }];
    const byNotice = groupRawItemsByNotice(raw);
    expect(byNotice.get("N-1")).toEqual([{ groupNo: "1", allowedNames: ["전시사업자", "실내건축공사업"] }]);
  });

  it("허용업종목록이 콤마/슬래시로 나열되어 있으면 개별 항목으로 분리한다", () => {
    const raw = [{ bidNtceNo: "N-1", rstrctGroupNo: "1", alwIndstrytyNm: "전시사업자, 실내건축공사업 / 소프트웨어사업자" }];
    const byNotice = groupRawItemsByNotice(raw);
    expect(byNotice.get("N-1")?.[0]?.allowedNames).toEqual(["전시사업자", "실내건축공사업", "소프트웨어사업자"]);
  });

  it("공고번호나 그룹번호가 없는 항목은 무시한다", () => {
    const raw = [{ someOtherField: "x" }, { bidNtceNo: "N-1" /* groupNo 없음 */ }];
    expect(groupRawItemsByNotice(raw).size).toBe(0);
  });

  it("빈 배열이면 빈 Map을 반환한다", () => {
    expect(groupRawItemsByNotice([]).size).toBe(0);
  });
});
