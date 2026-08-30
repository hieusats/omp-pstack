import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EFFORTS, type Effort } from "./types.ts";

const PLUGIN_ROOT = join(import.meta.dir, "../../../..");
const DISPATCH_PATH = join(
  PLUGIN_ROOT,
  "skills/poteto-mode/references/provider-dispatch.md"
);
const SETUP_PATH = join(PLUGIN_ROOT, "skills/setup-pstack/SKILL.md");
const ARENA_PATH = join(PLUGIN_ROOT, "skills/arena/SKILL.md");
const SWARM_PATH = join(PLUGIN_ROOT, "skills/swarm/SKILL.md");
const HOW_PATH = join(PLUGIN_ROOT, "skills/how/SKILL.md");
const INTERROGATE_PATH = join(PLUGIN_ROOT, "skills/interrogate/SKILL.md");
const ARCHITECT_PATH = join(PLUGIN_ROOT, "skills/architect/SKILL.md");
const AGENTS_DIR = join(PLUGIN_ROOT, "agents");

const MATRIX_HEADER = [
  "Family",
  "Upstream pstack choice",
  "Provider",
  "Model",
  "Default effort",
  "Selectable efforts",
] as const;

const FAMILY_ORDER = ["fable", "sol", "grok", "opus"] as const;
const PROVIDERS = ["claude", "codex", "grok"] as const;
const OMP_ROLE_LANES = [
  { role: "scout", model: '"@smol"', tools: "read, grep, glob" },
  {
    role: "designer",
    model: '"@designer"',
    tools: "read, grep, glob, edit, write, browser",
  },
  { role: "reviewer", model: '"@slow"', tools: "read, grep, glob, bash, lsp" },
  { role: "security-reviewer", model: null, tools: "read, grep, glob" },
  { role: "librarian", model: '"@smol"', tools: "read, grep, glob, web_search" },
  { role: "task", model: '"@task"', tools: null, spawns: "[]" },
  { role: "sonic", model: '"@smol"', tools: "read, grep, glob, edit, write" },
] as const;
const DESCRIPTOR_RE =
  /(claude|codex|grok):[a-z0-9.-]+@(low|medium|high|xhigh|max)/g;
const PANEL_ROLES = [
  "how critics",
  "arena runners",
  "arena cross-judge pool",
  "architect runners",
  "interrogate reviewers",
] as const;
const SHEET_ROLES = [
  "feature, refactoring",
  "bug-fix",
  "perf-issue",
  "hillclimb",
  "judgment and prose",
  "hardest tasks",
  "how explorer",
  "how explainer",
  "how critics",
  "why investigators, synthesizer",
  "reflect tooling, judgment, divergent, synthesizer",
  "arena runners",
  "arena cross-judge pool",
  "swarm workers",
  "architect runners",
  "interrogate reviewers",
] as const;
const SETUP_SECTION_ORDER = [
  "### 2. Load current state",
  "### 3. Parse per-family efforts",
  "### 4. Collect one requested effort per family",
  "### 5. Probe the four requested pairs",
  "### 6. Render, preserving role families",
  "### 7. Confirm and commit",
] as const;

interface MatrixRow {
  family: string;
  upstreamChoice: string;
  provider: string;
  model: string;
  defaultEffort: Effort;
  selectableEfforts: Effort[];
}

function splitRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    throw new Error(`matrix row must be a pipe table: ${line}`);
  }
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim().replaceAll("`", ""));
}

