export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

export type Usage = {
  contextTokens?: number
  contextWindow: number
  contextPercent?: number
  limits: Limit[]
  usd?: number
}

declare module 'claude-code' {
  interface PluginState {
    usage: { last: Usage | null }
  }
}
