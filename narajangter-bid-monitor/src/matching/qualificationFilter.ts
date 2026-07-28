import type { LicenseLimitGroup } from "../api/licenseLimitApi.js";
import type { CodeEntry } from "../config/loadJsonConfig.js";

/** 자격조건(제한그룹) 중 이 개수까지 부족해도 통과시킨다. 이 초과분부터는 제외한다. */
export const MAX_ALLOWED_MISSING_QUALIFICATIONS = 1;

export interface QualificationCheckResult {
  totalGroups: number;
  missingGroups: LicenseLimitGroup[];
  missingCount: number;
  /** 부족한 자격조건 개수가 허용 범위 이내인지 여부 */
  passes: boolean;
}

function isGroupSatisfied(group: LicenseLimitGroup, heldNames: string[]): boolean {
  return group.allowedNames.some((allowedName) =>
    heldNames.some((heldName) => allowedName.includes(heldName) || heldName.includes(allowedName))
  );
}

/**
 * 공고의 자격조건(제한그룹) 목록과 우리 회사 보유 자격(제품/업종명)을 대조한다.
 * 그룹이 없으면(=자격조건 정보가 없거나 조회 실패) 항상 통과시킨다 (fail-open).
 */
export function evaluateQualifications(groups: LicenseLimitGroup[], heldProducts: CodeEntry[], heldIndustries: CodeEntry[]): QualificationCheckResult {
  const heldNames = [...heldProducts.map((p) => p.name), ...heldIndustries.map((i) => i.name)];
  const missingGroups = groups.filter((g) => !isGroupSatisfied(g, heldNames));

  return {
    totalGroups: groups.length,
    missingGroups,
    missingCount: missingGroups.length,
    passes: missingGroups.length <= MAX_ALLOWED_MISSING_QUALIFICATIONS,
  };
}
