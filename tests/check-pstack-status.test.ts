import { describe, expect, it } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pstackStatusLine, {
  LANES,
  STATUS_KEY,
  classifySheet,
  configPath,
  extractLaneEntries,
  parseSlug,
  readSheet,
  renderStatus,
} from "../plugins/pstack/extension/index.js";

const repo = join(import.meta.dir, "..");

// Mirrors the live task.agentModelOverrides block setup-pstack writes.
const LIVE_SHEET = [
  "compaction:",
  "  thresholdPercent: 50",
  "task:",
  "  agentModelOverrides:",
  "    pstack-scout: zai/glm-5.3-flash:max",
  "    pstack-librarian: zai/glm-5.3-flash:max",
  "    pstack-sonic: zai/glm-5.3-flash:max",
  "    pstack-designer: zai/glm-5.3:max",
  "    pstack-reviewer: zai/glm-5.3:max",
  "    pstack-security-reviewer: zai/glm-5.3:max",
  "    pstack-task: zai/glm-5.3:max",
  "display:",
  "  showTokenUsage: true",
  "",
].join("\n");

const laneEntries = (values: string[]) => LANES.map((key, i) => ({ key, value: values[i] }));

// scout, librarian, sonic run the flash model; the other four the full one.
const liveRows = () =>
  LANES.map((lane) => {
    const model = lane === "pstack-scout" || lane === "pstack-librarian" || lane === "pstack-sonic"
      ? "glm-5.3-flash"
      : "glm-5.3";
    const raw = `zai/${model}:max`;
    return { lane, raw, slug: { provider: "zai", model, effort: "max" } };
  });

describe("status line contract", () => {
  it("keys the line pstack and orders the canonical lanes", () => {
    expect(STATUS_KEY).toBe("pstack");
    expect([...LANES]).toEqual([
      "pstack-scout",
      "pstack-librarian",
      "pstack-sonic",
      "pstack-designer",
      "pstack-reviewer",
      "pstack-security-reviewer",
      "pstack-task",
    ]);
  });

  it("renders the three states byte-for-byte", () => {
    expect(renderStatus({ state: "unconfigured" })).toBe(
      "pstack: unconfigured - run /skill:setup-pstack",
    );
    const configured = classifySheet(extractLaneEntries(LIVE_SHEET));
    expect(renderStatus(configured)).toBe(
      "pstack: configured - 7 lanes: zai/glm-5.3-flash:max, zai/glm-5.3:max",
    );
    const inconsistent = classifySheet([
      { key: "pstack-runner", value: "zai/glm-5.3:low" },
      { key: "pstack-librarian", value: "zai/glm-5.3:max" },
      { key: "pstack-sonic", value: "zai/glm-5.3-flash:max" },
      { key: "pstack-designer", value: "zai/glm-5.3:max" },
      { key: "pstack-reviewer", value: "zai/glm-5.3:max" },
      { key: "pstack-security-reviewer", value: "zai/glm-5.3:max" },
    ]);
    expect(renderStatus(inconsistent)).toBe(
      "pstack: inconsistent - unknown lane: pstack-runner, missing lane: pstack-scout (+1 more)",
    );
  });
});

describe("parseSlug", () => {
  it("parses provider/model:effort selectors", () => {
    expect(parseSlug("zai/glm-5.3-flash:max")).toEqual({
      provider: "zai",
      model: "glm-5.3-flash",
      effort: "max",
    });
  });

  it("accepts the setup aliases verbatim", () => {
    expect(parseSlug("inherit-parent")).toEqual({ alias: "inherit-parent" });
    expect(parseSlug("auto")).toEqual({ alias: "auto" });
  });

  it("rejects mangled selectors", () => {
    expect(parseSlug("zai/glm-5.3:max@high")).toBeNull();
    expect(parseSlug("zai/glm-5.3:banana")).toBeNull();
    expect(parseSlug("glm-5.3:max")).toBeNull();
    expect(parseSlug("zai/glm-5.3")).toBeNull();
    expect(parseSlug("zai/glm 5.3:max")).toBeNull();
  });
});

