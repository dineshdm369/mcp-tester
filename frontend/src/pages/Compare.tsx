import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowUp, ArrowDown, Minus, ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '../api/client'
import type { TestResult } from '../api/types'
import { VerdictBadge } from '../components/VerdictBadge'
import clsx from 'clsx'

type ChangeType = 'regression' | 'improvement' | 'unchanged' | 'new'

const verdictScore: Record<string, number> = {
  Pass: 2,
  'Partial Pass': 1,
  Fail: 0,
  'Not graded': -1,
}

function getChange(a: string | undefined, b: string | undefined): ChangeType {
  if (!a) return 'new'
  const sa = verdictScore[a] ?? -1
  const sb = verdictScore[b ?? ''] ?? -1
  if (sa === sb) return 'unchanged'
  return sa > sb ? 'regression' : 'improvement'
}

function ChangeIndicator({ type }: { type: ChangeType }) {
  if (type === 'regression')
    return (
      <span className="flex items-center gap-1 text-rose-400">
        <ArrowDown size={11} />
      </span>
    )
  if (type === 'improvement')
    return (
      <span className="flex items-center gap-1 text-emerald-400">
        <ArrowUp size={11} />
      </span>
    )
  if (type === 'new') return <span className="text-[10px] font-mono text-zinc-600">new</span>
  return <Minus size={11} className="text-zinc-700" />
}

function parseRunParam(param: string): [string, string] {
  const idx = param.indexOf('/')
  if (idx === -1) return ['', '']
  return [param.slice(0, idx), param.slice(idx + 1)]
}

interface CompareRow {
  id: string
  a: TestResult | undefined
  b: TestResult | undefined
  change: ChangeType
}

