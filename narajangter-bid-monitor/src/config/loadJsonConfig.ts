import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ConfigError } from "../errors.js";

// npm 스크립트는 항상 프로젝트 루트(narajangter-bid-monitor/)에서 실행되므로 cwd 기준으로 찾는다.
// (tsx로 src에서 직접 실행하든, tsc로 컴파일된 dist에서 실행하든 경로가 흔들리지 않도록 하기 위함)
// 필요 시 APP_CONFIG_DIR 환경변수로 재정의할 수 있다.
// 호출 시점에 평가해야 테스트 등에서 실행 도중 환경변수를 바꿔도 반영된다.
function resolveConfigDir(): string {
  return process.env.APP_CONFIG_DIR
    ? path.resolve(process.env.APP_CONFIG_DIR)
    : path.resolve(process.cwd(), "config");
}

const emailSchema = z.string().trim().email();

const codeEntrySchema = z.object({
  code: z.string().trim().min(1, "code는 비어있을 수 없습니다"),
  name: z.string().trim().min(1, "name은 비어있을 수 없습니다"),
});

const keywordsFileSchema = z.object({
  keywords: z.array(z.string().trim().min(1)).min(1, "keywords 배열이 비어있습니다"),
  excludeKeywords: z.array(z.string().trim().min(1)).default([]),
});

const codesFileSchema = z.object({
  productCodes: z.array(codeEntrySchema).min(1, "productCodes 배열이 비어있습니다"),
  industryCodes: z.array(codeEntrySchema).min(1, "industryCodes 배열이 비어있습니다"),
});

const recipientsFileSchema = z.object({
  recipients: z.array(emailSchema).min(1, "recipients 배열이 비어있습니다 (최소 1명 필요)"),
});

function readJsonFile(filePath: string): unknown {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new ConfigError(`설정 파일을 읽을 수 없습니다: ${filePath}\n${err instanceof Error ? err.message : err}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new ConfigError(`설정 파일 JSON 파싱 실패: ${filePath}\n${err instanceof Error ? err.message : err}`);
  }
}

function parseOrThrow<S extends z.ZodTypeAny>(schema: S, data: unknown, filePath: string): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new ConfigError(`설정 파일 검증 실패: ${filePath}\n${details}`);
  }
  return result.data;
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) dupes.add(v);
    seen.add(v);
  }
  return [...dupes];
}

export interface CodeEntry {
  code: string;
  name: string;
}

export interface AppConfig {
  keywords: string[];
  excludeKeywords: string[];
  productCodes: CodeEntry[];
  industryCodes: CodeEntry[];
  recipients: string[];
}

let cached: AppConfig | null = null;

export function loadAppConfig(): AppConfig {
  if (cached) return cached;

  const configDir = resolveConfigDir();
  const keywordsPath = path.join(configDir, "keywords.json");
  const codesPath = path.join(configDir, "codes.json");
  const recipientsPath = path.join(configDir, "recipients.json");

  const keywordsData = parseOrThrow(keywordsFileSchema, readJsonFile(keywordsPath), keywordsPath);
  const codesData = parseOrThrow(codesFileSchema, readJsonFile(codesPath), codesPath);
  const recipientsData = parseOrThrow(recipientsFileSchema, readJsonFile(recipientsPath), recipientsPath);

  const dupKeywords = findDuplicates(keywordsData.keywords);
  if (dupKeywords.length > 0) {
    throw new ConfigError(`keywords.json에 중복된 키워드가 있습니다: ${dupKeywords.join(", ")}`);
  }

  const dupExcludeKeywords = findDuplicates(keywordsData.excludeKeywords);
  if (dupExcludeKeywords.length > 0) {
    throw new ConfigError(`keywords.json excludeKeywords에 중복된 키워드가 있습니다: ${dupExcludeKeywords.join(", ")}`);
  }

  const dupProductCodes = findDuplicates(codesData.productCodes.map((c) => c.code));
  if (dupProductCodes.length > 0) {
    throw new ConfigError(`codes.json productCodes에 중복된 코드가 있습니다: ${dupProductCodes.join(", ")}`);
  }

  const dupIndustryCodes = findDuplicates(codesData.industryCodes.map((c) => c.code));
  if (dupIndustryCodes.length > 0) {
    throw new ConfigError(`codes.json industryCodes에 중복된 코드가 있습니다: ${dupIndustryCodes.join(", ")}`);
  }

  const dupRecipients = findDuplicates(recipientsData.recipients.map((r) => r.toLowerCase()));
  if (dupRecipients.length > 0) {
    throw new ConfigError(`recipients.json에 중복된 이메일이 있습니다: ${dupRecipients.join(", ")}`);
  }

  cached = {
    keywords: keywordsData.keywords,
    excludeKeywords: keywordsData.excludeKeywords,
    productCodes: codesData.productCodes,
    industryCodes: codesData.industryCodes,
    recipients: recipientsData.recipients,
  };
  return cached;
}

/** 테스트에서 캐시를 리셋하기 위한 헬퍼 */
export function _resetAppConfigCacheForTests(): void {
  cached = null;
}
