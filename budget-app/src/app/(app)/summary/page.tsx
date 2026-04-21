'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MonthlySummary } from '@/types'
import { formatKRW, cn } from '@/lib/utils'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = ['#6366f1','#f59e0b','#ef4444','#22c55e','#ec4899','#14b8a6','#f97316','#8b5cf6','#06b6d4','#3b82f6']

export default function SummaryPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/summary?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(data => { setSummary(data); setLoading(false) })
  }, [year, month])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const pieData = summary?.byCategory.map(c => ({
    name: `${c.category.name} · ${c.category.sub_name}`,
    value: c.amount,
  })) ?? []

  return (
    <div>
      <div className="sticky top-0 bg-white border-b border-gray-100 z-10 flex items-center justify-between px-4 py-3">
        <button onClick={prevMonth}><ChevronLeft size={20} /></button>
        <span className="font-semibold">{year}년 {month}월 결산</span>
        <button onClick={nextMonth}><ChevronRight size={20} /></button>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      )}

      {summary && !loading && (
        <div className="p-4 space-y-6">
          {/* 요약 카드 */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '수입', value: summary.income, color: 'text-green-600' },
              { label: '지출', value: summary.expense, color: 'text-red-500' },
              { label: '저축', value: summary.saving, color: 'text-blue-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-50 rounded-2xl p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className={cn('text-sm font-bold', color)}>{formatKRW(value)}</p>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 rounded-2xl p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">잔액 (수입 - 지출 - 저축)</p>
            <p className={cn('text-2xl font-bold', summary.balance >= 0 ? 'text-gray-900' : 'text-red-500')}>
              {formatKRW(summary.balance)}
            </p>
            <p className="text-sm text-gray-400 mt-1">저축률 {summary.savingRate}%</p>
          </div>

          {/* 파이 차트 */}
          {pieData.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 mb-3">지출 비율</h2>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={90} innerRadius={55}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatKRW(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 카테고리 상세 */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 mb-3">카테고리 상세</h2>
            <div className="space-y-3">
              {summary.byCategory.map(({ category, amount, budget, rate }, i) => (
                <div key={category.id} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-sm flex-1">{category.name} · {category.sub_name}</span>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatKRW(amount)}</p>
                    {budget && <p className="text-xs text-gray-400">/ {formatKRW(budget)} ({rate}%)</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
