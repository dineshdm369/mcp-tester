import type {
  AppConfig,
  RunDetail,
  RunMeta,
  Settings,
  StartRunRequest,
  StartRunResponse,
  Suite,
  SuggestVariantsRequest,
  SuggestVariantsResponse,
} from './types'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  suites: (): Promise<{ suites: Suite[] }> => get('/api/suites'),
  config: (): Promise<AppConfig> => get('/api/config'),
  runs: (): Promise<{ runs: RunMeta[] }> => get('/api/runs'),
  run: (date: string, runId: string): Promise<RunDetail> => get(`/api/runs/${date}/${runId}`),
  jobStatus: (date: string, runId: string): Promise<RunMeta> => get(`/api/jobs/${date}/${runId}`),
  startRun: (req: StartRunRequest): Promise<StartRunResponse> => post('/api/runs', req),
  cancelJob: (date: string, runId: string): Promise<{ ok: boolean }> =>
    fetch(`/api/jobs/${date}/${runId}`, { method: 'DELETE' }).then((r) => r.json()),
  settings: (): Promise<Settings> => get('/api/settings'),
  updateSettings: (data: unknown): Promise<{ ok: boolean }> => put('/api/settings', data),
  suggestVariants: (req: SuggestVariantsRequest): Promise<SuggestVariantsResponse> =>
    post('/api/suggest-variants', req),
}