function ResponsePanel({ result }: { result: TestResult | undefined }) {
  if (!result) return <div className="p-4 text-zinc-700 text-xs italic">Not in this run</div>
  return (
    <div className="p-4 space-y-3">
      <div>
        <div className="text-[10px] font-display uppercase tracking-[0.1em] text-zinc-500 mb-1.5">
          Response
        </div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-xs text-zinc-300 max-h-44 overflow-y-auto whitespace-pre-wrap leading-relaxed">
          {result.actual_response}
        </div>
      </div>
      {result.remarks.length > 0 && (
        <div>
          <div className="text-[10px] font-display uppercase tracking-[0.1em] text-zinc-500 mb-1.5">
            Remarks
          </div>
          <ul className="space-y-1">
            {result.remarks.map((r, i) => (
              <li key={i} className="text-sm text-zinc-400 flex gap-2">
                <span className="text-zinc-700 shrink-0">·</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.issue_classes.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {result.issue_classes.map((ic, i) => (
            <span
              key={i}
              className="text-[10px] font-mono bg-rose-500/12 text-rose-400 border border-rose-500/25 px-1.5 py-0.5 rounded"
            >
              {ic}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function CompareTableRow({ row }: { row: CompareRow }) {
  const [open, setOpen] = useState(false)

  const regressionIssueClasses =
    row.change === 'regression' ? (row.b?.issue_classes ?? []) : []

  return (
    <div
      className={clsx(
        'border-b border-zinc-800/50 last:border-0',
        row.change === 'regression' && 'bg-rose-500/[0.03]',
        row.change === 'improvement' && 'bg-emerald-500/[0.03]',
      )}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full grid items-center gap-0 px-4 py-3.5 text-left hover:bg-zinc-900/50 transition-colors"
        style={{ gridTemplateColumns: '1.5rem 7rem 1fr 1fr 2rem' }}
      >
        <ChangeIndicator type={row.change} />
        <span className="font-mono text-[11px] text-zinc-400 truncate pr-2">{row.id}</span>
        <span className="px-2 sm:px-3">
          {row.a ? <VerdictBadge verdict={row.a.verdict} /> : <span className="text-zinc-700">—</span>}
        </span>
        <span className="px-2 sm:px-3 flex items-center gap-1.5 flex-wrap">
          {row.b ? <VerdictBadge verdict={row.b.verdict} /> : <span className="text-zinc-700">—</span>}
          {regressionIssueClasses.map((ic, i) => (
            <span
              key={i}
              className="text-[9px] font-mono bg-rose-500/12 text-rose-400 border border-rose-500/25 px-1.5 py-px rounded hidden sm:inline"
            >
              {ic}
            </span>
          ))}
        </span>
        <span className="text-zinc-700 flex justify-end">
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      </button>

      {open && (
        <>
          {/* Issue class tags on mobile (shown below button when expanded) */}
          {regressionIssueClasses.length > 0 && (
            <div className="sm:hidden px-4 pb-2 flex gap-1.5 flex-wrap">
              {regressionIssueClasses.map((ic, i) => (
                <span
                  key={i}
                  className="text-[9px] font-mono bg-rose-500/12 text-rose-400 border border-rose-500/25 px-1.5 py-px rounded"
                >
                  {ic}
                </span>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 border-t border-zinc-800/50">
            <div className="sm:border-r border-zinc-800/50 border-b sm:border-b-0">
              <ResponsePanel result={row.a} />
            </div>
            <div>
              <ResponsePanel result={row.b} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function Compare() {
  const [params] = useSearchParams()
  const aParam = params.get('a') ?? ''
  const bParam = params.get('b') ?? ''
  const [aDate, aRunId] = parseRunParam(aParam)
  const [bDate, bRunId] = parseRunParam(bParam)

  const { data: runA, isLoading: loadingA } = useQuery({
    queryKey: ['run', aDate, aRunId],
    queryFn: () => api.run(aDate, aRunId),
    enabled: !!aDate && !!aRunId,
  })
  const { data: runB, isLoading: loadingB } = useQuery({
    queryKey: ['run', bDate, bRunId],
    queryFn: () => api.run(bDate, bRunId),
    enabled: !!bDate && !!bRunId,
  })

  if (!aParam || !bParam) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-zinc-500 text-sm">No runs selected.</p>
        <Link
          to="/history"
          className="text-zinc-400 text-xs hover:text-zinc-200 underline underline-offset-2 transition-colors"
        >
          ← Go to History and select two runs
        </Link>
      </div>
    )
  }

  if (loadingA || loadingB || !runA || !runB) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-zinc-600 text-xs font-mono animate-pulse">loading…</span>
      </div>
    )
  }

  const allIds = Array.from(
    new Set([...runA.results.map((r) => r.test_id), ...runB.results.map((r) => r.test_id)]),
  )
  const mapA = Object.fromEntries(runA.results.map((r) => [r.test_id, r]))
  const mapB = Object.fromEntries(runB.results.map((r) => [r.test_id, r]))

  const rows: CompareRow[] = allIds.map((id) => ({
    id,
    a: mapA[id],
    b: mapB[id],
    change: getChange(mapA[id]?.verdict, mapB[id]?.verdict),
  }))

  const regressions = rows.filter((r) => r.change === 'regression').length
  const improvements = rows.filter((r) => r.change === 'improvement').length
  const unchanged = rows.filter((r) => r.change === 'unchanged').length

  return (
    <div>
      <Link
        to="/history"
        className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
      >
        <ArrowLeft size={11} />
        History
      </Link>

      {/* Two-column header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {[
          { label: 'Run A', run: runA },
          { label: 'Run B', run: runB },
        ].map(({ label, run }) => (
          <div key={label} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="text-[10px] font-display uppercase tracking-[0.12em] text-zinc-500 mb-2">
              {label}
            </div>
            <div className="font-mono text-xs text-zinc-100 flex items-center gap-2 flex-wrap break-all">
              {run.meta.model}
              {run.meta.server_tag && (
                <span className="font-mono text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded shrink-0">
                  {run.meta.server_tag}
                </span>
              )}
            </div>
            <div className="font-mono text-[10px] text-zinc-500 mt-0.5">
              {run.meta.provider} · {run.meta.suite} · {run.meta.date}
            </div>
            <div className="flex gap-4 mt-3 pt-3 border-t border-zinc-800">
              <span className="text-emerald-400 font-mono text-[11px]">
                {run.meta.pass_count}P
              </span>
              <span className="text-amber-400 font-mono text-[11px]">
                {run.meta.partial_pass_count}PP
              </span>
              <span className="text-rose-400 font-mono text-[11px]">{run.meta.fail_count}F</span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap gap-4 sm:gap-6 mb-5 px-4 py-3 bg-zinc-900/30 rounded-xl border border-zinc-800">
        <div className="flex items-center gap-2">
          <ArrowDown size={12} className="text-rose-400" />
          <span className="text-sm text-zinc-400">
            <span className="text-rose-400 font-mono font-medium">{regressions}</span> regression
            {regressions !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ArrowUp size={12} className="text-emerald-400" />
          <span className="text-sm text-zinc-400">
            <span className="text-emerald-400 font-mono font-medium">{improvements}</span>{' '}
            improvement{improvements !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Minus size={12} className="text-zinc-600" />
          <span className="text-sm text-zinc-400">
            <span className="text-zinc-300 font-mono font-medium">{unchanged}</span> unchanged
          </span>
        </div>
      </div>

      {/* Comparison table */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden">
        <div
          className="grid items-center gap-0 px-4 py-2.5 bg-zinc-900/40 border-b border-zinc-800"
          style={{ gridTemplateColumns: '1.5rem 7rem 1fr 1fr 2rem' }}
        >
          <span />
          <span className="text-[10px] font-display uppercase tracking-[0.1em] text-zinc-500">
            Test ID
          </span>
          <span className="text-[10px] font-display uppercase tracking-[0.1em] text-zinc-500 px-2 sm:px-3">
            Run A
          </span>
          <span className="text-[10px] font-display uppercase tracking-[0.1em] text-zinc-500 px-2 sm:px-3">
            Run B
          </span>
          <span />
        </div>

        {rows.map((row) => (
          <CompareTableRow key={row.id} row={row} />
        ))}
      </div>
    </div>
  )
}
