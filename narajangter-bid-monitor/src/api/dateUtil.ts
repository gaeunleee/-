/** data.go.kr 나라장터 API가 요구하는 YYYYMMDDHHMM 형식으로 변환 (KST 기준 로컬 시간 사용) */
export function toApiDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `${pad(date.getHours())}${pad(date.getMinutes())}`
  );
}

export function lookbackWindow(now: Date, lookbackDays: number): { begin: Date; end: Date } {
  const end = new Date(now);
  const begin = new Date(now);
  begin.setDate(begin.getDate() - lookbackDays);
  return { begin, end };
}