function isSeparator(cells: string[]): boolean {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function asEffort(value: string): Effort {
  if ((EFFORTS as readonly string[]).includes(value)) {
    return value as Effort;
  }
  throw new Error(`not an effort: ${value}`);
}

function parseModelMatrix(markdown: string): MatrixRow[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === "## Provider panel");
  if (start < 0) {
    throw new Error("missing ## Provider panel");
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      end = i;
      break;
    }
  }
  const table = lines
    .slice(start + 1, end)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));
  if (table.length !== 6) {
    throw new Error(
      `provider panel must be header, separator, and 4 data rows, got ${table.length}`
    );
  }
  const header = splitRow(table[0]);
  if (header.join("|") !== MATRIX_HEADER.join("|")) {
    throw new Error(`unexpected matrix header: ${header.join(" | ")}`);
  }
  if (!isSeparator(splitRow(table[1]))) {
    throw new Error("matrix header separator missing");
  }
  return table.slice(2).map((line) => {
    const cells = splitRow(line);
    if (cells.length !== MATRIX_HEADER.length) {
      throw new Error(`matrix row has ${cells.length} cells: ${line}`);
    }
    const [family, upstreamChoice, provider, model, defaultEffortRaw, selectableRaw] =
      cells;
    if (!(PROVIDERS as readonly string[]).includes(provider)) {
      throw new Error(`invalid provider: ${provider}`);
    }
    const selectableEfforts = selectableRaw.split(/\s+/).map(asEffort);
    const defaultEffort = asEffort(defaultEffortRaw);
    if (!selectableEfforts.includes(defaultEffort)) {
      throw new Error(`${family} default effort is not selectable`);
    }
    return {
      family,
      upstreamChoice,
      provider,
      model,
      defaultEffort,
      selectableEfforts,
    };
  });
}

function defaultDescriptors(rows: MatrixRow[]): string[] {
  return rows.map(
    (row) => `${row.provider}:${row.model}@${row.defaultEffort}`
  );
}

function parseFrontmatter(text: string): {
  fields: Record<string, string>;
  body: string;
} {
  if (!text.startsWith("---\n")) {
    throw new Error("missing frontmatter");
  }
  const end = text.indexOf("\n---\n", 4);
  if (end < 0) {
    throw new Error("unterminated frontmatter");
  }
  const fields: Record<string, string> = {};
  for (const line of text.slice(4, end).split("\n")) {
    const idx = line.indexOf(": ");
    if (idx < 0) {
      throw new Error(`bad frontmatter line: ${line}`);
    }
    fields[line.slice(0, idx)] = line.slice(idx + 2);
  }
  return { fields, body: text.slice(end + 5) };
}

function firstRunSheet(setup: string): string {
  const match = setup.match(
    /```markdown\n(# pstack model configuration\n[\s\S]*?)```/
  );
  if (!match) {
    throw new Error("setup-pstack is missing the first-run sheet fence");
  }
  return match[1];
}

