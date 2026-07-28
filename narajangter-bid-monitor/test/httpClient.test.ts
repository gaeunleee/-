import { describe, expect, it } from "vitest";
import { parseResponseBody } from "../src/api/httpClient.js";
import { ApiResultError } from "../src/errors.js";

describe("parseResponseBody", () => {
  it("표준 response.header/body 형식을 정상 파싱한다", () => {
    const text = JSON.stringify({
      response: {
        header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
        body: { items: [{ a: 1 }], totalCount: 1, pageNo: 1, numOfRows: 10 },
      },
    });
    const envelope = parseResponseBody(text, "test");
    expect(envelope.resultCode).toBe("00");
    expect(envelope.items).toEqual([{ a: 1 }]);
  });

  it("resultCode가 0이 아니면 실제 코드를 담아 ApiResultError를 던질 수 있도록 정확한 코드를 파싱한다", () => {
    const text = JSON.stringify({
      response: { header: { resultCode: "11", resultMsg: "NO_MANDATORY_REQUEST_PARAMETERS_ERROR" } },
    });
    const envelope = parseResponseBody(text, "test");
    expect(envelope.resultCode).toBe("11");
  });

  it("nkoneps.com.response.ResponseError 같은 비표준 오류 포맷에서도 실제 resultCode를 찾아낸다 (기본값 99로 덮어쓰지 않음)", () => {
    const text = JSON.stringify({
      "nkoneps.com.response.ResponseError": {
        header: { resultCode: "08", resultMsg: "필수의 값이 없습니다" },
      },
    });
    const envelope = parseResponseBody(text, "test");
    expect(envelope.resultCode).toBe("08");
    expect(envelope.resultMsg).toContain("필수");
  });

  it("resultCode가 오류 객체 최상위에 바로 있는 경우도 찾아낸다", () => {
    const text = JSON.stringify({
      someWrapper: { resultCode: "20", resultMsg: "SERVICE_ACCESS_DENIED_ERROR" },
    });
    const envelope = parseResponseBody(text, "test");
    expect(envelope.resultCode).toBe("20");
  });

  it("resultCode를 어디서도 찾을 수 없으면 99로 처리한다", () => {
    const text = JSON.stringify({ foo: "bar" });
    const envelope = parseResponseBody(text, "test");
    expect(envelope.resultCode).toBe("99");
  });
});

describe("ApiResultError 코드 보존 (httpClient 통합 동작 문서화)", () => {
  it("resultCode가 재시도 대상인지 판단할 때 실제 코드를 사용해야 한다", () => {
    // 08(필수값 누락)은 재시도해도 해결되지 않는 오류이므로 RETRYABLE 목록에 없어야 한다.
    const err = new ApiResultError("test", "08", "필수값 입력 에러");
    expect(err.resultCode).toBe("08");
  });
});
