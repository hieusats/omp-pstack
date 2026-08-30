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
