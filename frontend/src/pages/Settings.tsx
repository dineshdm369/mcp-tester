import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Eye, EyeOff, Save, CheckCircle } from 'lucide-react'
import { api } from '../api/client'
import type { MCPServerConfig } from '../api/types'
import clsx from 'clsx'

interface EnvEntry {
  key: string
  value: string
  masked: boolean
}

const inputClass =
  'w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-100 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-700 transition-colors'

const labelClass =
  'block text-[10px] font-display font-medium uppercase tracking-[0.12em] text-zinc-500 mb-2'

export function Settings() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: api.settings })

  const [serverName, setServerName] = useState('')
  const [cfg, setCfg] = useState<MCPServerConfig>({ transport: 'stdio', command: '', args: [] })
  const [envEntries, setEnvEntries] = useState<EnvEntry[]>([])
  const [showSaved, setShowSaved] = useState(false)

  useEffect(() => {
    if (!data) return
    const names = Object.keys(data.servers)
    if (!names.length) return
    const name = names[0]
    const server = data.servers[name]
    setServerName(name)
    setCfg(server)
    setEnvEntries(
      Object.entries(server.env ?? {}).map(([k, v]) => ({
        key: k,
        value: v,
        masked: v === '****',
      })),
    )
  }, [data])

  const mutation = useMutation({
    mutationFn: (payload: unknown) => api.updateSettings(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      qc.invalidateQueries({ queryKey: ['config'] })
      setShowSaved(true)
      setTimeout(() => setShowSaved(false), 3000)
    },
  })

  const handleSave = () => {
    const env = Object.fromEntries(envEntries.filter((e) => e.key).map((e) => [e.key, e.value]))
    mutation.mutate({
      server_name: serverName,
      transport: cfg.transport,
      command: cfg.command,
      args: (cfg.args ?? []).filter(Boolean),
      env,
      url: cfg.url,
      headers: cfg.headers ?? {},
    })
  }

  const addEntry = () => setEnvEntries((prev) => [...prev, { key: '', value: '', masked: false }])
  const removeEntry = (i: number) => setEnvEntries((prev) => prev.filter((_, j) => j !== i))
  const updateEntry = (i: number, field: 'key' | 'value', val: string) => {
    setEnvEntries((prev) =>
      prev.map((e, j) => (j === i ? { ...e, [field]: val, masked: false } : e)),
    )
  }
  const toggleMask = (i: number) =>
    setEnvEntries((prev) => prev.map((e, j) => (j === i ? { ...e, masked: !e.masked } : e)))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-zinc-600 text-xs font-mono animate-pulse">loading…</span>
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <div className="mb-8">
        <h1 className="font-display font-bold text-xl text-zinc-100 tracking-tight">Settings</h1>
        <p className="text-zinc-500 text-xs mt-1">
          Configure the MCP server connection. Changes are written to{' '}
          <code className="font-mono text-zinc-400">.mcp.json</code>.
        </p>
      </div>

      <div className="space-y-5">
        {/* Server name */}
        <div>
          <label className={labelClass}>Server Name</label>
          <input
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            placeholder="my-server"
            className={inputClass}
          />
        </div>

        {/* Transport selector */}
        <div>
          <label className={labelClass}>Transport</label>
          <div className="flex gap-2">
            {['stdio', 'streamable_http'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setCfg((c) => ({ ...c, transport: t }))}
                className={clsx(
                  'text-[11px] font-mono px-4 py-2 rounded-lg border transition-colors',
                  cfg.transport === t
                    ? 'bg-zinc-800 border-zinc-600 text-zinc-100'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* stdio fields */}
        {cfg.transport === 'stdio' && (
          <>
            <div>
              <label className={labelClass}>Command</label>
              <input
                value={cfg.command ?? ''}
                onChange={(e) => setCfg((c) => ({ ...c, command: e.target.value }))}
                placeholder="python"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Args</label>
              <input
                value={(cfg.args ?? []).join(' ')}
                onChange={(e) =>
                  setCfg((c) => ({ ...c, args: e.target.value.split(' ').filter(Boolean) }))
                }
                placeholder="/path/to/server.py"
                className={inputClass}
              />
              <p className="text-[10px] text-zinc-600 mt-1.5">Space-separated.</p>
            </div>
          </>
        )}

        {/* HTTP fields */}
        {cfg.transport === 'streamable_http' && (
          <div>
            <label className={labelClass}>URL</label>
            <input
              value={cfg.url ?? ''}
              onChange={(e) => setCfg((c) => ({ ...c, url: e.target.value }))}
              placeholder="http://localhost:8000/mcp"
              className={inputClass}
            />
          </div>
        )}

        {/* Env vars */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className={labelClass} style={{ marginBottom: 0 }}>
              Environment Variables
            </label>
            <button
              type="button"
              onClick={addEntry}
              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <Plus size={11} />
              Add
            </button>
          </div>

          {envEntries.length === 0 ? (
            <p className="text-sm text-zinc-600 italic">No env vars configured.</p>
          ) : (
            <div className="space-y-2">
              {envEntries.map((entry, i) => (
                <div key={i} className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={entry.key}
                    onChange={(e) => updateEntry(i, 'key', e.target.value)}
                    placeholder="KEY_NAME"
                    className="sm:w-36 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                  />
                  <div className="flex gap-2 flex-1">
                    <input
                      value={entry.value}
                      onChange={(e) => updateEntry(i, 'value', e.target.value)}
                      type={entry.masked ? 'password' : 'text'}
                      placeholder="value"
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => toggleMask(i)}
                      className="text-zinc-600 hover:text-zinc-400 transition-colors p-1.5"
                    >
                      {entry.masked ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeEntry(i)}
                      className="text-zinc-700 hover:text-rose-400 transition-colors p-1.5"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={mutation.isPending}
            className={clsx(
              'flex items-center gap-2 font-display font-bold text-[11px] uppercase tracking-[0.12em] px-5 py-2.5 rounded-lg transition-all',
              showSaved
                ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400'
                : 'bg-cyan-500 hover:bg-cyan-400 text-zinc-950 shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/20 disabled:bg-zinc-800 disabled:text-zinc-600',
            )}
          >
            {showSaved ? (
              <>
                <CheckCircle size={13} /> Saved
              </>
            ) : (
              <>
                <Save size={13} /> {mutation.isPending ? 'Saving…' : 'Save Changes'}
              </>
            )}
          </button>

          {mutation.isError && (
            <p className="text-[11px] text-rose-400 font-mono mt-2">{String(mutation.error)}</p>
          )}
        </div>
      </div>
    </div>
  )
}
