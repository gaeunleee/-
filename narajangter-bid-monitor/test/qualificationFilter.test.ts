import { describe, expect, it } from "vitest";
import { evaluateQualifications, MAX_ALLOWED_MISSING_QUALIFICATIONS } from "../src/matching/qualificationFilter.js";
import type { LicenseLimitGroup } from "../src/api/licenseLimitApi.js";
import type { CodeEntry } from "../src/config/loadJsonConfig.js";

const heldProducts: CodeEntry[] = [{ code: "5512190301", name: "안내전광판" }];
const heldIndustries: CodeEntry[] = [
  { code: "6815", name: "전시사업자" },
  { code: "4990", name: "실내건축공사업" },
];

describe("evaluateQualifications", () => {
  it("제한그룹이 없으면(정보없음/조회실패) 항상 통과한다", () => {
    const result = evaluateQualifications([], heldProducts, heldIndustries);
    expect(result.passes).toBe(true);
    expect(result.missingCount).toBe(0);
  });

  it("모든 그룹을 보유 자격으로 충족하면 통과한다", () => {
    const groups: LicenseLimitGroup[] = [
      { groupNo: "1", allowedNames: ["전시사업자"] },
      { groupNo: "2", allowedNames: ["실내건축공사업", "금속창호·지붕건축물조립공사업"] },
    ];
    const result = evaluateQualifications(groups, heldProducts, heldIndustries);
    expect(result.passes).toBe(true);
    expect(result.missingCount).toBe(0);
  });

  it(`부족한 그룹이 ${MAX_ALLOWED_MISSING_QUALIFICATIONS}개까지는 통과한다`, () => {
    const groups: LicenseLimitGroup[] = [
      { groupNo: "1", allowedNames: ["전시사업자"] },
      { groupNo: "2", allowedNames: ["전기공사업"] }, // 미보유
    ];
    const result = evaluateQualifications(groups, heldProducts, heldIndustries);
    expect(result.missingCount).toBe(1);
    expect(result.passes).toBe(true);
  });

  it("부족한 그룹이 2개 이상이면 제외된다", () => {
    const groups: LicenseLimitGroup[] = [
      { groupNo: "1", allowedNames: ["전기공사업"] }, // 미보유
      { groupNo: "2", allowedNames: ["기계설비공사업"] }, // 미보유
      { groupNo: "3", allowedNames: ["전시사업자"] }, // 보유
    ];
    const result = evaluateQualifications(groups, heldProducts, heldIndustries);
    expect(result.missingCount).toBe(2);
    expect(result.passes).toBe(false);
    expect(result.missingGroups.map((g) => g.groupNo)).toEqual(["1", "2"]);
  });

  it("그룹 내 여러 항목 중 하나만 보유해도 그 그룹은 충족된다 (OR)", () => {
    const groups: LicenseLimitGroup[] = [{ groupNo: "1", allowedNames: ["전기공사업", "실내건축공사업", "기계설비공사업"] }];
    const result = evaluateQualifications(groups, heldProducts, heldIndustries);
    expect(result.missingCount).toBe(0);
  });
});
