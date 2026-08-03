import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigError } from "../src/errors.js";
import { _resetEnvCacheForTests, loadEnv } from "../src/config/env.js";

const REQUIRED_KEYS = [
  "NARA_BID_SERVICE_KEY",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASS",
  "NARA_PRESTD_SERVICE_KEY",
  "DRY_RUN",
  "LOOKBACK_DAYS",
  "API_NUM_OF_ROWS",
  "API_TIMEOUT_MS",
  "API_MAX_RETRIES",
  "API_RETRY_DELAY_MS",
  "SMTP_PORT",
  "LOG_LEVEL",
] as const;

describe("loadEnv", () => {
  const snapshot: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of REQUIRED_KEYS) snapshot[key] = process.env[key];
    for (const key of REQUIRED_KEYS) delete process.env[key];
    _resetEnvCacheForTests();
  });

  afterEach(() => {
    for (const key of REQUIRED_KEYS) {
      if (snapshot[key] === undefined) delete process.env[key];
      else process.env[key] = snapshot[key];
    }
    _resetEnvCacheForTests();
  });

  it("DRY_RUN=true면 API 키/SMTP 없이도 통과한다", () => {
    process.env.DRY_RUN = "true";
    const env = loadEnv();
    expect(env.dryRun).toBe(true);
    expect(env.lookbackDays).toBe(7);
  });

  it("DRY_RUN=false인데 필수 키가 없으면 ConfigError를 던진다", () => {
    process.env.DRY_RUN = "false";
    expect(() => loadEnv()).toThrow(ConfigError);
  });

  it("NARA_PRESTD_SERVICE_KEY가 없으면 NARA_BID_SERVICE_KEY를 재사용한다", () => {
    process.env.DRY_RUN = "true";
    process.env.NARA_BID_SERVICE_KEY = "bid-key";
    const env = loadEnv();
    expect(env.naraPrestdServiceKey).toBe("bid-key");
  });

  it("LOOKBACK_DAYS가 정수가 아니면 ConfigError를 던진다", () => {
    process.env.DRY_RUN = "true";
    process.env.LOOKBACK_DAYS = "abc";
    expect(() => loadEnv()).toThrow(ConfigError);
  });

  it("LOOKBACK_DAYS 범위를 벗어나면 ConfigError를 던진다", () => {
    process.env.DRY_RUN = "true";
    process.env.LOOKBACK_DAYS = "9999";
    expect(() => loadEnv()).toThrow(ConfigError);
  });

  it("API_TIMEOUT_MS 등을 지정하지 않으면 넉넉한 기본값(30초/4회 재시도)을 쓴다", () => {
    // env.ts에 기본값이 두 곳(초기 선언부/parseInt_ fallback)에 따로 있다가 한쪽만 고쳐서
    // 실제로는 옛 기본값(15초)이 쓰이던 회귀가 있었다 - 재발 방지용 테스트.
    process.env.DRY_RUN = "true";
    const env = loadEnv();
    expect(env.apiTimeoutMs).toBe(30000);
    expect(env.apiMaxRetries).toBe(4);
    expect(env.apiRetryDelayMs).toBe(1500);
  });

  it("두번째 호출부터는 캐시된 값을 반환한다", () => {
    process.env.DRY_RUN = "true";
    const a = loadEnv();
    process.env.LOOKBACK_DAYS = "30";
    const b = loadEnv();
    expect(b.lookbackDays).toBe(a.lookbackDays);
  });
});
