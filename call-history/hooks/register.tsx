import { atom, read, update } from "claude-code";
import type { Register } from "claude-code";

import type { Call } from "../types";

const PANE = "call-history";
const KEEP = 200;
// Change the tag when a call's fields change: it declines what an earlier
// version stored, which outlives a reload.
const calls = atom({ plugin: "call-history", key: "calls" } as const, [], {
  shape: "calls-3",
});
// Ids of the rows clicked open.
const expanded = atom({ plugin: "call-history", key: "expanded" } as const, []);

// The command or main argument of each tool; any other tool shows its arguments as JSON.
const DETAIL: Record<string, string> = {
  Bash: "command",
  Read: "file_path",
  Edit: "file_path",
  Write: "file_path",
  NotebookEdit: "notebook_path",
  Grep: "pattern",
  Glob: "pattern",
  Agent: "description",
  WebFetch: "url",
  WebSearch: "query",
};

// Keys tool.call carries beside the tool's own arguments.
const RESERVED = new Set([
  "tool",
  "tool_use_id",
  "consent",
  "agentId",
  "requestMeta",
]);

// Expanded rows hold this much; the full call is in the transcript.
const COMMAND_CHARS = 2000;
const EXPANDED_LINES = 12;

const nameOf = (e: Record<string, unknown>) =>
  e.tool === "Skill" && typeof e.skill === "string"
    ? `skill:${e.skill}`
    : (e.tool as string);

const commandOf = (e: Record<string, unknown>) => {
  if (e.tool === "Skill") return typeof e.args === "string" ? e.args : "";
  const key = DETAIL[e.tool as string];
  const value = key ? e[key] : undefined;
  if (typeof value === "string") return cut(value, COMMAND_CHARS);
  const args = Object.fromEntries(
    Object.entries(e).filter(([k]) => !RESERVED.has(k)),
  );
  return cut(JSON.stringify(args, null, 2), COMMAND_CHARS);
};

// ANSI color names, so the marks take the terminal's own palette; no color is dim.
const MARK: Record<Call["status"], [string, string | undefined]> = {
  running: ["…", "yellow"],
  ok: ["✓", "green"],
  error: ["✗", "red"],
  denied: ["⊘", undefined],
};

const clock = (ms: number) => new Date(ms).toTimeString().slice(0, 8);
const cut = (s: string, n: number) =>
  s.length > n ? s.slice(0, Math.max(0, n - 1)) + "…" : s;
const lines = (s: string) => {
  const all = s.split("\n");
  return all.length > EXPANDED_LINES
    ? [
        ...all.slice(0, EXPANDED_LINES),
        `… ${all.length - EXPANDED_LINES} more lines`,
      ]
    : all;
};

export const register: Register = (on) => {
  const settle = (id: string, status: Call["status"]) => (list: Call[]) =>
    list.map((one) => (one.id === id ? { ...one, status } : one));

  on("session.start", async ($, e, next) => {
    await $.command.register({
      name: "calls",
      description:
        "Show recent tool calls, skills and commands in a pane (/calls clear empties it)",
      argumentHint: "[clear]",
    });

    return next(e);
  });

  on("command.run", { command: "calls" }, async ($, e) => {
    if (e.args.trim() === "clear") {
      await update($, calls, () => []);
      await update($, expanded, () => []);
      return { text: "Call history cleared." };
    }
    await $.ui.open({
      id: PANE,
      title: "Call history",
      backgroundColor: "transparent",
    });

    return { text: "Call history pane opened." };
  });

  // Slash commands typed at the prompt, skills included.
  on("command.run", async ($, e, next) => {
    if (e.command === "calls") return next(e);
    const at = await $.clock.now();
    const call: Call = {
      id: `cmd-${at}-${e.command}`,
      kind: "command",
      name: `/${e.command}`,
      command: `/${e.command} ${e.args}`.trim(),
      status: "running",
      at,
    };
    await update($, calls, (list) => [...list, call].slice(-KEEP));
    try {
      const ran = await next(e);
      await update($, calls, settle(call.id, "ok"));
      return ran;
    } catch (err) {
      await update($, calls, settle(call.id, "error"));
      throw err;
    }
  }).catch(($, e, next) => next(e)); // a failed record never blocks the call

  on("tool.call", async ($, e, next) => {
    const at = await $.clock.now();
    const call: Call = {
      id: e.tool_use_id ?? `tool-${at}-${e.tool}`,
      kind: "tool",
      name: nameOf(e as Record<string, unknown>),
      command: commandOf(e as Record<string, unknown>),
      status: "running",
      at,
      agentId: e.agentId,
    };
    await update($, calls, (list) => [...list, call].slice(-KEEP));
    try {
      const ran = await next(e);
      const status =
        ran.deny !== undefined ? "denied" : ran.isError ? "error" : "ok";
      await update($, calls, settle(call.id, status));
      return ran;
    } catch (err) {
      await update($, calls, settle(call.id, "error"));
      throw err;
    }
  }).catch(($, e, next) => next(e)); // a failed record never blocks the call

  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e);
    const list = await read($, calls);
    const open = new Set(await read($, expanded));
    const room = Math.max(1, (e.viewport?.rows ?? 24) - 2);

    if (list.length === 0) return <Text dimColor>No calls yet.</Text>;

    const toggle = (id: string) => () =>
      void update($, expanded, (ids) =>
        ids.includes(id) ? ids.filter((one) => one !== id) : [...ids, id],
      );

    return (
      <Box flexDirection="column" backgroundColor="transparent">
        {list.slice(-room).map((call) => {
          const [glyph, color] = MARK[call.status];
          const isOpen = open.has(call.id);
          const isSkill =
            call.name.startsWith("skill:") || call.kind === "command";
          return (
            <Box flexDirection="column">
              <Button key={call.id} plain onPress={toggle(call.id)}>
                <Text dimColor>{isOpen ? "▾" : "▸"} </Text>
                <Text dimColor>{clock(call.at)} </Text>
                {color ? (
                  <Text color={color}>{glyph} </Text>
                ) : (
                  <Text dimColor>{glyph} </Text>
                )}
                {call.agentId ? <Text dimColor>↳ </Text> : ""}
                {isSkill ? (
                  <Text bold color="cyan">
                    {call.name}
                  </Text>
                ) : (
                  <Text bold>{call.name}</Text>
                )}
              </Button>
              {isOpen && (
                <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
                  {call.command && call.command !== "{}" ? (
                    lines(call.command).map((line) => (
                      <Text wrap="wrap">{line || " "}</Text>
                    ))
                  ) : (
                    <Text dimColor>no arguments</Text>
                  )}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    );
  });
};
