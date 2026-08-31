import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pstackStatusLine, {
  DISPATCH_MARKER,
  SKILL_PATH,
  SKILL_URI,
  STATUS_KEY,
  STATUS_TEXT,
  entryActivates,
  isActivationText,
  scanEntries,
} from "../plugins/pstack/extension/index.js";

const repo = join(import.meta.dir, "..");

type Handler = (event: unknown, ctx: unknown) => unknown;

const toolEntry = (args: unknown) => ({
  type: "custom",
  customType: "tool_execution_start",
  data: { toolName: "read", args, intent: "read the skill", startedAt: 1, toolCallId: "t1" },
});

const userMessage = (text: string) => ({
  type: "message",
  message: { role: "user", content: [{ type: "text", text }] },
});

const activatingArgs = JSON.stringify({ path: SKILL_URI });

function wire() {
  const events: string[] = [];
  const handlers: Record<string, Handler> = {};
  pstackStatusLine({
    on: (event, handler) => {
      events.push(event);
      handlers[event] = handler;
    },
  });
  return { events, handlers };
}

function recordingCtx(calls: Array<{ key: string; text: string }>) {
  return {
    ui: {
      setStatus: (key: string, text: string) => {
        calls.push({ key, text });
      },
    },
  };
}

describe("markers", () => {
  it("carries the exact activation markers and status text", () => {
    expect(STATUS_KEY).toBe("pstack");
    expect(STATUS_TEXT).toBe("pstack: poteto-mode");
    expect(SKILL_URI).toBe("skill://poteto-mode");
    expect(SKILL_PATH).toBe("skills/poteto-mode/SKILL.md");
    expect(DISPATCH_MARKER).toBe('User invoked the "poteto-mode" skill');
  });
});

describe("isActivationText", () => {
  it("matches the dispatch marker", () => {
    expect(isActivationText(DISPATCH_MARKER)).toBe(true);
    expect(isActivationText(`Saw: ${DISPATCH_MARKER} — applying the style.`)).toBe(true);
  });

  it("rejects prose that merely mentions poteto-mode", () => {
    expect(isActivationText("Should I read skill://poteto-mode first?")).toBe(false);
    expect(isActivationText("poteto-mode is my working style")).toBe(false);
    expect(isActivationText('User invoked the "deslop" skill')).toBe(false);
    expect(isActivationText("")).toBe(false);
    expect(isActivationText(undefined)).toBe(false);
    expect(isActivationText(null)).toBe(false);
    expect(isActivationText(42)).toBe(false);
  });
});

describe("entryActivates", () => {
  it("activates on a custom tool_execution_start entry carrying the skill URI", () => {
    expect(entryActivates(toolEntry(activatingArgs))).toBe(true);
  });

  it("activates on a filesystem path ending in the SKILL.md suffix", () => {
    const args = JSON.stringify({ path: `/home/x/.omp/plugins/pstack/${SKILL_PATH}` });
    expect(entryActivates(toolEntry(args))).toBe(true);
  });

  it("activates when the journal persists the arguments as a parsed object", () => {
    expect(entryActivates(toolEntry({ path: SKILL_URI }))).toBe(true);
    expect(entryActivates(toolEntry({ path: `/x/${SKILL_PATH}` }))).toBe(true);
    expect(entryActivates(toolEntry({ path: ".", i: "map repo" }))).toBe(false);
    expect(entryActivates(toolEntry({ path: "skill://deslop" }))).toBe(false);
  });

  it("activates on a user message entry whose text blocks carry the marker", () => {
    const entry = {
      type: "message",
      message: {
        role: "user",
        content: [
          { type: "text", text: "On it." },
          { type: "text", text: `${DISPATCH_MARKER} — keep it tight.` },
        ],
      },
    };
    expect(entryActivates(entry)).toBe(true);
  });

  it("rejects near misses", () => {
    expect(entryActivates(toolEntry(JSON.stringify({ path: "." })))).toBe(false);
    expect(entryActivates(toolEntry(JSON.stringify({ path: "skill://deslop" })))).toBe(false);
    expect(entryActivates(toolEntry(JSON.stringify({ path: "skills/poteto-mode/README.md" })))).toBe(false);
    expect(entryActivates(toolEntry("{}"))).toBe(false);
    expect(entryActivates(toolEntry(42))).toBe(false);
    expect(
      entryActivates({
        type: "message",
        message: { role: "assistant", content: [{ type: "text", text: DISPATCH_MARKER }] },
      }),
    ).toBe(false);
    expect(entryActivates(userMessage("please read skills/poteto-mode/SKILL.md for me"))).toBe(false);
    expect(entryActivates({ type: "custom", customType: "tool_execution_end", data: { args: activatingArgs } })).toBe(false);
    expect(entryActivates(SKILL_URI)).toBe(false);
    expect(entryActivates(null)).toBe(false);
    expect(entryActivates(undefined)).toBe(false);
  });
});

