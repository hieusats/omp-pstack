import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repo = join(import.meta.dir, "..");

const read = (rel: string) => readFileSync(join(repo, rel), "utf8");

const fixturePath = join(repo, "tests/fixtures/omp-bundled-agents.json");

type BundledAgent = {
  name: string;
  model: string | null;
  tools: string[] | null;
  spawns: string[];
};

type RosterFixture = {
  ompVersion: string;
  commit: string;
  agents: BundledAgent[];
};

const loadFixture = () => JSON.parse(readFileSync(fixturePath, "utf8")) as RosterFixture;

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

const sectionOf = (text: string, heading: string) => {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) return null;
  const end = lines.findIndex((line, i) => i > start && line.startsWith("## "));
  return lines.slice(start + 1, end === -1 ? lines.length : end).join("\n");
};

const rowValue = (section: string, label: string) => {
  const line = section.split("\n").find((l) => l.includes(`| ${label} |`));
  const cell = line ? (line.split("|").map((c) => c.trim())[2] ?? null) : null;
  return cell === null ? null : cell.replaceAll("`", "");
};

const unquote = (value: string) => value.replace(/^"|"$/g, "");

const parseFrontmatter = (text: string) => {
  const lines = (text.split("---")[1] ?? "").split("\n");
  const scalars: Record<string, string> = {};
  const lists: Record<string, string[]> = {};
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^([\w-]+):\s*(.*)$/.exec(lines[i]);
    if (!match) continue;
    const [, key, value] = match;
    if (value !== "") {
      scalars[key] = unquote(value.trim());
      continue;
    }
    const items: string[] = [];
    while (i + 1 < lines.length) {
      const stripped = lines[i + 1].trimStart();
      if (!stripped.startsWith("- ")) break;
      items.push(unquote(stripped.slice(2).trim()));
      i += 1;
    }
    lists[key] = items;
  }
  return { scalars, lists };
};

const toBundledAgent = (text: string): BundledAgent => {
  const { scalars, lists } = parseFrontmatter(text);
  return {
    name: scalars.name ?? "",
    model: scalars.model ?? lists.model?.[0] ?? null,
    tools: lists.tools ?? null,
    spawns: lists.spawns ?? (scalars.spawns ? [scalars.spawns] : []),
  };
};

describe("omp upstream tracking", () => {
  it("keeps the bundled-agent fixture in shape", () => {
    const { agents } = loadFixture();
    expect(Array.isArray(agents)).toBe(true);
    expect(agents.length).toBeGreaterThanOrEqual(7);
    const names = agents.map((agent) => agent.name);
    expect(new Set(names).size).toBe(names.length);
    for (const agent of agents) {
      expect(typeof agent.name, agent.name).toBe("string");
      expect(agent.name.length, agent.name).toBeGreaterThan(0);
      expect(agent.model === null || typeof agent.model === "string", agent.name).toBe(true);
      expect(
        agent.tools === null || (Array.isArray(agent.tools) && agent.tools.every((tool) => typeof tool === "string")),
        agent.name,
      ).toBe(true);
      expect(Array.isArray(agent.spawns), agent.name).toBe(true);
    }
  });

  it("covers every wrapped role with a bundled agent", () => {
    const roles = readdirSync(join(repo, "plugins/pstack/agents"))
      .map((file) => /^pstack-(.+)\.md$/.exec(file)?.[1])
      .filter((role): role is string => Boolean(role));
    const names = new Set(loadFixture().agents.map((agent) => agent.name));
    for (const role of roles) {
      expect(names.has(role), `wrapped role ${role} is missing from the bundled roster`).toBe(true);
    }
  });

  it("documents the tracked omp upstream in UPSTREAM.md", () => {
    const section = sectionOf(read("UPSTREAM.md"), "## omp upstream");
    expect(section, "UPSTREAM.md needs an '## omp upstream' section").not.toBeNull();
    if (section === null) return;
    const { ompVersion, commit } = loadFixture();
    expect(rowValue(section, "Repository")).toBe("https://github.com/can1357/oh-my-pi.git");
    expect(rowValue(section, "Release")).toBe(ompVersion);
    expect(rowValue(section, "Commit")).toBe(commit);
    expect(section).toContain("git fetch omp main");
  });

  it("mentions omp upstream tracking in CHANGES.md", () => {
    expect(read("CHANGES.md")).toContain("omp upstream");
  });
});

describe("live omp roster", () => {
  const ompAvailable = spawnSync("which", ["omp"]).status === 0;

  if (!ompAvailable) {
    it.skip("requires the omp CLI", () => {});
    return;
  }

  it("reports the omp version pinned in the fixture", () => {
    const { ompVersion } = loadFixture();
    const version = spawnSync("omp", ["--version"], { encoding: "utf8" }).stdout;
    expect(version).toContain(ompVersion);
  });

  it("mirrors the roster unpacked from the omp CLI", () => {
    const fixture = loadFixture();
    const dir = mkdtempSync(join(tmpdir(), "omp-roster-"));
    const unpacked = spawnSync("omp", ["agents", "unpack", "--dir", dir], { encoding: "utf8" });
    expect(unpacked.status, unpacked.stderr).toBe(0);
    const parsed = readdirSync(dir)
      .filter((file) => file.endsWith(".md"))
      .map((file) => toBundledAgent(readFileSync(join(dir, file), "utf8")))
      .sort(byName);
    if (process.env.UPDATE_ROSTER === "1") {
      const version = spawnSync("omp", ["--version"], { encoding: "utf8" }).stdout.trim().replace(/^omp\//, "");
      const updated = { ompVersion: version, commit: fixture.commit, agents: parsed };
      writeFileSync(fixturePath, `${JSON.stringify(updated, null, 2)}\n`);
      expect(JSON.parse(readFileSync(fixturePath, "utf8"))).toEqual(updated);
      return;
    }
    const expected = [...fixture.agents].sort(byName);
    expect(parsed.length, "bundled agent count drifted from the fixture").toBe(expected.length);
    for (let i = 0; i < expected.length; i += 1) {
      expect(parsed[i], `agent ${expected[i].name} drifted from the bundled roster`).toEqual(expected[i]);
    }
  });
});
