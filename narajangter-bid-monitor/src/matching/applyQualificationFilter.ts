import type { Env } from "../config/env.js";
import type { AppConfig } from "../config/loadJsonConfig.js";
import { fetchLicenseLimitGroups } from "../api/licenseLimitApi.js";
import { logger } from "../logger.js";
import { evaluateQualifications } from "./qualificationFilter.js";
import type { MatchedNotice } from "./types.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 본공고 매칭 결과에 자격조건(면허제한) 필터를 적용한다.
 * 사전규격은 대응하는 면허제한 조회 API가 없어 이 필터 대상에서 제외한다(그대로 통과).
 * 공고 1건당 API 호출이 1회 추가되므로, 이미 코드/키워드로 걸러진 매칭 결과에 대해서만 순차 조회한다.
 */
export async function applyQualificationFilter(
  env: Env,
  appConfig: AppConfig,
  matches: MatchedNotice[],
  window: { begin: Date; end: Date }
): Promise<MatchedNotice[]> {
  const kept: MatchedNotice[] = [];
  let excludedCount = 0;

  for (const match of matches) {
    const groups = await fetchLicenseLimitGroups(env, match.notice.noticeNo, window);
    if (groups.length === 0) {
      // 자격조건 정보가 없거나 조회 실패 -> fail-open (통과)
      kept.push(match);
    } else {
      const result = evaluateQualifications(groups, appConfig.heldProducts, appConfig.heldIndustries);
      if (result.passes) {
        kept.push(match);
      } else {
        excludedCount += 1;
        logger.debug("자격조건 부족으로 제외", {
          noticeNo: match.notice.noticeNo,
          title: match.notice.title,
          missingCount: result.missingCount,
          totalGroups: result.totalGroups,
        });
      }
    }

    if (env.apiRequestIntervalMs > 0) {
      await sleep(env.apiRequestIntervalMs);
    }
  }

  logger.info("자격조건 필터 적용 완료", {
    대상: matches.length,
    통과: kept.length,
    제외: excludedCount,
  });

  return kept;
}
