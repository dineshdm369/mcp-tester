import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Play, ChevronDown, ArrowRight, Square } from 'lucide-react'
import { api } from '../api/client'
import type { StartRunRequest, RunMeta } from '../api/types'
import { VerdictBadge } from '../components/VerdictBadge'
import clsx from 'clsx'

const inputClass =
  'w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-100 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-700 transition-colors'

const labelClass =
  'block text-[10px] font-display font-medium uppercase tracking-[0.12em] text-zinc-500 mb-2'

export function RunTests() {
  const navigate = useNavigate()
  const [form, setForm] = useState<StartRunRequest>({
    provider: 'openrouter',
    model: '',
    suite: 'cloud-core',
    mcp_server: '',
    temperature: 0,
    max_turns: 12,
    no_grade: false,
    server_tag: '',
  })
  const [activeJob, setActiveJob] = useState<{ date: string; run_id: string } | null>(null)
  const [jobStatus, setJobStatus] = useState<RunMeta | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: suitesData } = useQuery({ queryKey: ['suites'], queryFn: api.suites })
  const { data: configData } = useQuery({ queryKey: ['config'], queryFn: api.config })

  // Pre-fill mcp_server on first load
  useEffect(() => {
    if (configData?.mcp_servers?.length && !form.mcp_server) {
      setForm((f) => ({ ...f, mcp_server: configData.mcp_servers[0] }))
    }
  }, [configData]) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll active job
  useEffect(() => {
    if (!activeJob) return
    pollRef.current = setInterval(async () => {
      try {
        const status = await api.jobStatus(activeJob.date, activeJob.run_id)
        setJobStatus(status)
        if (status.status !== 'running') {
          clearInterval(pollRef.current!)
          pollRef.current = null
        }
      } catch {
        // ignore transient fetch errors during polling
      }
    }, 2000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [activeJob])

  const mutation = useMutation({
    mutationFn: api.startRun,
    onSuccess: (data) => {
      setActiveJob({ date: data.date, run_id: data.run_id })
      setJobStatus(null)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (jobStatus?.status === 'running') return
    setActiveJob(null)
    setJobStatus(null)
    mutation.mutate(form)
  }

  const isRunning = jobStatus?.status === 'running'
  const isDone =
    jobStatus?.status === 'complete' ||
    jobStatus?.status === 'failed' ||
    jobStatus?.status === 'cancelled'

  const handleStop = async () => {
    if (!activeJob) return
    await api.cancelJob(activeJob.date, activeJob.run_id)
  }
  const progressPct =
    jobStatus && jobStatus.total > 0
      ? Math.round((jobStatus.completed / jobStatus.total) * 100)
      : 0

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-8">
        <h1 className="font-display font-bold text-xl text-zinc-100 tracking-tight">Run Tests</h1>
        <p className="text-zinc-500 text-xs mt-1">
          Configure and launch a prompt suite against the MCP server.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Provider */}
        <div>
          <label className={labelClass}>Provider</label>
          <div className="relative">
            <select
              value={form.provider}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
              className={clsx(inputClass, 'appearance-none pr-8')}
            >
              {(configData?.providers ?? ['anthropic', 'openai', 'openrouter']).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
            />
          </div>
        </div>

        {/* Model */}
        <div>
          <label className={labelClass}>Model</label>
          <input
            type="text"
            value={form.model}
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            placeholder={
              form.provider === 'openrouter'
                ? 'anthropic/claude-sonnet-4-5'
                : 'claude-sonnet-4-5-20250514'
            }
            required
            className={inputClass}
          />
        </div>

        {/* Suite */}
        <div>
          <label className={labelClass}>Suite</label>
          <div className="relative">
            <select
              value={form.suite}
              onChange={(e) => setForm((f) => ({ ...f, suite: e.target.value }))}
              className={clsx(inputClass, 'appearance-none pr-8')}
            >
              {(suitesData?.suites ?? []).map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
            />
          </div>
        </div>

        {/* MCP Server */}
        <div>
          <label className={labelClass}>MCP Server</label>
          <div className="relative">
            <select
              value={form.mcp_server}
              onChange={(e) => setForm((f) => ({ ...f, mcp_server: e.target.value }))}
              className={clsx(inputClass, 'appearance-none pr-8')}
              required
            >
              <option value="">Select server…</option>
              {(configData?.mcp_servers ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
            />
          </div>
        </div>

        {/* Server tag */}
        <div>
          <label className={labelClass}>
            Server Tag{' '}
            <span className="text-zinc-700 normal-case tracking-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={form.server_tag ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, server_tag: e.target.value || undefined }))}
            placeholder="e.g. v1.2.3, staging, post-fix"
            className={inputClass}
          />
        </div>

        {/* Skip grading */}
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={form.no_grade}
            onChange={(e) => setForm((f) => ({ ...f, no_grade: e.target.checked }))}
            className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-900 accent-cyan-500"
          />
          <span className="text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors">
            Skip grading
          </span>
        </label>

        {/* Submit */}
        <button
          type="submit"
          disabled={isRunning || mutation.isPending}
          className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-display font-bold text-[11px] uppercase tracking-[0.12em] py-3 rounded-lg transition-all shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/20 mt-2"
        >
          <Play size={12} strokeWidth={2.5} />
          {mutation.isPending || isRunning ? 'Running…' : 'Start Run'}
        </button>

        {mutation.isError && (
          <p className="text-[11px] text-rose-400 font-mono text-center">
            {String(mutation.error)}
          </p>
        )}
      </form>

      {/* Progress card */}
      {activeJob && jobStatus && (
        <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className={labelClass} style={{ marginBottom: 0 }}>
              {isRunning
                ? 'In progress'
                : jobStatus.status === 'complete'
                  ? 'Complete'
                  : jobStatus.status === 'cancelled'
                    ? 'Cancelled'
                    : 'Failed'}
            </span>
            <VerdictBadge verdict={jobStatus.status} />
          </div>

          {isRunning && (
            <div>
              <div className="flex justify-between text-[10px] text-zinc-500 mb-1.5 font-mono">
                <span>
                  {jobStatus.completed} / {jobStatus.total} tests
                </span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-0.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <button
                onClick={handleStop}
                className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-rose-400 transition-colors"
              >
                <Square size={10} />
                Stop run
              </button>
            </div>
          )}

          {isDone && (
            <div className="flex gap-4 text-[11px] font-mono">
              <span className="text-emerald-400">{jobStatus.pass_count} pass</span>
              <span className="text-amber-400">{jobStatus.partial_pass_count} partial</span>
              <span className="text-rose-400">{jobStatus.fail_count} fail</span>
            </div>
          )}

          {jobStatus.status === 'failed' && jobStatus.error && (
            <p className="text-[11px] text-rose-400 font-mono">{jobStatus.error}</p>
          )}

          {isDone && jobStatus.status === 'complete' && (
            <button
              onClick={() => navigate(`/runs/${activeJob.date}/${activeJob.run_id}`)}
              className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              View results <ArrowRight size={11} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
