import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from './components/Layout'
import { RunTests } from './pages/RunTests'
import { History } from './pages/History'
import { RunDetail } from './pages/RunDetail'
import { Compare } from './pages/Compare'
import { Settings } from './pages/Settings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/history" replace />} />
            <Route path="run" element={<RunTests />} />
            <Route path="history" element={<History />} />
            <Route path="runs/:date/:runId" element={<RunDetail />} />
            <Route path="compare" element={<Compare />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
