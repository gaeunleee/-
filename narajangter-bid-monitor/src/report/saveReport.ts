import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ReportOutput } from "./buildReport.js";
import { logger } from "../logger.js";

// cwd(프로젝트 루트) 기준 output/ - tsx 직접 실행/dist 컴파일 실행 어느 쪽이든 동일하게 동작하도록 함
const OUTPUT_DIR = path.resolve(process.cwd(), "output");

/** 이메일 발송 성공 여부와 무관하게 리포트를 파일로 남겨 데이터 유실을 방지한다 (백업 겸 디버깅용). */
export async function saveReportToDisk(report: ReportOutput, generatedAt: Date): Promise<string> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const stamp = generatedAt.toISOString().replace(/[:.]/g, "-");
  const htmlPath = path.join(OUTPUT_DIR, `report-${stamp}.html`);
  const textPath = path.join(OUTPUT_DIR, `report-${stamp}.txt`);

  await writeFile(htmlPath, report.html, "utf-8");
  await writeFile(textPath, report.text, "utf-8");

  logger.info("리포트 파일 저장 완료", { htmlPath, textPath });
  return htmlPath;
}
