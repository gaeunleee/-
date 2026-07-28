export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatBudget(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount) || amount <= 0) return "미상";
  return `${amount.toLocaleString("ko-KR")}원`;
}

export function formatDisplayValue(value: string | null, fallback = "미상"): string {
  if (!value || value.trim() === "") return fallback;
  return value.trim();
}

export function formatDateForSubject(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}
