import type { NormalizedNotice } from "../api/types.js";
import type { CodeEntry } from "../config/loadJsonConfig.js";

export type Confidence = "강력추천" | "참고용";

export interface MatchedNotice {
  notice: NormalizedNotice;
  matchedProductCodes: CodeEntry[];
  matchedIndustryCodes: CodeEntry[];
  matchedKeywords: string[];
  confidence: Confidence;
}
