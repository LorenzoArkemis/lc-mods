export type Call = {
  id: string
  kind: 'tool' | 'command'
  // What the compact row shows: the tool, `skill:<name>`, or `/<command>`.
  name: string
  // What an expanded row shows: the command or main argument, as given.
  command: string
  status: 'running' | 'ok' | 'error' | 'denied'
  at: number
  agentId?: string
}

declare module 'claude-code' {
  interface PluginState {
    'call-history': { calls: Shaped<Call[]>; expanded: string[] }
  }
}
