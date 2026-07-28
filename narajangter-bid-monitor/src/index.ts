import { loadEnv, type Env } from "./config/env.js";
import { loadAppConfig } from "./config/loadJsonConfig.js";
import { fetchBidNotices } from "./api/bidNoticeApi.js";
import { fetchPreStandardNotices } from "./api/preStandardApi.js";
import { lookbackWindow } from "./api/dateUtil.js";
import { evaluateNotices } from "./matching/matchEngine.js";
import { buildReport } from "./report/buildReport.js";
import { saveReportToDisk } from "./report/saveReport.js";
import { createTransporter, verifyTransporter } from "./email/mailer.js";
import { sendFailureAlertEmail, sendReportEmail } from "./email/sendReportEmail.js";
import { ApiError, toErrorMessage } from "./errors.js";
import { logger } from "./logger.js";
import { redactSecrets } from "./redact.js";

async function run(): Promise<number> {
  let env: Env | undefined;

  try {
    env = loadEnv();
    const appConfig = loadAppConfig();

    const now = new Date();
    const window = lookbackWindow(now, env.lookbackDays);
    logger.info("조회 시작", {
      window: { begin: window.begin.toISOString(), end: window.end.toISOString() },
      dryRun: env.dryRun,
    });

    const [bidResults, preStandardResults] = await Promise.all([
      fetchBidNotices(env, window),
      fetchPreStandardNotices(env, window),
    ]);

    const totalFetchCalls = bidResults.length + preStandardResults.length;
    const failedCalls = [...bidResults, ...preStandardResults].filter((r) => r.failed);

    if (failedCalls.length === totalFetchCalls) {
      throw new ApiError("전체조회", "본공고/사전규격 조회가 모두 실패했습니다. API 키/네트워크 상태를 확인하세요.");
    }

    const bidMatches = evaluateNotices(
      bidResults.flatMap((r) => r.notices),
      appConfig
    );
    const preStandardMatches = evaluateNotices(
      preStandardResults.flatMap((r) => r.notices),
      appConfig
    );

    const report = buildReport({
      generatedAt: now,
      window,
      bid: { matches: bidMatches, failures: bidResults.filter((r) => r.failed) },
      preStandard: { matches: preStandardMatches, failures: preStandardResults.filter((r) => r.failed) },
    });

    await saveReportToDisk(report, now);

    logger.info("매칭 결과", {
      본공고: bidMatches.length,
      사전규격: preStandardMatches.length,
      실패한조회: failedCalls.length,
    });

    if (env.dryRun) {
      logger.info("DRY_RUN=true → 이메일 발송을 생략합니다. output/ 폴더의 리포트 파일을 확인하세요.");
      console.log(report.text);
      return failedCalls.length > 0 ? 2 : 0;
    }

    if (report.totalMatchCount === 0 && !env.sendEmptyReport) {
      logger.info("매칭 결과 0건이며 SEND_EMPTY_REPORT=false → 이메일 발송을 생략합니다.");
      return failedCalls.length > 0 ? 2 : 0;
    }

    const transporter = createTransporter(env);
    await verifyTransporter(transporter);
    await sendReportEmail(report, {
      transporter,
      from: env.smtpFrom,
      recipients: appConfig.recipients,
    });

    return failedCalls.length > 0 ? 2 : 0;
  } catch (err) {
    const secrets = env ? [env.naraBidServiceKey, env.naraPrestdServiceKey, env.smtpPass] : [];
    const message = redactSecrets(toErrorMessage(err), secrets);
    logger.error("실행 실패", { error: message });

    if (env && !env.dryRun && env.alertEmailOnFailure) {
      try {
        const appConfig = loadAppConfig();
        const transporter = createTransporter(env);
        await sendFailureAlertEmail(message, {
          transporter,
          from: env.smtpFrom,
          recipients: appConfig.recipients,
        });
      } catch (alertErr) {
        logger.error("실패 알림 이메일 발송도 실패했습니다. 로그를 직접 확인해주세요.", {
          error: toErrorMessage(alertErr),
        });
      }
    }

    return 1;
  }
}

run().then((exitCode) => {
  process.exitCode = exitCode;
});
