'use client'

import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Transaction, Owner, TransactionType } from '@/types'
import { formatKRW, OWNER_LABEL, OWNER_COLOR, cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Trash2, Pencil } from 'lucide-react'

type Filter = { owner: string; type: string }

export default function TransactionsPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filter, setFilter] = useState<Filter>({ owner: '', type: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ year: String(year), month: String(month) })
    if (filter.owner) params.set('owner', filter.owner)
    if (filter.type) params.set('type', filter.type)
    fetch(`/api/transactions?${params}`).then(r => r.json()).then(data => {
      setTransactions(data)
      setLoading(false)
    })
  }, [year, month, filter])

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/transactions?id=${id}`, { method: 'DELETE' })
    setTransactions(prev => prev.filter(t => t.id !== id))
  }

  // 날짜별 그룹핑
  const grouped = transactions.reduce<Record<string, Transaction[]>>((acc, tx) => {
    const key = tx.transaction_date
    if (!acc[key]) acc[key] = []
    acc[key].push(tx)
    return acc
  }, {})

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="sticky top-0 bg-white border-b border-gray-100 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={prevMonth}><ChevronLeft size={20} /></button>
          <span className="font-semibold">{year}년 {month}월</span>
          <button onClick={nextMonth}><ChevronRight size={20} /></button>
        </div>
        {/* 필터 */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
          {[
            { key: 'owner', value: '', label: '전체' },
            { key: 'owner', value: 'incheon', label: '인천' },
            { key: 'owner', value: 'gaeun', label: '가은' },
            { key: 'owner', value: 'shared', label: '공동' },
          ].map(f => (
            <FilterChip
              key={f.label}
              label={f.label}
              active={filter.owner === f.value}
              onClick={() => setFilter(prev => ({ ...prev, owner: f.value }))}
            />
          ))}
          <div className="w-px bg-gray-200 mx-1" />
          {[
            { value: '', label: '전체' },
            { value: 'expense', label: '지출' },
            { value: 'income', label: '수입' },
            { value: 'saving', label: '저축' },
          ].map(f => (
            <FilterChip
              key={f.label}
              label={f.label}
              active={filter.type === f.value}
              onClick={() => setFilter(prev => ({ ...prev, type: f.value }))}
            />
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      )}

      {!loading && transactions.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-16">거래 내역이 없습니다</p>
      )}

      <div className="pb-4">
        {sortedDates.map(date => (
          <div key={date}>
            <div className="px-4 py-2 bg-gray-50">
              <span className="text-xs font-semibold text-gray-500">
                {format(parseISO(date), 'M월 d일 (EEEEE)', { locale: ko })}
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {grouped[date].map(tx => (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xl w-9 h-9 flex items-center justify-center bg-gray-50 rounded-xl shrink-0">
                    {tx.category?.icon ?? '💳'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {tx.merchant || tx.category?.sub_name || tx.category?.name || '미분류'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={cn('text-xs px-1.5 py-0.5 rounded-full', OWNER_COLOR[tx.owner])}>
                        {OWNER_LABEL[tx.owner]}
                      </span>
                      {tx.card && (
                        <span className="text-xs text-gray-400">{tx.card.name}</span>
                      )}
                      {tx.is_auto_parsed && (
                        <span className="text-xs text-indigo-400">자동</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn('text-sm font-semibold',
                      tx.type === 'income' ? 'text-green-600' :
                      tx.type === 'saving' ? 'text-blue-600' : 'text-gray-900'
                    )}>
                      {tx.type === 'income' ? '+' : '-'}{formatKRW(tx.amount)}
                    </p>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="mt-1 text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors',
        active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'
      )}
    >
      {label}
    </button>
  )
}