describe("provider panel", () => {
  const rows = parseModelMatrix(readFileSync(DISPATCH_PATH, "utf8"));
  const setup = readFileSync(SETUP_PATH, "utf8");
  const quad = defaultDescriptors(rows);

  it("owns the effort universe and first-run defaults", () => {
    expect([...EFFORTS]).toEqual(["low", "medium", "high", "xhigh", "max"]);
    expect(rows.map((row) => row.family)).toEqual([...FAMILY_ORDER]);
    for (const row of rows) {
      expect(row.upstreamChoice.length).toBeGreaterThan(0);
      expect(row.model.length).toBeGreaterThan(0);
      expect(row.selectableEfforts.length).toBeGreaterThan(0);
      expect(row.selectableEfforts).toEqual(
        EFFORTS.filter((effort) => row.selectableEfforts.includes(effort))
      );
    }
    expect(
      rows.map((row) => [row.family, row.defaultEffort])
    ).toEqual([
      ["fable", "max"],
      ["sol", "max"],
      ["grok", "xhigh"],
      ["opus", "xhigh"],
    ]);
  });

  it("ships exactly one native lane per omp bundled role", () => {
    const expected = new Set<string>();
    let sharedBody: string | null = null;
    for (const lane of OMP_ROLE_LANES) {
      const name = `pstack-${lane.role}`;
      expected.add(`${name}.md`);
      const text = readFileSync(join(AGENTS_DIR, `${name}.md`), "utf8");
      const { fields, body } = parseFrontmatter(text);
      expect(fields, name).toEqual({
        name,
        description: `Native pstack lane wrapping omp's ${lane.role} agent for pstack dispatch.`,
        ...(lane.model === null ? {} : { model: lane.model }),
        ...(lane.tools === null ? {} : { tools: lane.tools }),
        ...("spawns" in lane ? { spawns: lane.spawns } : {}),
      });
      if (sharedBody === null) {
        sharedBody = body;
      } else {
        expect(body, name).toBe(sharedBody);
      }
    }
    expect(expected.size).toBe(OMP_ROLE_LANES.length);
    if (sharedBody === null) throw new Error("no lane body read");
    expect(sharedBody).toContain("hard boundary");
    expect(sharedBody).toContain("`hub` process starts");
    const shipped = readdirSync(AGENTS_DIR)
      .filter((name) => name.startsWith("pstack-") && name.endsWith(".md"))
      .sort();
    expect(shipped).toEqual([...expected].sort());
  });

  it("keeps setup's first-run default panel copy aligned with the matrix", () => {
    const sheet = firstRunSheet(setup);
    const roles = sheet
      .split("\n")
      .filter((line) => line.includes(": "))
      .map((line) => line.slice(0, line.indexOf(": ")));
    expect(roles).toEqual([...SHEET_ROLES]);
    const byFamily = new Map<string, MatrixRow>(
      rows.map((row) => [`${row.provider}:${row.model}`, row])
    );
    for (const descriptor of sheet.match(DESCRIPTOR_RE) ?? []) {
      const at = descriptor.lastIndexOf("@");
      const key = descriptor.slice(0, at);
      const effort = descriptor.slice(at + 1);
      const row = byFamily.get(key);
      if (row === undefined) {
        throw new Error(`unknown first-run descriptor: ${descriptor}`);
      }
      expect(effort).toBe(row.defaultEffort);
    }
    const expectedPanel = quad.join(", ");
    for (const role of PANEL_ROLES) {
      const line = sheet
        .split("\n")
        .find((entry) => entry.startsWith(`${role}:`));
      if (line === undefined) {
        throw new Error(`missing first-run panel row: ${role}`);
      }
      expect(line).toBe(`${role}: ${expectedPanel}`);
    }
  });

  it("keeps setup's fail-closed reconfiguration order", () => {
    let previous = -1;
    for (const heading of SETUP_SECTION_ORDER) {
      const current = setup.indexOf(heading);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
    expect(setup).toContain("Do not invent a precedence rule.");
    expect(setup).toContain("Do not probe or write while any inconsistency is unresolved.");
    expect(setup).toContain("A failed probe writes nothing:");
    expect(setup).toContain("Run one probe per family");
    expect(setup).toContain("normalized complete role map from step 2");
    expect(setup).toContain("Every documented role remains present.");
    expect(setup).toContain("An effort-only rerun cannot change a role's family.");
  });

  it("binds native dispatch to the panel mapping", () => {
    const dispatch = readFileSync(DISPATCH_PATH, "utf8");
    const nativeStart = dispatch.indexOf("## Native lanes");
    const externalStart = dispatch.indexOf("## External lanes");
    expect(nativeStart).toBeGreaterThan(-1);
    expect(externalStart).toBeGreaterThan(nativeStart);
    const nativeLanes = dispatch.slice(nativeStart, externalStart);
    expect(nativeLanes).toContain("`pstack-<omp-role>`");
    expect(nativeLanes).toContain("task.agentModelOverrides");
  });

  it("anchors selector legality to the omp registry, not the panel", () => {
    const dispatch = readFileSync(DISPATCH_PATH, "utf8");
    expect(dispatch).toContain("## Provider panel");
    expect(dispatch).not.toContain("## Model matrix");
    expect(dispatch).toContain(
      "The panel is the first-run default group, not the legality domain of a lane selector."
    );
    expect(dispatch).toContain(
      "A native lane selector is legal when `omp models` lists its provider and model"
    );
    expect(dispatch).toContain(
      "| omp | native `task` lane | external runner |"
    );
    expect(setup).toContain("registry-native");
    expect(setup).toContain(
      "When the registry serves none of the panel families"
    );
    expect(setup).toContain(
      "`omp models` must list it, and its effort must be one of the thinking levels the registry lists for that model"
    );
  });
});

describe("arena resolves its panel from the omp lane sheet", () => {
  const arena = readFileSync(ARENA_PATH, "utf8");

  it("picks runners from the live lane sheet, not a dead sheet row", () => {
    expect(arena).toContain(
      "`pstack-*` lane rows under `task.agentModelOverrides` in `~/.omp/agent/config.yml`"
    );
    expect(arena).not.toContain("from the current harness's pstack model sheet");
    expect(arena).not.toContain(
      "Otherwise default to `claude:claude-fable-5@max`"
    );
  });

  it("defaults to omp's writer lanes and review judge", () => {
    expect(arena).toContain("`pstack-task` and `pstack-designer`");
    expect(arena).toContain("`pstack-reviewer`");
  });

  it("dispatches native lanes as pstack role agents so sheet overrides apply", () => {
    expect(arena).toContain(
      "`task` dispatches of the `pstack-<omp-role>` agents"
    );
    expect(arena).toContain("a lane without a sheet row is unconfigured");
  });

  it("fails closed on an unconfigured sheet", () => {
    expect(arena).toContain("unconfigured lanes");
    expect(arena).toContain("setup-pstack");
  });

  it("keeps the external provider panel as an explicit opt-in", () => {
    expect(arena).toContain("only when the operator asks for cross-provider signal");
  });
});

describe("panel skills resolve from the omp lane sheet", () => {
  const swarm = readFileSync(SWARM_PATH, "utf8");
  const how = readFileSync(HOW_PATH, "utf8");
  const interrogate = readFileSync(INTERROGATE_PATH, "utf8");
  const architect = readFileSync(ARCHITECT_PATH, "utf8");
  const LANE_SHEET =
    "`pstack-*` lane rows under `task.agentModelOverrides` in `~/.omp/agent/config.yml`";

  it("swarm picks its worker lane from the live sheet", () => {
    expect(swarm).toContain(LANE_SHEET);
    expect(swarm).toContain("Default `pstack-task`");
    expect(swarm).not.toContain("from the current harness's pstack model sheet");
    expect(swarm).not.toContain("Otherwise use `grok:grok-4.6@xhigh`");
  });

  it("how maps explorer, explainer, and critics onto read-only lanes", () => {
    expect(how).toContain("`pstack-scout`");
    expect(how).toContain("`pstack-reviewer`");
    expect(how).toContain("`pstack-security-reviewer`");
    expect(how).not.toContain("default `grok:grok-4.6@xhigh`");
    expect(how).not.toContain("default `claude:claude-fable-5@max`");
  });

  it("interrogate panels the read-only lanes and drops the dead sheet row", () => {
    expect(interrogate).toContain(LANE_SHEET);
    expect(interrogate).toContain(
      "`pstack-reviewer`, `pstack-security-reviewer`, and `pstack-librarian`"
    );
    expect(interrogate).toContain("| Reviewer A | `pstack-reviewer` |");
    expect(interrogate).not.toContain("from the current harness's pstack model sheet");
  });

  it("architect defers runner resolution to arena", () => {
    expect(architect).not.toContain("configured architect runners");
    expect(architect).toContain("Arena resolves the runners from omp's lane sheet");
  });

  it("each panel skill fails closed on an unconfigured sheet", () => {
    for (const text of [swarm, how, interrogate]) {
      expect(text).toContain("unconfigured lanes");
      expect(text).toContain("setup-pstack");
    }
  });
});
