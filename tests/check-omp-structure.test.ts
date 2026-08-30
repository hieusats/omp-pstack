import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repo = join(import.meta.dir, "..");
const plugin = join(repo, "plugins", "pstack");

const read = (rel: string) => readFileSync(join(repo, rel), "utf8");

describe("omp-preferred catalog", () => {
  it("ships .omp-plugin/marketplace.json byte-identical to the Claude catalog", () => {
    expect(read(".omp-plugin/marketplace.json")).toBe(
      read(".claude-plugin/marketplace.json"),
    );
  });

  it("keeps every manifest and UPSTREAM.md on one version", () => {
    const ompCatalog = JSON.parse(read(".omp-plugin/marketplace.json"));
    const claudeCatalog = JSON.parse(read(".claude-plugin/marketplace.json"));
    const claudePlugin = JSON.parse(
      read("plugins/pstack/.claude-plugin/plugin.json"),
    );
    const codexPlugin = JSON.parse(
      read("plugins/pstack/.codex-plugin/plugin.json"),
    );
    const upstream = read("UPSTREAM.md").match(
      /\| open-pstack version \| `([^`]+)` \|/,
    )?.[1];
    expect(ompCatalog.plugins[0].version).toBe(claudeCatalog.plugins[0].version);
    expect(claudeCatalog.plugins[0].version).toBe(claudePlugin.version);
    expect(claudePlugin.version).toBe(codexPlugin.version);
    expect(claudePlugin.version).toBe(upstream);
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

  it("keeps the routing the Claude hook mandate carries, omp-flat", () => {
    const rule = readFileSync(rulePath, "utf8");
    const hook = readFileSync(
      join(plugin, "hooks", "session-start-context.md"),
      "utf8",
    );
    expect(rule).toContain("<EXTREMELY_IMPORTANT>");
    expect(rule).toContain("skill://poteto-mode");
    for (const marker of [
      "non-trivial engineering task",
      "ignore this block",
      "take precedence over this mandate",
    ]) {
      expect(rule, "rule").toContain(marker);
      expect(hook, "hook must stay in sync with the rule").toContain(marker);
    }
    for (const skill of ["tdd", "architect", "how", "why", "arena", "interrogate"]) {
      expect(rule, "rule").toContain(`\`${skill}\``);
      expect(hook, "hook must stay in sync with the rule").toContain(
        `\`pstack:${skill}\``,
      );
    }
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
