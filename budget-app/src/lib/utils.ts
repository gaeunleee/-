import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(' ')
}

export function formatKRW(amount: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date)
}

export const OWNER_LABEL: Record<string, string> = {
  incheon: '인천',
  gaeun: '가은',
  shared: '공동',
}

export const OWNER_COLOR: Record<string, string> = {
  incheon: 'bg-blue-100 text-blue-700',
  gaeun: 'bg-pink-100 text-pink-700',
  shared: 'bg-gray-100 text-gray-700',
}
