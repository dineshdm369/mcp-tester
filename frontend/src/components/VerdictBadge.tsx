import clsx from 'clsx'

interface Props {
  verdict: string
  size?: 'sm' | 'md'
}

const verdictConfig: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Pass: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/25',
    dot: 'bg-emerald-400',
  },
  'Partial Pass': {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/25',
    dot: 'bg-amber-400',
  },
  Fail: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/25',
    dot: 'bg-rose-400',
  },
  'Not graded': {
    bg: 'bg-zinc-800',
    text: 'text-zinc-500',
    border: 'border-zinc-700',
    dot: 'bg-zinc-500',
  },
  running: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/25',
    dot: 'bg-blue-400',
  },
  complete: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/25',
    dot: 'bg-emerald-400',
  },
  failed: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/25',
    dot: 'bg-rose-400',
  },
  cancelled: {
    bg: 'bg-zinc-800',
    text: 'text-zinc-400',
    border: 'border-zinc-700',
    dot: 'bg-zinc-500',
  },
}

const fallback = verdictConfig['Not graded']

export function VerdictBadge({ verdict, size = 'sm' }: Props) {
  const cfg = verdictConfig[verdict] ?? fallback
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded border font-mono font-medium shrink-0',
        cfg.bg,
        cfg.text,
        cfg.border,
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
      )}
    >
      <span
        className={clsx('rounded-full shrink-0', cfg.dot, size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5')}
      />
      {verdict}
    </span>
  )
}

export function verdictStripeColor(verdict: string): string {
  const map: Record<string, string> = {
    Pass: 'border-l-emerald-500',
    'Partial Pass': 'border-l-amber-500',
    Fail: 'border-l-rose-500',
  }
  return map[verdict] ?? 'border-l-zinc-800'
}
