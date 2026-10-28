import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'call-history',
  component: 'Pane',
  requestId: 'call-history',
  props: {
    title: 'Call history',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test('the pane lists tool calls, skills, errors and denials', async ($, on) => {
  on('command.register', () => ({ value: { command: 'calls' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: Date.UTC(2026, 9, 28, 14, 2, 11) }))
  on('tool.call', (_, e) =>
    e.tool === 'Read' ? { result: {}, isError: true } : e.tool === 'Write' ? { deny: 'no' } : { result: {} },
  )

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'ls  -la' })
  await $.tool.call({ tool: 'Skill', skill: 'plugin-authoring' })
  await $.tool.call({ tool: 'Read', file_path: '/tmp/missing' })
  await $.tool.call({ tool: 'Write', file_path: '/etc/x', content: '' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Button', text: /Bash/ }))?.text).toMatch(/✓ Bash$/)
    expect((await ui.find({ type: 'Button', text: /skill:plugin-authoring/ }))?.text).toMatch(/✓ skill:plugin-authoring$/)
    expect((await ui.find({ type: 'Button', text: /Read/ }))?.text).toMatch(/✗ Read$/)
    expect((await ui.find({ type: 'Button', text: /Write/ }))?.text).toMatch(/⊘ Write$/)
    await ui.unmount()
  }
})

test('/calls clear empties the history', async ($, on) => {
  on('command.register', () => ({ value: { command: 'calls' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: Date.UTC(2026, 9, 28, 14, 2, 11) }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.command.run({ command: 'calls', args: 'clear', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('No calls yet.')
  await ui.unmount()
})

test('a typed slash command is recorded', async ($, on) => {
  on('command.register', () => ({ value: { command: 'calls' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: Date.UTC(2026, 9, 28, 14, 2, 11) }))
  on('command.run', () => ({ text: 'done' }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'usage-pane', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Button', text: /usage-pane/ }))?.text).toMatch(/✓ \/usage-pane/)
  await ui.unmount()
})

test('clicking a row shows only its command, clicking again folds it', async ($, on) => {
  on('command.register', () => ({ value: { command: 'calls' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: Date.UTC(2026, 9, 28, 14, 2, 11) }))
  on('tool.call', () => ({ result: {}, text: 'total 0\nfile-a' }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'ls -la', tool_use_id: 't1' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /^ls -la$/ })).toBeUndefined()

    await ui.press({ key: 't1' })
    expect((await ui.find({ type: 'Text', text: /^ls -la$/ }))?.text).toBe('ls -la')
    expect(await ui.find({ type: 'Text', text: /file-a|"command"/ })).toBeUndefined()

    await ui.press({ key: 't1' })
    expect(await ui.find({ type: 'Text', text: /^ls -la$/ })).toBeUndefined()
    await ui.unmount()
  }
})
