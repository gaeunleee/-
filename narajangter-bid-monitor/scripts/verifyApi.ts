/**
 * 실제 API 키를 받은 뒤 가장 먼저 실행해볼 진단 스크립트.
 * 6개 오퍼레이션(본공고/사전규격 x 물품/용역/공사)을 각각 소량으로 호출해
 * 정상 연결되는지, 응답 필드명이 src/api/fieldCandidates.ts 의 후보와 일치하는지 확인한다.
 *
 * 실행: npm run verify:api
 */
import { loadEnv } from "../src/config/env.js";
import { fetchAllPages } from "../src/api/httpClient.js";
import { toApiDateTime, lookbackWindow } from "../src/api/dateUtil.js";
import { BID_NOTICE_OPERATIONS, DEFAULT_BID_NOTICE_BASE_URL, DEFAULT_PRE_STANDARD_BASE_URL, PRE_STANDARD_OPERATIONS } from "../src/api/endpoints.js";
import type { BusinessType } from "../src/api/types.js";

async function verifyOne(label: string, baseUrl: string, operation: string, serviceKey: string, window: { begin: Date; end: Date }) {
  console.log(`\n===== ${label} (${operation}) =====`);
  try {
    const items = await fetchAllPages(
      {
        baseUrl,
        operation,
        serviceKey,
        params: {
          inqryDiv: "1",
          inqryBgnDt: toApiDateTime(window.begin),
          inqryEndDt: toApiDateTime(window.end),
        },
        timeoutMs: 15000,
        maxRetries: 1,
        retryDelayMs: 500,
        label,
      },
      { numOfRows: 5, maxPages: 1, requestIntervalMs: 0 }
    );
    console.log(`  결과 ${items.length}건 수신`);
    if (items.length > 0) {
      console.log("  첫 항목 필드 목록:", Object.keys(items[0] as object));
      console.log("  첫 항목 원본:", JSON.stringify(items[0], null, 2));
    } else {
      console.log("  (조회 기간 내 데이터 없음 - 정상일 수 있음. 기간을 늘려 재시도해보세요)");
    }
  } catch (err) {
    console.error(`  ❌ 실패: ${err instanceof Error ? err.message : err}`);
  }
}

async function main() {
  const env = loadEnv();
  const window = lookbackWindow(new Date(), Math.max(env.lookbackDays, 14));
  const businessTypes: BusinessType[] = ["물품", "용역", "공사"];

  for (const bt of businessTypes) {
    await verifyOne(
      `본공고/${bt}`,
      env.naraBidBaseUrl ?? DEFAULT_BID_NOTICE_BASE_URL,
      BID_NOTICE_OPERATIONS[bt],
      env.naraBidServiceKey,
      window
    );
  }

  for (const bt of businessTypes) {
    await verifyOne(
      `사전규격/${bt}`,
      env.naraPrestdBaseUrl ?? DEFAULT_PRE_STANDARD_BASE_URL,
      PRE_STANDARD_OPERATIONS[bt],
      env.naraPrestdServiceKey,
      window
    );
  }

  console.log("\n진단 완료. 필드명이 기대와 다르면 src/api/fieldCandidates.ts 에 실제 필드명을 후보로 추가하세요.");
}

main().catch((err) => {
  console.error("진단 스크립트 실행 실패:", err);
  process.exitCode = 1;
});
