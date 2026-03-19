import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, ChevronDown, ChevronRight, Wrench, Sparkles, Copy, Check, Download, Square } from 'lucide-react'
import { api } from '../api/client'
import type { TestResult } from '../api/types'
import { VerdictBadge, verdictStripeColor } from '../components/VerdictBadge'
import clsx from 'clsx'

type Filter = 'All' | 'Pass' | 'Partial Pass' | 'Fail'

function ResultRow({ result }: { result: TestResult }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className={clsx(
        'border-l-2 border-b border-zinc-800/50 last:border-b-0 transition-colors',
        verdictStripeColor(result.verdict),
      )}
    >
      {/* Summary row */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 sm:gap-4 px-4 py-3.5 text-left hover:bg-zinc-900/50 transition-colors group"
      >
        <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0">
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span className="font-mono text-[11px] text-zinc-400 w-24 sm:w-28 shrink-0">{result.test_id}</span>
        <span className="hidden sm:block font-mono text-[11px] text-zinc-600 w-28 shrink-0">{result.family}</span>
        <span className="text-sm text-zinc-300 truncate flex-1 min-w-0">{result.prompt}</span>
        <VerdictBadge verdict={result.verdict} />
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-5 pb-5 pt-3 bg-zinc-900/20 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <div className="text-[10px] font-display font-medium uppercase tracking-[0.12em] text-zinc-500 mb-2">
                Prompt
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed">{result.prompt}</p>
            </div>
            <div>
              <div className="text-[10px] font-display font-medium uppercase tracking-[0.12em] text-zinc-500 mb-2">
                Expected Checks
              </div>
              <ul className="space-y-1.5">
                {result.expected_check.map((c, i) => (
                  <li key={i} className="text-sm text-zinc-400 flex gap-2">
                    <span className="text-zinc-700 shrink-0">—</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-display font-medium uppercase tracking-[0.12em] text-zinc-500 mb-2">
              Actual Response
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono text-xs max-h-56 overflow-y-auto">
              {result.actual_response}
            </div>
          </div>

          {result.remarks.length > 0 && (
            <div>
              <div className="text-[10px] font-display font-medium uppercase tracking-[0.12em] text-zinc-500 mb-2">
                Remarks
              </div>
              <ul className="space-y-1.5">
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
            <div className="flex gap-2 flex-wrap">
              {result.issue_classes.map((ic, i) => (
                <span
                  key={i}
                  className="text-[10px] font-mono bg-rose-500/12 text-rose-400 border border-rose-500/25 px-2 py-0.5 rounded"
                >
                  {ic}
                </span>
              ))}
            </div>
          )}

          {result.usage && Object.keys(result.usage).length > 0 && (
            <div className="flex gap-4 flex-wrap">
              {Object.entries(result.usage)
                .filter(([, v]) => v != null)
                .map(([k, v]) => (
                  <span key={k} className="text-[10px] font-mono text-zinc-600">
                    {k}: <span className="text-zinc-400">{v}</span>
                  </span>
                ))}
            </div>
          )}

          {result.tool_calls.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer list-none text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1.5 text-[10px] font-display uppercase tracking-[0.1em]">
                <Wrench size={10} />
                {result.tool_calls.length} tool call
                {result.tool_calls.length !== 1 ? 's' : ''}
              </summary>
              <div className="mt-2 space-y-1.5">
                {result.tool_calls.map((tc, i) => (
                  <div
                    key={i}
                    className="bg-zinc-950 border border-zinc-800 rounded p-2.5 font-mono text-[10px] break-all"
                  >
                    <span className="text-cyan-400">{tc.name}</span>
                    <span className="text-zinc-600">
                      {' '}
                      ({JSON.stringify(tc.arguments, null, 0)})
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

function IssueClassBar({ results }: { results: TestResult[] }) {
  const freq: Record<string, number> = {}
  for (const r of results) {
    for (const ic of r.issue_classes) {
      freq[ic] = (freq[ic] ?? 0) + 1
    }
  }
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) return null
  return (
    <div className="flex gap-2 flex-wrap">
      {sorted.map(([ic, count]) => (
        <span
          key={ic}
          className="text-[10px] font-mono bg-rose-500/12 text-rose-400 border border-rose-500/25 px-2 py-0.5 rounded flex items-center gap-1.5"
        >
          {ic}
          <span className="text-rose-500 font-bold">{count}</span>
        </span>
      ))}
    </div>
  )
}

function SuggestVariantsPanel({
  provider,
  model,
  failedTests,
}: {
  provider: string
  model: string
  failedTests: TestResult[]
}) {
  const [copied, setCopied] = useState(false)
  const mutation = useMutation({
    mutationFn: () =>
      api.suggestVariants({
        provider,
        model,
        failed_tests: failedTests as unknown as Record<string, unknown>[],
      }),
  })

  const handleCopy = () => {
    if (mutation.data?.yaml) {
      navigator.clipboard.writeText(mutation.data.yaml)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="mt-5 pt-5 border-t border-zinc-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-[10px] font-display font-medium uppercase tracking-[0.12em] text-zinc-500">
            Adversarial Variants
          </div>
          <p className="text-xs text-zinc-600 mt-0.5">
            Generate test cases that stress-test the same failure modes from different angles.
          </p>
        </div>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/25 text-violet-400 text-[11px] font-display font-medium uppercase tracking-[0.1em] px-4 py-2 rounded-lg hover:bg-violet-500/15 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <Sparkles size={11} />
          {mutation.isPending ? 'Generating…' : 'Suggest Variants'}
        </button>
      </div>

      {mutation.isError && (
        <p className="text-[11px] text-rose-400 font-mono">{String(mutation.error)}</p>
      )}

      {mutation.data?.yaml && (
        <div className="relative">
          <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-[11px] text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto overflow-x-auto">
            {mutation.data.yaml}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-2.5 right-2.5 flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-zinc-300 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded transition-colors"
          >
            {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  )
}

const FILTERS: Filter[] = ['All', 'Pass', 'Partial Pass', 'Fail']

export function RunDetail() {
  const { date, runId } = useParams<{ date: string; runId: string }>()
  const [filter, setFilter] = useState<Filter>('All')

  const { data, isLoading } = useQuery({
    queryKey: ['run', date, runId],
    queryFn: () => api.run(date!, runId!),
    refetchInterval: (query) => (query.state.data?.meta?.status === 'running' ? 3000 : false),
  })

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-zinc-600 text-xs font-mono animate-pulse">loading…</span>
      </div>
    )
  }

  const { meta, results } = data
  const filtered =
    filter === 'All' ? results : results.filter((r) => r.verdict === (filter as string))

  const countFor = (f: Filter) =>
    f === 'All' ? results.length : results.filter((r) => r.verdict === (f as string)).length

  return (
    <div>
      <Link
        to="/history"
        className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
      >
        <ArrowLeft size={11} />
        History
      </Link>

      {/* Run header card */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-xl text-zinc-100 tracking-tight">
              {meta.suite}
            </h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="font-mono text-xs text-zinc-500">{meta.provider}</span>
              <span className="text-zinc-700">/</span>
              <span className="font-mono text-xs text-zinc-200 break-all">{meta.model}</span>
              <span className="text-zinc-700">·</span>
              <span className="font-mono text-xs text-zinc-500">
                {meta.date} {meta.run_id}
              </span>
              {meta.server_tag && (
                <>
                  <span className="text-zinc-700">·</span>
                  <span className="font-mono text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded">
                    {meta.server_tag}
                  </span>
                </>
              )}
              <span className="text-zinc-700">·</span>
              <span className="font-mono text-[10px] text-zinc-600 break-all">{meta.suite_hash}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {meta.status === 'complete' && (
              <a
                href={`/api/runs/${date}/${runId}/export`}
                download
                className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Download size={11} />
                MD
              </a>
            )}
            <VerdictBadge verdict={meta.status} size="md" />
          </div>
        </div>

        <div className="flex gap-6 sm:gap-7 mt-4 pt-4 border-t border-zinc-800">
          {[
            { label: 'Pass', count: meta.pass_count, color: 'text-emerald-400' },
            { label: 'Partial', count: meta.partial_pass_count, color: 'text-amber-400' },
            { label: 'Fail', count: meta.fail_count, color: 'text-rose-400' },
            { label: 'Total', count: meta.total, color: 'text-zinc-200' },
          ].map(({ label, count, color }) => (
            <div key={label}>
              <div className={clsx('font-display font-bold text-2xl leading-none', color)}>
                {count}
              </div>
              <div className="text-[10px] text-zinc-600 uppercase tracking-[0.1em] font-display mt-1">
                {label}
              </div>
            </div>
          ))}

          {meta.status === 'running' && (
            <div className="ml-auto self-center flex items-center gap-3">
              <div className="text-[11px] font-mono text-blue-400 animate-pulse">
                {meta.completed}/{meta.total} running…
              </div>
              <button
                onClick={() => api.cancelJob(date!, runId!)}
                className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-rose-400 transition-colors"
              >
                <Square size={10} />
                Stop
              </button>
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <IssueClassBar results={results} />
          </div>
        )}

        {meta.status === 'complete' && meta.fail_count > 0 && (
          <SuggestVariantsPanel
            provider={meta.provider}
            model={meta.model}
            failedTests={results.filter((r) => r.verdict === 'Fail')}
          />
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'text-[11px] font-display uppercase tracking-[0.1em] px-3 py-1.5 rounded transition-colors whitespace-nowrap',
              filter === f ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            {f}{' '}
            <span className="font-mono text-[10px] opacity-60">({countFor(f)})</span>
          </button>
        ))}
      </div>

      {/* Results table */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden">
        {/* Column header */}
        <div className="flex items-center gap-3 sm:gap-4 px-4 py-2.5 bg-zinc-900/40 border-b border-zinc-800">
          <span className="w-4 shrink-0" />
          <span className="w-24 sm:w-28 text-[10px] font-display uppercase tracking-[0.1em] text-zinc-500 shrink-0">
            ID
          </span>
          <span className="hidden sm:block w-28 text-[10px] font-display uppercase tracking-[0.1em] text-zinc-500 shrink-0">
            Family
          </span>
          <span className="flex-1 text-[10px] font-display uppercase tracking-[0.1em] text-zinc-500">
            Prompt
          </span>
          <span className="text-[10px] font-display uppercase tracking-[0.1em] text-zinc-500">
            Verdict
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-zinc-600 text-sm">
            No results match this filter.
          </div>
        ) : (
          filtered.map((r) => <ResultRow key={r.test_id} result={r} />)
        )}
      </div>
    </div>
  )
}
