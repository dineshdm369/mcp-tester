export interface ToolCallRecord {
  name: string
  arguments: Record<string, unknown>
  output: string
}

export interface TestResult {
  test_id: string
  date: string
  provider: string
  model: string
  suite: string
  family: string
  prompt: string
  expected_check: string[]
  actual_response: string
  verdict: 'Pass' | 'Partial Pass' | 'Fail' | 'Not graded'
  remarks: string[]
  issue_classes: string[]
  usage: Record<string, number | null>
  tool_calls: ToolCallRecord[]
}

export interface RunMeta {
  run_id: string
  date: string
  provider: string
  model: string
  suite: string
  suite_path: string
  suite_hash: string
  mcp_server: string
  temperature: number
  max_turns: number
  no_grade: boolean
  test_id_filter: string | null
  server_tag?: string | null
  started_at: string
  finished_at: string | null
  status: 'running' | 'complete' | 'failed' | 'cancelled'
  total: number
  completed: number
  pass_count: number
  partial_pass_count: number
  fail_count: number
  not_graded_count: number
  error?: string
}

export interface RunDetail {
  meta: RunMeta
  results: TestResult[]
}

export interface Suite {
  name: string
  path: string
  hash: string
}

export interface AppConfig {
  providers: string[]
  mcp_servers: string[]
}

export interface MCPServerConfig {
  transport: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
}

export interface Settings {
  servers: Record<string, MCPServerConfig>
}

export interface StartRunRequest {
  provider: string
  model: string
  suite: string
  mcp_server: string
  test_id?: string
  temperature: number
  max_turns: number
  no_grade: boolean
  server_tag?: string
}

export interface SuggestVariantsRequest {
  provider: string
  model: string
  failed_tests: Record<string, unknown>[]
}

export interface SuggestVariantsResponse {
  yaml: string
}

export interface StartRunResponse {
  run_id: string
  date: string
  status_url: string
  result_url: string
}