describe("scanEntries", () => {
  const fixture = [
    { type: "session" },
    userMessage("fix the flaky test"),
    {
      type: "message",
      message: { role: "assistant", content: [{ type: "text", text: "On it." }] },
    },
    toolEntry(activatingArgs),
    { type: "custom", customType: "tool_execution_end", data: { toolCallId: "t1" } },
  ];

  it("finds an activation in a fixture journal slice", () => {
    expect(scanEntries(fixture)).toBe(true);
  });

  it("returns false without a signal and for non-arrays", () => {
    expect(scanEntries([userMessage("fix the flaky test")])).toBe(false);
    expect(scanEntries([])).toBe(false);
    expect(scanEntries(undefined)).toBe(false);
    expect(scanEntries(activatingArgs)).toBe(false);
  });
});

describe("plugin wiring", () => {
  it("wires session_start, before_agent_start, tool_execution_start, and turn_end", () => {
    expect(wire().events).toEqual([
      "session_start",
      "before_agent_start",
      "tool_execution_start",
      "turn_end",
    ]);
  });

  it("draws nothing before activation", () => {
    const calls: Array<{ key: string; text: string }> = [];
    const { handlers } = wire();
    const ctx = recordingCtx(calls);
    handlers.session_start({}, ctx);
    handlers.tool_execution_start({ data: { toolName: "bash", args: JSON.stringify({ command: "ls ." }) } }, ctx);
    expect(calls).toEqual([]);
  });

  it("draws the exact STATUS_TEXT after an activating tool_execution_start", () => {
    const calls: Array<{ key: string; text: string }> = [];
    const { handlers } = wire();
    handlers.tool_execution_start(
      { data: { toolName: "read", args: activatingArgs } },
      recordingCtx(calls),
    );
    expect(calls).toEqual([{ key: STATUS_KEY, text: "pstack: poteto-mode" }]);
  });

  it("accepts the payload both directly and nested under .data", () => {
    const directTool: Array<{ key: string; text: string }> = [];
    const { handlers } = wire();
    handlers.tool_execution_start(
      { toolName: "read", args: activatingArgs },
      recordingCtx(directTool),
    );
    expect(directTool).toEqual([{ key: STATUS_KEY, text: STATUS_TEXT }]);

    const directPrompt: Array<{ key: string; text: string }> = [];
    handlers.before_agent_start({ prompt: DISPATCH_MARKER }, recordingCtx(directPrompt));
    expect(directPrompt).toEqual([{ key: STATUS_KEY, text: STATUS_TEXT }]);

    const nestedPrompt: Array<{ key: string; text: string }> = [];
    handlers.before_agent_start(
      { data: { prompt: DISPATCH_MARKER, images: [] } },
      recordingCtx(nestedPrompt),
    );
    expect(nestedPrompt).toEqual([{ key: STATUS_KEY, text: STATUS_TEXT }]);
  });

  it("latches once and re-asserts on later events", () => {
    const calls: Array<{ key: string; text: string }> = [];
    const { handlers } = wire();
    handlers.before_agent_start({ prompt: DISPATCH_MARKER }, recordingCtx(calls));
    handlers.tool_execution_start(
      { data: { toolName: "read", args: "{}" } },
      recordingCtx(calls),
    );
    handlers.session_start({}, recordingCtx(calls));
    expect(calls).toEqual([
      { key: STATUS_KEY, text: STATUS_TEXT },
      { key: STATUS_KEY, text: STATUS_TEXT },
      { key: STATUS_KEY, text: STATUS_TEXT },
    ]);
  });

  it("stays silent when the status surface throws", () => {
    const { handlers } = wire();
    const throwing = {
      ui: {
        setStatus: () => {
          throw new Error("boom");
        },
      },
    };
    handlers.before_agent_start({ prompt: DISPATCH_MARKER }, throwing);
    handlers.tool_execution_start({ data: { toolName: "read", args: activatingArgs } }, throwing);
    handlers.session_start({}, throwing);
  });

  it("rescans journal entries on session_start via the session manager", () => {
    const calls: Array<{ key: string; text: string }> = [];
    const { handlers } = wire();
    const ctx = {
      ...recordingCtx(calls),
      sessionManager: {
        getBranch: () => ({
          getEntries: () => [userMessage("fix the flaky test"), toolEntry(activatingArgs)],
        }),
      },
    };
    handlers.session_start({}, ctx);
    expect(calls).toEqual([{ key: STATUS_KEY, text: STATUS_TEXT }]);
  });

  it("skips the rescan when no session manager is present", () => {
    const calls: Array<{ key: string; text: string }> = [];
    const { handlers } = wire();
    handlers.session_start({}, recordingCtx(calls));
    expect(calls).toEqual([]);
  });

  it("rescans the journal on turn_end when the mid-turn tool event drew nothing", () => {
    const calls: Array<{ key: string; text: string }> = [];
    const { handlers } = wire();
    handlers.tool_execution_start(
      { data: { toolName: "read", args: activatingArgs } },
      {},
    );
    const ctx = {
      ...recordingCtx(calls),
      sessionManager: {
        getBranch: () => ({ getEntries: () => [toolEntry(activatingArgs)] }),
      },
    };
    handlers.turn_end({}, ctx);
    expect(calls).toEqual([{ key: STATUS_KEY, text: STATUS_TEXT }]);
  });

  it("re-asserts on turn_end once latched and stays quiet otherwise", () => {
    const calls: Array<{ key: string; text: string }> = [];
    const { handlers } = wire();
    handlers.before_agent_start({ prompt: DISPATCH_MARKER }, recordingCtx(calls));
    handlers.turn_end({}, recordingCtx(calls));
    expect(calls).toEqual([
      { key: STATUS_KEY, text: STATUS_TEXT },
      { key: STATUS_KEY, text: STATUS_TEXT },
    ]);

    const quiet: Array<{ key: string; text: string }> = [];
    const { handlers: fresh } = wire();
    fresh.turn_end({}, recordingCtx(quiet));
    expect(quiet).toEqual([]);
  });
});

