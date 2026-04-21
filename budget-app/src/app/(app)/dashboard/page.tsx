'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, PiggyBank } from 'lucide-react'
import { MonthlySummary, Transaction } from '@/types'
import { formatKRW, OWNER_LABEL, OWNER_COLOR, cn } from '@/lib/utils'
import Link from 'next/link'

export default function DashboardPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [recent, setRecent] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/summary?year=${year}&month=${month}`).then(r => r.json()),
      fetch(`/api/transactions?year=${year}&month=${month}`).then(r => r.json()),
    ]).then(([s, t]) => {
      setSummary(s)
      setRecent(t.slice(0, 5))
      setLoading(false)
    })
  }, [year, month])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const monthLabel = format(new Date(year, month - 1, 1), 'yyyy년 M월', { locale: ko })

  return (
    <div className="flex flex-col">
      {/* 헤더 */}
      <div className="bg-indigo-600 text-white px-4 pt-12 pb-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-1"><ChevronLeft size={20} /></button>
          <h1 className="text-lg font-semibold">{monthLabel}</h1>
          <button onClick={nextMonth} className="p-1"><ChevronRight size={20} /></button>
        </div>

        {loading ? (
          <div className="h-24 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        ) : summary && (
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={<TrendingUp size={16} />} label="수입" value={formatKRW(summary.income)} color="text-green-300" />
            <StatCard icon={<TrendingDown size={16} />} label="지출" value={formatKRW(summary.expense)} color="text-red-300" />
            <StatCard icon={<PiggyBank size={16} />} label="저축" value={formatKRW(summary.saving)} color="text-yellow-300" />
            <StatCard
              icon={<Wallet size={16} />}
              label="잔액"
              value={formatKRW(summary.balance)}
              color={summary.balance >= 0 ? 'text-blue-300' : 'text-red-300'}
            />
          </div>
        )}

        {summary && (
          <div className="mt-3 text-center text-sm text-indigo-200">
            저축률 <span className="font-bold text-white">{summary.savingRate}%</span>
          </div>
        )}
      </div>

      {/* 카테고리별 예산 현황 */}
      {summary && summary.byCategory.length > 0 && (
        <section className="px-4 pt-5">
          <h2 className="text-sm font-semibold text-gray-500 mb-3">카테고리별 지출</h2>
          <div className="space-y-2">
            {summary.byCategory.slice(0, 6).map(({ category, amount, budget, rate }) => (
              <div key={category.id} className="flex items-center gap-3">
                <span className="text-lg w-7 text-center">{category.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-sm font-medium truncate">{category.name} · {category.sub_name}</span>
                    <span className="text-sm font-semibold ml-2 shrink-0">{formatKRW(amount)}</span>
                  </div>
                  {budget ? (
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', (rate ?? 0) >= 100 ? 'bg-red-500' : (rate ?? 0) >= 80 ? 'bg-yellow-400' : 'bg-indigo-400')}
                        style={{ width: `${Math.min(rate ?? 0, 100)}%` }}
                      />
                    </div>
                  ) : null}
                </div>
                {budget && (
                  <span className={cn('text-xs shrink-0', (rate ?? 0) >= 100 ? 'text-red-500' : 'text-gray-400')}>
                    {rate}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 최근 거래 */}
      <section className="px-4 pt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500">최근 거래</h2>
          <Link href="/transactions" className="text-xs text-indigo-600">전체보기</Link>
        </div>
        {recent.length === 0 && !loading && (
          <p className="text-sm text-gray-400 text-center py-6">이번 달 거래 내역이 없습니다</p>
        )}
        <div className="space-y-2">
          {recent.map(tx => (
            <TransactionRow key={tx.id} tx={tx} />
          ))}
        </div>
      </section>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-white/10 rounded-xl p-3">
      <div className={cn('flex items-center gap-1 text-xs mb-1', color)}>
        {icon} {label}
      </div>
      <p className="text-white font-bold text-sm">{value}</p>
    </div>
  )
}

function TransactionRow({ tx }: { tx: Transaction }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-xl w-9 h-9 flex items-center justify-center bg-gray-50 rounded-xl">
        {tx.category?.icon ?? '💳'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{tx.merchant || tx.category?.sub_name || tx.category?.name}</p>
        <p className="text-xs text-gray-400">{tx.transaction_date}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={cn('text-sm font-semibold', tx.type === 'income' ? 'text-green-600' : tx.type === 'saving' ? 'text-blue-600' : 'text-gray-900')}>
          {tx.type === 'income' ? '+' : '-'}{formatKRW(tx.amount)}
        </p>
        <span className={cn('text-xs px-1.5 py-0.5 rounded-full', OWNER_COLOR[tx.owner])}>
          {OWNER_LABEL[tx.owner]}
        </span>
      </div>
    </div>
  )
}