describe("classifySheet", () => {
  it("reads an empty extraction as unconfigured", () => {
    expect(classifySheet([])).toEqual({ state: "unconfigured" });
  });

  it("names non-lane pstack-* keys as unknown lanes", () => {
    const sheet = classifySheet([{ key: "pstack-runner", value: "zai/glm-5.3:low" }]);
    expect(sheet.state).toBe("inconsistent");
    expect(sheet.problems![0]).toEqual({ code: "unknown-lane", message: "unknown lane: pstack-runner" });
  });

  it("names absent lanes as missing, in LANES order", () => {
    const sheet = classifySheet([{ key: "pstack-task", value: "zai/glm-5.3:max" }]);
    expect(sheet.state).toBe("inconsistent");
    const missing = sheet.problems!.filter((p) => p.code === "missing-lane");
    expect(missing).toHaveLength(6);
    expect(missing[0].message).toBe("missing lane: pstack-scout");
    expect(missing[5].message).toBe("missing lane: pstack-security-reviewer");
  });

  it("names bad selectors per lane", () => {
    const sheet = classifySheet(laneEntries([
      "zai/glm-5.3:max@high",
      "zai/glm-5.3:max",
      "zai/glm-5.3:banana",
      "zai/glm-5.3:max",
      "zai/glm-5.3:max",
      "zai/glm-5.3:max",
      "zai/glm-5.3:max",
    ]));
    expect(sheet.state).toBe("inconsistent");
    expect(sheet.problems![0].code).toBe("bad-slug");
    expect(sheet.problems![0].message).toBe("invalid selector for pstack-scout: zai/glm-5.3:max@high");
    expect(sheet.problems![1].message).toBe("invalid selector for pstack-sonic: zai/glm-5.3:banana");
  });

  it("accepts the setup aliases in place of selectors", () => {
    const sheet = classifySheet(LANES.map((key, i) => ({ key, value: i % 2 ? "auto" : "inherit-parent" })));
    expect(sheet.state).toBe("configured");
    expect(sheet.rows![0].slug).toEqual({ alias: "inherit-parent" });
    expect(sheet.rows![1].slug).toEqual({ alias: "auto" });
  });

  it("classifies the live sheet shape as configured, in LANES order", () => {
    const sheet = classifySheet(extractLaneEntries(LIVE_SHEET));
    expect(sheet.state).toBe("configured");
    expect(sheet.rows).toEqual(liveRows());
  });
});

describe("extractLaneEntries", () => {
  it("stops at the indentation window around agentModelOverrides", () => {
    const yaml = [
      "task:",
      "  agentModelOverrides:",
      "    pstack-scout: zai/a:low",
      "    other-agent: zai/x:low",
      "  prompt: keep",
      "display:",
      "  pstack-runner: zai/c:low",
      "",
    ].join("\n");
    expect(extractLaneEntries(yaml)).toEqual([{ key: "pstack-scout", value: "zai/a:low" }]);
  });

  it("parses CRLF config files", () => {
    const yaml = "task:\r\n  agentModelOverrides:\r\n    pstack-scout: zai/a:low\r\n";
    expect(extractLaneEntries(yaml)).toEqual([{ key: "pstack-scout", value: "zai/a:low" }]);
  });

  it("unquotes quoted values", () => {
    const yaml = [
      "task:",
      "  agentModelOverrides:",
      '    pstack-scout: "zai/a:low"',
      "    pstack-task: 'inherit-parent'",
      "",
    ].join("\n");
    expect(extractLaneEntries(yaml)).toEqual([
      { key: "pstack-scout", value: "zai/a:low" },
      { key: "pstack-task", value: "inherit-parent" },
    ]);
  });

  it("lets a repeated lane row win", () => {
    const yaml = [
      "task:",
      "  agentModelOverrides:",
      "    pstack-scout: zai/a:low",
      "    pstack-scout: zai/b:max",
      "",
    ].join("\n");
    expect(extractLaneEntries(yaml)).toEqual([{ key: "pstack-scout", value: "zai/b:max" }]);
  });

  it("ignores pstack- keys outside task.agentModelOverrides", () => {
    const yaml = [
      "rules:",
      "  pstack-runner: zai/a:low",
      "task:",
      "  prompt: x",
      "display:",
      "  pstack-runner: zai/c:low",
      "",
    ].join("\n");
    expect(extractLaneEntries(yaml)).toEqual([]);
  });

  it("returns nothing when the sheet block is absent", () => {
    expect(extractLaneEntries("task:\n  prompt: x\n")).toEqual([]);
    expect(extractLaneEntries("compaction:\n  thresholdPercent: 50\n")).toEqual([]);
  });
});

