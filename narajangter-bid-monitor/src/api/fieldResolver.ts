import { logger } from "../logger.js";

export type RawItem = Record<string, unknown>;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** candidates 중 값이 채워진 첫 필드를 반환. 못 찾으면 접미사(Nm 등) 기반 휴리스틱으로 재시도. */
export function pickString(item: RawItem, candidates: string[], suffixFallback?: string): string | null {
  for (const key of candidates) {
    const v = item[key];
    if (isNonEmptyString(v)) return v.trim();
  }
  if (suffixFallback) {
    for (const [key, value] of Object.entries(item)) {
      if (key.endsWith(suffixFallback) && isNonEmptyString(value)) return value.trim();
    }
  }
  return null;
}

export function pickNumber(item: RawItem, candidates: string[]): number | null {
  for (const key of candidates) {
    const v = item[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (isNonEmptyString(v)) {
      const cleaned = v.replace(/,/g, "").trim();
      const n = Number(cleaned);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

const warnedOnce = new Set<string>();

/** 필드 후보를 모두 찾지 못했을 때 세션당 1회만 경고 로그를 남겨 로그 폭주를 막는다. */
export function warnMissingFieldOnce(context: string, field: string, rawKeys: string[]): void {
  const dedupeKey = `${context}:${field}`;
  if (warnedOnce.has(dedupeKey)) return;
  warnedOnce.add(dedupeKey);
  logger.warn(`API 응답에서 "${field}" 필드를 찾지 못했습니다. 후보 필드명을 확인해주세요.`, {
    context,
    field,
    availableKeys: rawKeys,
  });
}