describe("static checks", () => {
  it("declares the extension through a minimal plugin package", () => {
    const pkg = JSON.parse(readFileSync(join(repo, "plugins/pstack/package.json"), "utf8"));
    expect(pkg.name).toBe("pstack");
    expect(pkg.private).toBe(true);
    expect(pkg.omp).toEqual({ extensions: ["./extension/index.js"] });
    expect("dependencies" in pkg).toBe(false);
    expect("version" in pkg).toBe(false);
    expect(existsSync(join(repo, "plugins/pstack/extension/index.js"))).toBe(true);
    expect(typeof pstackStatusLine).toBe("function");
  });

  it("keeps harness names out of the new runtime files", () => {
    const markers = [
      "Claude Code",
      "CLAUDE.md",
      "AskUserQuestion",
      "TodoWrite",
      ".claude-plugin",
      ".codex-plugin",
      ".agents/plugins",
      "hooks.json",
      "codex-tools.md",
      "spawn_agent",
      "update_plan",
      "subagent_type",
    ];
    for (const rel of ["plugins/pstack/package.json", "plugins/pstack/extension/index.js"]) {
      const text = readFileSync(join(repo, rel), "utf8");
      for (const marker of markers) {
        expect(text.includes(marker), `${rel}: ${marker}`).toBe(false);
      }
      expect(/\bCodex\b/.test(text), `${rel}: Codex`).toBe(false);
    }
  });

  it("holds the distribution at 2.2.0 across all three version homes", () => {
    const catalog = JSON.parse(readFileSync(join(repo, ".omp-plugin/marketplace.json"), "utf8"));
    const manifest = JSON.parse(readFileSync(join(repo, "plugins/pstack/.omp-plugin/plugin.json"), "utf8"));
    const upstream = readFileSync(join(repo, "UPSTREAM.md"), "utf8").match(
      /\| omp-pstack version \| `([^`]+)` \|/,
    )?.[1];
    expect(catalog.plugins[0].version).toBe("2.2.0");
    expect(manifest.version).toBe("2.2.0");
    expect(upstream).toBe("2.2.0");
  });
});
