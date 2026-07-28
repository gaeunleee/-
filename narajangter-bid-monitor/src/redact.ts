/** 로그/알림 메일 등 외부로 나가는 텍스트에서 비밀값이 실수로 노출되는 것을 막기 위한 마지막 방어선 */
export function redactSecrets(text: string, secrets: (string | undefined)[]): string {
  let result = text;
  for (const secret of secrets) {
    if (!secret || secret.length < 6) continue;
    result = result.split(secret).join("***REDACTED***");
  }
  return result;
}
