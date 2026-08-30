import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repo = join(import.meta.dir, "..");
const plugin = join(repo, "plugins", "pstack");

const read = (rel: string) => readFileSync(join(repo, rel), "utf8");

const HARNESS_SURFACES = [
  ".claude-plugin",
  ".agents",
  "plugins/pstack/.claude-plugin",
  "plugins/pstack/.codex-plugin",
  "plugins/pstack/hooks",
];

const BANNED_MARKERS = [
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

describe("omp-only distribution", () => {
  it("carries no Claude Code or Codex harness surface", () => {
    for (const rel of HARNESS_SURFACES) {
      expect(existsSync(join(repo, rel)), rel).toBe(false);
    }
  });

  it("ships the plugin manifest at omp's preferred path", () => {
    expect(existsSync(join(plugin, ".omp-plugin", "plugin.json"))).toBe(true);
  });

  it("keeps the catalog, plugin manifest, and UPSTREAM.md on one version", () => {
    const catalog = JSON.parse(read(".omp-plugin/marketplace.json"));
    const manifest = JSON.parse(read("plugins/pstack/.omp-plugin/plugin.json"));
    const upstream = read("UPSTREAM.md").match(
      /\| omp-pstack version \| `([^`]+)` \|/,
    )?.[1];
    expect(catalog.plugins[0].version).toBe(manifest.version);
    expect(manifest.version).toBe(upstream);
  });

  it("keeps harness names out of the skill tree", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (entry.name.endsWith(".md")) {
          const text = readFileSync(path, "utf8");
          for (const marker of BANNED_MARKERS) {
            if (text.includes(marker)) offenders.push(`${path}: ${marker}`);
          }
          if (/\bCodex\b/.test(text)) offenders.push(`${path}: Codex`);
        }
      }
    };
    walk(join(plugin, "skills"));
    expect(offenders).toEqual([]);
  });
});

describe("omp session mandate rule", () => {
  const rulePath = join(plugin, "rules", "pstack-session-mandate.md");

  it("exists with alwaysApply: true frontmatter", () => {
    expect(existsSync(rulePath)).toBe(true);
    const frontmatter = readFileSync(rulePath, "utf8").split("---")[1] ?? "";
    expect(frontmatter).toContain("name: pstack-session-mandate");
    expect(frontmatter).toContain("alwaysApply: true");
  });

  it("carries the poteto-mode routing omp-flat", () => {
    const rule = readFileSync(rulePath, "utf8");
    expect(rule).toContain("<EXTREMELY_IMPORTANT>");
    expect(rule).toContain("skill://poteto-mode");
    for (const skill of ["tdd", "architect", "how", "why", "arena", "interrogate"]) {
      expect(rule).toContain(`\`${skill}\``);
    }
    expect(rule).toContain("ignore this block");
    expect(rule).toContain("take precedence over this mandate");
    expect(rule).not.toContain("pstack:");
  });

  it("is documented as automatic in docs/omp.md", () => {
    expect(read("docs/omp.md")).toContain("rules/pstack-session-mandate.md");
  });
});

describe("agents parse under the omp task-agent contract", () => {
  it("every agents/*.md declares name and description frontmatter", () => {
    for (const file of readdirSync(join(plugin, "agents"))) {
      if (!file.endsWith(".md")) continue;
      const frontmatter =
        readFileSync(join(plugin, "agents", file), "utf8").split("---")[1] ?? "";
      expect(frontmatter, file).toMatch(/^name:\s*\S+/m);
      expect(frontmatter, file).toMatch(/^description:\s*\S+/m);
    }
  });
});
