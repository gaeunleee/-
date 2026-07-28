import "dotenv/config";
import { ConfigError } from "../errors.js";

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw.trim() === "") return fallback;
  const v = raw.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(v)) return true;
  if (["false", "0", "no", "n"].includes(v)) return false;
  throw new ConfigError(`불리언 값이 올바르지 않습니다: "${raw}" (true/false 사용)`);
}

function parseInt_(raw: string | undefined, fallback: number, key: string, min: number, max: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n)) {
    throw new ConfigError(`${key}는 정수여야 합니다. 현재 값: "${raw}"`);
  }
  if (n < min || n > max) {
    throw new ConfigError(`${key}는 ${min}~${max} 범위여야 합니다. 현재 값: ${n}`);
  }
  return n;
}

function parseLogLevel(raw: string | undefined): "debug" | "info" | "warn" | "error" {
  const v = (raw ?? "info").trim().toLowerCase();
  if (v === "debug" || v === "info" || v === "warn" || v === "error") return v;
  throw new ConfigError(`LOG_LEVEL은 debug|info|warn|error 중 하나여야 합니다. 현재 값: "${raw}"`);
}

export interface Env {
  naraBidServiceKey: string;
  naraPrestdServiceKey: string;
  naraBidBaseUrl?: string;
  naraPrestdBaseUrl?: string;

  lookbackDays: number;
  apiNumOfRows: number;
  apiMaxPages: number;
  apiTimeoutMs: number;
  apiMaxRetries: number;
  apiRetryDelayMs: number;
  apiRequestIntervalMs: number;

  sendEmptyReport: boolean;
  alertEmailOnFailure: boolean;
  dryRun: boolean;
  logLevel: "debug" | "info" | "warn" | "error";

  smtpHost?: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom: string;
}

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;

  const e = process.env;
  const errors: string[] = [];

  const dryRun = parseBool(e.DRY_RUN, false);

  const naraBidServiceKey = (e.NARA_BID_SERVICE_KEY ?? "").trim();
  if (!dryRun && !naraBidServiceKey) {
    errors.push("NARA_BID_SERVICE_KEY가 설정되지 않았습니다. (.env 파일을 확인하거나 DRY_RUN=true로 실행하세요)");
  }
  const naraPrestdServiceKey = (e.NARA_PRESTD_SERVICE_KEY ?? "").trim() || naraBidServiceKey;

  const smtpHost = e.SMTP_HOST?.trim() || undefined;
  const smtpUser = e.SMTP_USER?.trim() || undefined;
  const smtpPass = e.SMTP_PASS || undefined;
  if (!dryRun) {
    if (!smtpHost) errors.push("SMTP_HOST가 설정되지 않았습니다.");
    if (!smtpUser) errors.push("SMTP_USER가 설정되지 않았습니다.");
    if (!smtpPass) errors.push("SMTP_PASS가 설정되지 않았습니다.");
  }

  let lookbackDays = 7;
  let apiNumOfRows = 500;
  let apiMaxPages = 40;
  let apiTimeoutMs = 15000;
  let apiMaxRetries = 3;
  let apiRetryDelayMs = 1000;
  let apiRequestIntervalMs = 300;
  let smtpPort = 587;
  let logLevel: Env["logLevel"] = "info";

  try {
    lookbackDays = parseInt_(e.LOOKBACK_DAYS, 7, "LOOKBACK_DAYS", 1, 90);
    apiNumOfRows = parseInt_(e.API_NUM_OF_ROWS, 500, "API_NUM_OF_ROWS", 1, 999);
    apiMaxPages = parseInt_(e.API_MAX_PAGES, 40, "API_MAX_PAGES", 1, 500);
    apiTimeoutMs = parseInt_(e.API_TIMEOUT_MS, 15000, "API_TIMEOUT_MS", 1000, 120000);
    apiMaxRetries = parseInt_(e.API_MAX_RETRIES, 3, "API_MAX_RETRIES", 0, 10);
    apiRetryDelayMs = parseInt_(e.API_RETRY_DELAY_MS, 1000, "API_RETRY_DELAY_MS", 0, 60000);
    apiRequestIntervalMs = parseInt_(e.API_REQUEST_INTERVAL_MS, 300, "API_REQUEST_INTERVAL_MS", 0, 60000);
    smtpPort = parseInt_(e.SMTP_PORT, 587, "SMTP_PORT", 1, 65535);
    logLevel = parseLogLevel(e.LOG_LEVEL);
  } catch (err) {
    errors.push(err instanceof ConfigError ? err.message : String(err));
  }

  if (errors.length > 0) {
    throw new ConfigError(`환경변수 검증 실패:\n${errors.map((m) => `  - ${m}`).join("\n")}`);
  }

  const smtpFrom = e.SMTP_FROM?.trim() || smtpUser || "";

  cached = {
    naraBidServiceKey,
    naraPrestdServiceKey,
    naraBidBaseUrl: e.NARA_BID_BASE_URL?.trim() || undefined,
    naraPrestdBaseUrl: e.NARA_PRESTD_BASE_URL?.trim() || undefined,

    lookbackDays,
    apiNumOfRows,
    apiMaxPages,
    apiTimeoutMs,
    apiMaxRetries,
    apiRetryDelayMs,
    apiRequestIntervalMs,

    sendEmptyReport: parseBool(e.SEND_EMPTY_REPORT, true),
    alertEmailOnFailure: parseBool(e.ALERT_EMAIL_ON_FAILURE, true),
    dryRun,
    logLevel,

    smtpHost,
    smtpPort,
    smtpSecure: parseBool(e.SMTP_SECURE, false),
    smtpUser,
    smtpPass,
    smtpFrom,
  };

  return cached;
}

/** 테스트에서 캐시를 리셋하기 위한 헬퍼 */
export function _resetEnvCacheForTests(): void {
  cached = null;
}
