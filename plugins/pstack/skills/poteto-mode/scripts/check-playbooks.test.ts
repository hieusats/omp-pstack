import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const playbooksDir = join(import.meta.dir, "..", "playbooks");
const playbook = (name: string) =>
  readFileSync(join(playbooksDir, `${name}.md`), "utf8");

const COMMIT_GATE = "Run `/deslop` before each commit and `/no-comments` before review";
const COMMITTING_PLAYBOOKS = [
  "autonomous-run",
  "bug-fix",
  "feature",
  "hillclimb",
  "multi-phase-plan",
  "refactoring",
] as const;

describe("commit gates ride the playbook step lists", () => {
  for (const name of COMMITTING_PLAYBOOKS) {
    it(`${name} binds deslop and no-comments to its commit steps`, () => {
      const text = playbook(name);
      expect(text).toContain(COMMIT_GATE.replace(/ and .*/, ""));
      expect(text).toContain("/no-comments");
    });
  }

  it("opening-a-pr keeps the commit-time gates too", () => {
    const text = playbook("opening-a-pr");
    expect(text).toContain("Run `/deslop` over the diff before commit");
    expect(text).toContain("Run `/no-comments` before review");
  });
});

describe("autonomous-run survives the audited failure modes", () => {
  const text = playbook("autonomous-run");

  it("rebuilds the todolist after compaction", () => {
    expect(text).toContain("after a compaction rebuild it from `git log`");
  });

  it("keeps the Principles-read item and phase marking in the checkpoint step", () => {
    expect(text).toContain("Principles-read item");
    expect(text).toContain("phases get marked done as they land");
  });
});

describe("skill-level dispatch and edit rules", () => {
  const skill = readFileSync(join(import.meta.dir, "..", "SKILL.md"), "utf8");

  it("bans sed -i and ad-hoc script rewrites on tracked source", () => {
    expect(skill).toContain("never `sed -i`, `perl -i`, or ad-hoc script rewrites on tracked source");
  });

  it("pins the dispatch contract fields for tasks[] and context", () => {
    expect(skill).toContain("`# Target`, `# Change`, and `# Acceptance`");
    expect(skill).toContain("`# Goal`, `# Constraints`, and `# Contract`");
  });
});

describe("second session audit gates", () => {
  it("feature step 1 makes a skipped how visible", () => {
    expect(playbook("feature")).toContain("how skipped: <reason>");
  });

  it("pins the edit-anchor discipline", () => {
    const skill = readFileSync(join(import.meta.dir, "..", "SKILL.md"), "utf8");
    expect(skill).toContain("content-hash tag from the latest `read` or `write` response");
    expect(skill).toContain("`:raw` is a `read` selector, never an edit header");
  });

  it("bans re-initializing the todolist to summarize completion", () => {
    const skill = readFileSync(join(import.meta.dir, "..", "SKILL.md"), "utf8");
    expect(skill).toContain("never re-init a fresh todolist to summarize completed work");
  });
});

describe("third session audit gates", () => {
  const skill = readFileSync(join(import.meta.dir, "..", "SKILL.md"), "utf8");

  it("defines the multi-step floor for the todolist rule", () => {
    expect(skill).toContain(
      "the moment it dispatches a subagent, runs a command to verify its own work, or edits any file",
    );
  });

  it("anchors the throughput checkpoint to the floor", () => {
    expect(skill).toContain(
      "Any task past the multi-step floor → write the throughput checkpoint",
    );
  });

  it("investigation step 1 makes a skipped how visible", () => {
    expect(playbook("investigation")).toContain("how skipped: <reason>");
  });

  it("names the one-line checkpoint form for read-only floor tasks", () => {
    expect(skill).toContain("throughput checkpoint: n/a, read-only");
  });

  it("makes a direct investigation answer without how visible in the reply", () => {
    expect(skill).toContain(
      "names the skip in the reply as `how skipped: <reason>`",
    );
  });
});

describe("verifier round reply contract", () => {
  it("makes the checkpoint line part of the reply format", () => {
    const skill = readFileSync(join(import.meta.dir, "..", "SKILL.md"), "utf8");
    expect(skill).toContain("Every reply ends with the throughput checkpoint line");
    expect(skill).toContain("A reply without it is not done");
  });
});

describe("loop round one delegation bounds", () => {
  const skill = readFileSync(join(import.meta.dir, "..", "SKILL.md"), "utf8");

  it("bounds delegated depth in the dispatch defaults", () => {
    expect(skill).toContain("Depth is part of the contract");
  });

  it("sizes hub waits to remaining work instead of blocking blind", () => {
    expect(skill).toContain(
      "Size a `hub wait` timeout to the work you still owe after the result",
    );
  });
});

describe("eval blinding survives an upstream sync", () => {
  it("keeps the omp non-isolation warning", () => {
    const text = playbook("eval");
    expect(text).toContain("no probe is born isolated");
    expect(text).toContain("report the run as non-isolated");
  });
});

describe("playbook cross-references resolve", () => {
  const files = readdirSync(playbooksDir).filter((f) => f.endsWith(".md"));

  it("every playbook referenced from another playbook exists", () => {
    for (const file of files) {
      const text = readFileSync(join(playbooksDir, file), "utf8");
      const refs = [...text.matchAll(/\(([a-z-]+\.md)\)/g)].map((m) => m[1]);
      for (const ref of refs) {
        expect(files, `${file} -> ${ref}`).toContain(ref);
      }
    }
  });
});
