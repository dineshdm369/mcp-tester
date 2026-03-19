import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { GitCompare, ChevronRight } from 'lucide-react'
import { api } from '../api/client'
import type { RunMeta } from '../api/types'
import { VerdictBadge } from '../components/VerdictBadge'
import clsx from 'clsx'

function VerdictBar({ meta }: { meta: RunMeta }) {
  const { total, pass_count, partial_pass_count, fail_count } = meta
  if (!total) return <span className="text-zinc-700 text-xs font-mono">—</span>
  const pPct = (pass_count / total) * 100
  const ppPct = (partial_pass_count / total) * 100
  const fPct = (fail_count / total) * 100
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-20 h-1.5 rounded-full bg-zinc-800 flex overflow-hidden">
        <div className="bg-emerald-500 h-full" style={{ width: `${pPct}%` }} />
        <div className="bg-amber-500 h-full" style={{ width: `${ppPct}%` }} />
        <div className="bg-rose-500 h-full" style={{ width: `${fPct}%` }} />
      </div>
      <span className="text-[11px] font-mono text-zinc-400">
        {pass_count}/{total}
      </span>
    </div>
  )
}

function formatTime(run_id: string) {
  const raw = run_id.replace('run-', '')
  if (raw.length !== 6) return run_id
  return `${raw.slice(0, 2)}:${raw.slice(2, 4)}:${raw.slice(4, 6)}`
}

export function History() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['runs'],
    queryFn: api.runs,
    refetchInterval: 8000,
  })
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const runs = data?.runs ?? []

  const toggleSelect = (key: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else if (next.size < 2) {
        next.add(key)
      }
      return next
    })
  }

  const handleCompare = () => {
    const [a, b] = [...selected]
    navigate(`/compare?a=${a}&b=${b}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-zinc-600 text-xs font-mono animate-pulse">loading runs…</span>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="font-display font-bold text-xl text-zinc-100 tracking-tight">History</h1>
          <p className="text-zinc-500 text-xs mt-1">
            {runs.length} run{runs.length !== 1 ? 's' : ''} recorded.
          </p>
        </div>
        {selected.size === 2 && (
          <button
            onClick={handleCompare}
            className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 text-zinc-300 text-[11px] font-display font-medium uppercase tracking-[0.1em] px-4 py-2 rounded-lg hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          >
            <GitCompare size={12} />
            Compare
          </button>
        )}
      </div>

      {runs.length === 0 ? (
        <div className="border border-dashed border-zinc-800 rounded-xl p-16 sm:p-20 text-center">
          <p className="text-zinc-600 text-sm">
            No runs yet.{' '}
            <button
              onClick={() => navigate('/run')}
              className="text-zinc-400 hover:text-zinc-200 underline underline-offset-2 transition-colors"
            >
              Start your first run
            </button>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="border border-zinc-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/40">
                    <th className="w-10 px-4 py-3 text-left">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-display font-medium uppercase tracking-[0.12em] text-zinc-500">
                      Date · Time
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-display font-medium uppercase tracking-[0.12em] text-zinc-500">
                      Model
                    </th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left text-[10px] font-display font-medium uppercase tracking-[0.12em] text-zinc-500">
                      Suite
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-display font-medium uppercase tracking-[0.12em] text-zinc-500">
                      Results
                    </th>
                    <th className="hidden md:table-cell px-4 py-3 text-left text-[10px] font-display font-medium uppercase tracking-[0.12em] text-zinc-500">
                      Status
                    </th>
                    <th className="w-8 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => {
                    const key = `${run.date}/${run.run_id}`
                    const isSelected = selected.has(key)
                    return (
                      <tr
                        key={key}
                        onClick={() => navigate(`/runs/${run.date}/${run.run_id}`)}
                        className={clsx(
                          'border-b border-zinc-800/50 last:border-0 cursor-pointer transition-colors',
                          isSelected ? 'bg-cyan-500/5' : 'hover:bg-zinc-900/60',
                        )}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3.5" onClick={(e) => toggleSelect(key, e)}>
                          <div
                            className={clsx(
                              'w-3.5 h-3.5 rounded border transition-all cursor-pointer',
                              isSelected
                                ? 'bg-cyan-500 border-cyan-500'
                                : 'border-zinc-700 hover:border-zinc-500',
                            )}
                          />
                        </td>

                        {/* Date · Time */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="text-zinc-200 font-mono text-xs">{run.date}</span>
                          <span className="text-zinc-500 font-mono text-xs ml-2">
                            {formatTime(run.run_id)}
                          </span>
                        </td>

                        {/* Model */}
                        <td className="px-4 py-3.5 max-w-[200px]">
                          <span className="text-zinc-500 font-mono text-xs">{run.provider}</span>
                          <span className="text-zinc-700 mx-1">/</span>
                          <span className="text-zinc-200 font-mono text-xs block truncate">
                            {run.model}
                          </span>
                        </td>

                        {/* Suite */}
                        <td className="hidden sm:table-cell px-4 py-3.5">
                          <span className="font-mono text-xs text-zinc-300">{run.suite}</span>
                          {run.server_tag && (
                            <span className="ml-2 font-mono text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-px rounded">
                              {run.server_tag}
                            </span>
                          )}
                        </td>

                        {/* Results bar */}
                        <td className="px-4 py-3.5">
                          <VerdictBar meta={run} />
                        </td>

                        {/* Status */}
                        <td className="hidden md:table-cell px-4 py-3.5">
                          <VerdictBadge verdict={run.status} />
                        </td>

                        <td className="px-4 py-3.5">
                          <ChevronRight size={13} className="text-zinc-700" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {selected.size === 1 && (
            <p className="text-center text-[11px] text-zinc-600 mt-4">
              Select one more run to compare.
            </p>
          )}
        </>
      )}
    </div>
  )
}
