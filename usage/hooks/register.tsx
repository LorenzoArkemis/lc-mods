import { atom, read, update } from 'claude-code'
import type { Register, SessionUsage } from 'claude-code'

import type { Usage } from '../types'

const last = atom({ plugin: 'usage', key: 'last' } as const, null)

const LABELS: Record<string, string> = {
  five_hour: '5h',
  seven_day: '7d',
  spend_limit: 'spend',
}

const toUsage = (u: Pick<SessionUsage, 'context' | 'rateLimits' | 'cost'>): Usage => ({
  contextTokens: u.context.tokens,
  contextWindow: u.context.window,
  contextPercent: u.context.percent,
  limits: u.rateLimits.map(({ kind, percentUsed, resetsAt }) => ({ kind, percentUsed, resetsAt })),
  usd: u.cost?.usd,
})

// The status line is plain text, so severity is a marker rather than a color.
const pct = (percent: number) => `${Math.round(percent)}%${percent >= 90 ? '!!' : percent >= 70 ? '!' : ''}`

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k` : `${n}`)

const resetIn = (iso: string | undefined, now: number) => {
  if (!iso) return ''
  const minutes = Math.max(0, Math.round((Date.parse(iso) - now) / 60_000))
  if (minutes < 60) return ` ↻${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return ` ↻${hours}h${minutes % 60}m`
  return ` ↻${Math.floor(hours / 24)}d${hours % 24}h`
}

// e.g. "ctx 42% 84k/200k · 5h 13% ↻2h10m · 7d 71%! ↻3d4h · $1.23"
const line = (u: Usage, now: number) =>
  [
    u.contextPercent === undefined
      ? `ctx – /${compact(u.contextWindow)}`
      : `ctx ${pct(u.contextPercent)} ${compact(u.contextTokens ?? 0)}/${compact(u.contextWindow)}`,
    ...u.limits.map(l => `${LABELS[l.kind] ?? l.kind} ${pct(l.percentUsed)}${resetIn(l.resetsAt, now)}`),
    ...(u.usd === undefined ? [] : [`$${u.usd.toFixed(2)}`]),
  ].join(' · ')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const show = async () => {
      const u = await read($, last)
      if (u) $.ui.status(line(u, await $.clock.now()))
    }

    const now = await $.session.usage()
    await update($, last, () => toUsage(now))
    await show()
    // Keep the reset countdowns current between measurements.
    $.clock.every(60_000, () => void show())

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const u = toUsage(e)
    await update($, last, () => u)
    $.ui.status(line(u, await $.clock.now()))

    return next(e)
  })
}
