import { describe, expect, it } from "vitest";
import { groupRawItems } from "../src/api/licenseLimitApi.js";

describe("groupRawItems", () => {
  it("같은 제한그룹번호끼리 묶는다", () => {
    const raw = [
      { rstrctGroupNo: "1", lcnsLmtNm: "전시사업자" },
      { rstrctGroupNo: "1", lcnsLmtNm: "실내건축공사업" },
      { rstrctGroupNo: "2", lcnsLmtNm: "전기공사업" },
    ];
    const groups = groupRawItems(raw, "N-1");
    expect(groups).toHaveLength(2);
    const group1 = groups.find((g) => g.groupNo === "1");
    expect(group1?.allowedNames).toEqual(["전시사업자", "실내건축공사업"]);
  });

  it("허용업종목록이 콤마로 나열되어 있으면 개별 항목으로 분리한다", () => {
    const raw = [{ rstrctGroupNo: "1", alwIndstrytyNm: "전시사업자, 실내건축공사업 / 소프트웨어사업자" }];
    const groups = groupRawItems(raw, "N-1");
    expect(groups[0]?.allowedNames).toEqual(["전시사업자", "실내건축공사업", "소프트웨어사업자"]);
  });

  it("groupNo도 이름도 없는 항목은 무시한다", () => {
    const raw = [{ someOtherField: "x" }];
    expect(groupRawItems(raw, "N-1")).toEqual([]);
  });

  it("빈 배열이면 빈 배열을 반환한다", () => {
    expect(groupRawItems([], "N-1")).toEqual([]);
  });
});