describe("renderStatus", () => {
  it("dedups selectors in LANES order, not value order", () => {
    const sheet = classifySheet(laneEntries([
      "zai/b:low", "zai/a:low", "zai/b:low", "zai/a:low", "zai/b:low", "zai/a:low", "zai/b:low",
    ]));
    expect(renderStatus(sheet)).toBe("pstack: configured - 7 lanes: zai/b:low, zai/a:low");
  });

  it("caps the configured line at three selectors plus N more", () => {
    const sheet = classifySheet(laneEntries([
      "zai/a:low", "zai/b:low", "zai/c:low", "zai/d:low", "zai/a:low", "zai/b:low", "zai/c:low",
    ]));
    expect(renderStatus(sheet)).toBe("pstack: configured - 7 lanes: zai/a:low, zai/b:low, zai/c:low +1 more");
  });

  it("caps the inconsistent line at two fragments plus N more", () => {
    const sheet = classifySheet([{ key: "pstack-runner", value: "zai/glm-5.3:low" }]);
    expect(sheet.problems).toHaveLength(8); // 1 unknown + all 7 lanes missing
    expect(renderStatus(sheet)).toBe(
      "pstack: inconsistent - unknown lane: pstack-runner, missing lane: pstack-scout (+6 more)",
    );
  });

  it("leads every line with the state word", () => {
    const sheets = [
      { state: "unconfigured" as const },
      classifySheet(extractLaneEntries(LIVE_SHEET)),
      classifySheet([{ key: "pstack-runner", value: "zai/glm-5.3:low" }]),
    ];
    for (const sheet of sheets) {
      expect(renderStatus(sheet)).toMatch(/^pstack: (unconfigured|configured|inconsistent)\b/);
    }
  });

  it("stays ASCII-only across every literal", () => {
    const outputs = [
      renderStatus({ state: "unconfigured" }),
      renderStatus(classifySheet(extractLaneEntries(LIVE_SHEET))),
      renderStatus(classifySheet(laneEntries([
        "zai/a:low", "zai/b:low", "zai/c:low", "zai/d:low", "zai/a:low", "zai/b:low", "zai/c:low",
      ]))),
      renderStatus(classifySheet([{ key: "pstack-runner", value: "zai/glm-5.3:low" }])),
      renderStatus(classifySheet([{ key: "pstack-scout", value: "zai/glm-5.3:banana" }])),
      renderStatus({
        state: "inconsistent",
        problems: [{ code: "unreadable-config", message: "config unreadable: EACCES: bad day" }],
      }),
    ];
    for (const text of outputs) {
      expect(text).toMatch(/^[\x20-\x7E]*$/);
    }
  });
});

describe("readSheet", () => {
  it("classifies a real config file and a missing one", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pstack-status-"));
    try {
      const file = join(dir, "config.yml");
      writeFileSync(file, LIVE_SHEET);
      expect(await readSheet(file)).toEqual({ state: "configured", rows: liveRows() });
      expect(await readSheet(join(dir, "missing.yml"))).toEqual({ state: "unconfigured" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.skipIf(process.getuid?.() === 0)("reports an unreadable config as inconsistent", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pstack-status-"));
    try {
      const locked = join(dir, "locked.yml");
      writeFileSync(locked, "task:\n");
      chmodSync(locked, 0o000);
      const sheet = await readSheet(locked);
      expect(sheet.state).toBe("inconsistent");
      expect(sheet.problems![0].code).toBe("unreadable-config");
      expect(sheet.problems![0].message.startsWith("config unreadable: ")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("locates the config under a home", () => {
    expect(configPath("/home/me")).toBe("/home/me/.omp/agent/config.yml");
  });
});

describe("plugin wiring", () => {
  it("registers exactly one silent session_start handler", async () => {
    const events: string[] = [];
    const handlers: Record<string, (event: unknown, ctx: unknown) => Promise<void>> = {};
    pstackStatusLine({
      on: (event, handler) => {
        events.push(event);
        handlers[event] = handler;
      },
    });
    expect(events).toEqual(["session_start"]);
    // A throwing status surface must not reject the handler.
    await handlers.session_start({}, {
      ui: { setStatus: () => { throw new Error("boom"); } },
    });
  });

  it("declares the extension through a minimal plugin package", () => {
    const pkg = JSON.parse(readFileSync(join(repo, "plugins/pstack/package.json"), "utf8"));
    expect(pkg.name).toBe("pstack");
    expect(pkg.private).toBe(true);
    expect(pkg.omp).toEqual({ extensions: ["./extension/index.js"] });
    expect("dependencies" in pkg).toBe(false);
    expect("version" in pkg).toBe(false);
    expect("type" in pkg).toBe(false);
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
