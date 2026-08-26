import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CONTRACT, checkPlan, extractSkeleton } from "./check-plan.mjs";

const SCRIPT = join(import.meta.dir, "check-plan.mjs");
const PLAYBOOK = join(import.meta.dir, "../playbooks/multi-phase-plan.md");
const directories: string[] = [];

const FORBIDDEN_FENCE = [
  "/goal",
  "/loop",
  "control-ui",
  "control-cli",
  "git show origin/main:",
  "grok-4.6-fast-xhigh",
  "~/.claude",
  "../references/",
];

type CheckPlanResult = {
  readonly problems: string[];
  readonly report: string[];
  readonly prCount: number;
  readonly ok: boolean;
};

function replaceOnce(source: string, target: string, replacement: string): string {
  const first = source.indexOf(target);
  if (first === -1) {
    throw new Error(`missing mutation target: ${JSON.stringify(target)}`);
  }
  const second = source.indexOf(target, first + target.length);
  if (second !== -1) {
    throw new Error(`duplicated mutation target: ${JSON.stringify(target)}`);
  }
  return (
    source.slice(0, first) + replacement + source.slice(first + target.length)
  );
}

function removePhrase(source: string, phrase: string): string {
  if (!source.includes(phrase)) {
    throw new Error(`missing contract phrase: ${JSON.stringify(phrase)}`);
  }
  return source.split(phrase).join("");
}

function contractPhrases(): string[] {
  const phrases: string[] = [
    CONTRACT.rule,
    CONTRACT.laneSentence,
    ...CONTRACT.programSections,
    ...CONTRACT.howToReadMarkers.filter((marker): marker is string => typeof marker === "string"),
    ...CONTRACT.programMarkers.filter((marker): marker is string => typeof marker === "string"),
    ...CONTRACT.prBlocks.map((block) => block.name),
  ];
  for (const block of CONTRACT.prBlocks) {
    if (block.leads) phrases.push(...block.leads);
    if (block.words) phrases.push(...block.words);
    if (block.shape === "lanes") {
      for (let i = 1; i <= CONTRACT.laneCount; i++) {
        phrases.push(`Lane ${i}.`);
      }
    }
  }
  return [...new Set(phrases)];
}

function problemsOf(source: string, file = "plan.md"): string[] {
  return (checkPlan(source, file) as CheckPlanResult).problems;
}

function runNode(args: readonly string[]): {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
} {
  const result = Bun.spawnSync(["node", SCRIPT, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    status: result.exitCode ?? 1,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

async function writePlan(source: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "check-plan-"));
  directories.push(directory);
  const file = join(directory, "plan.md");
  await writeFile(file, source);
  return file;
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const playbook = await readFile(PLAYBOOK, "utf8");
const skeleton = extractSkeleton(playbook);

describe("check-plan", () => {
  it("accepts the extracted playbook skeleton", () => {
    const result = checkPlan(skeleton, "skeleton.md") as CheckPlanResult;
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.prCount).toBe(1);
    expect(result.report[0]).toContain("verify-live=10");
    expect(result.report[0]).toContain("verify-perf=4");
  });

  it("rejects the playbook file as checker input", () => {
    const result = checkPlan(playbook, "multi-phase-plan.md") as CheckPlanResult;
    expect(result.ok).toBe(false);
    expect(result.problems.some((problem) => problem.includes("no H1 title"))).toBe(true);
  });

  it("keeps the copied fence free of harness-private strings", () => {
    for (const item of FORBIDDEN_FENCE) {
      expect(skeleton.includes(item), item).toBe(false);
    }
    expect(/30[- ]minute/.test(skeleton)).toBe(true);
    expect(skeleton).toContain(CONTRACT.laneSentence);
  });

  it("makes every contract phrase load-bearing", () => {
    for (const phrase of contractPhrases()) {
      expect(skeleton.includes(phrase), phrase).toBe(true);
      const mutated = removePhrase(skeleton, phrase);
      expect(problemsOf(mutated).length).toBeGreaterThan(0);
    }
  });

  it("accepts an ungated review block", () => {
    const ungated = replaceOnce(
      skeleton,
      `**Review gate.** The operator reviews before merge.

- [ ] Copy lane <n> screenshots into \`<media path>/<pr-id>-review-<slug>.png\`.
- [ ] Record a 30 to 60 second video of the change on a live lane. Save it as \`<media path>/<pr-id>-review.mp4\`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.`,
      "**Review gate.** None. PR1 is not review-gated.",
    );
    const result = checkPlan(ungated, "ungated.md") as CheckPlanResult;
    expect(result.problems).toEqual([]);
  });

  it.each([
    [
      "a missing Program checklist",
      replaceOnce(skeleton, "## Program checklist", "## Program list"),
      "no \"## Program checklist\" section",
    ],
    [
      "reordered program and PR headings",
      replaceOnce(
        replaceOnce(
          replaceOnce(skeleton, "## Program checklist", "## TMP heading"),
          "## <Task as a verb phrase> (<PR id>)",
          "## Program checklist",
        ),
        "## TMP heading",
        "## <Task as a verb phrase> (<PR id>)",
      ),
      "no PR sections between Program checklist and Close the program",
    ],
    [
      "reordered PR blocks",
      replaceOnce(
        replaceOnce(
          replaceOnce(skeleton, "**Build.**", "**TMP.**"),
          "**You see.**",
          "**Build.**",
        ),
        "**TMP.**",
        "**You see.**",
      ),
      "sub-blocks are",
    ],
    [
      "empty Depends on rest",
      replaceOnce(skeleton, "**Depends on.** <PR id, or None.>", "**Depends on.**"),
      "Depends on names nothing",
    ],
    [
      "Files with no box",
      replaceOnce(
        skeleton,
        `**Files.**

- [ ] Edit \`<path>\`.
- [ ] Create \`<path>\`.
- [ ] Delete \`<path>\`.`,
        "**Files.**",
      ),
      "Files. has no box",
    ],
    [
      "a dropped live lane",
      replaceOnce(
        skeleton,
        "- [ ] Lane 10. <Scenario.> Save `<slug>.png`. Pass when <predicate>.\n",
        "",
      ),
      "expected 1 to 10",
    ],
    [
      "reordered live lanes",
      replaceOnce(
        replaceOnce(
          replaceOnce(skeleton, "Lane 9.", "Lane TMP."),
          "Lane 10.",
          "Lane 9.",
        ),
        "Lane TMP.",
        "Lane 10.",
      ),
      "lanes are [1,2,3,4,5,6,7,8,10,9]",
    ],
    [
      "a lane with no screenshot",
      replaceOnce(
        skeleton,
        "Lane 4. <Scenario.> Save `<slug>.png`. Pass when <predicate>.",
        "Lane 4. <Scenario.> Pass when <predicate>.",
      ),
      "lane 4 names no screenshot",
    ],
    [
      "a lane with no pass predicate",
      replaceOnce(
        skeleton,
        "Lane 7. <Scenario.> Save `<slug>.png`. Pass when <predicate>.",
        "Lane 7. <Scenario.> Save `<slug>.png`.",
      ),
      "lane 7 has no pass predicate",
    ],
    [
      "a live box that is not a lane",
      replaceOnce(
        skeleton,
        "Lane 2. <Scenario.> Save `<slug>.png`. Pass when <predicate>.",
        "Extra. Save `<slug>.png`. Pass when <predicate>.",
      ),
      "live box is not a lane",
    ],
    [
      "a hard-coded Cursor Grok string",
      replaceOnce(
        skeleton,
        CONTRACT.laneSentence,
        "Ten lanes on `grok-4.6-fast-xhigh` at the PR head",
      ),
      `Verify, live lacks "${CONTRACT.laneSentence}"`,
    ],
    [
      "incomplete perf evidence",
      replaceOnce(skeleton, "- [ ] Rule. <Head against trunk, with the number that fails.>\n", ""),
      "perf boxes are",
    ],
    [
      "swapped perf leads",
      replaceOnce(
        replaceOnce(
          replaceOnce(skeleton, "Baseline.", "TMP."),
          "Probe.",
          "Baseline.",
        ),
        "TMP.",
        "Probe.",
      ),
      "expected [Metric., Probe., Baseline., Rule.]",
    ],
    [
      "a None review gate that keeps boxes",
      replaceOnce(
        skeleton,
        "**Review gate.** The operator reviews before merge.",
        "**Review gate.** None. PR1 is not review-gated.",
      ),
      "Review gate says None but has boxes",
    ],
    [
      "a gated review missing video",
      replaceOnce(
        skeleton,
        `**Review gate.** The operator reviews before merge.

- [ ] Copy lane <n> screenshots into \`<media path>/<pr-id>-review-<slug>.png\`.
- [ ] Record a 30 to 60 second video of the change on a live lane. Save it as \`<media path>/<pr-id>-review.mp4\`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.`,
        `**Review gate.** The operator reviews before merge.

- [ ] Copy lane <n> screenshots into \`<media path>/<pr-id>-review-<slug>.png\`.
- [ ] Record a 30 to 60 second clip of the change on a live lane. Save it as \`<media path>/<pr-id>-review.mp4\`.
- [ ] Post the screenshots in chat. Stop at merge-ready. Wait for the operator's click.`,
      ),
      'Review gate lacks "video"',
    ],
    [
      "a non-appendix tail heading",
      replaceOnce(
        skeleton,
        "## Appendix A. Prototype evidence",
        "## Extra notes\n\n## Appendix A. Prototype evidence",
      ),
      'after Close the program is not an appendix',
    ],
    [
      "a missing prototype appendix",
      replaceOnce(
        skeleton,
        "## Appendix A. Prototype evidence",
        "## Appendix A. Other evidence",
      ),
      'no "## Appendix ... Prototype evidence" section',
    ],
    [
      "a long dash",
      replaceOnce(skeleton, "One box is one unit of work", "One box is one unit of work\u2014"),
      "long dash",
    ],
    [
      "a curly quote",
      replaceOnce(skeleton, "One box is one unit of work", "One box is one unit of work\u2019"),
      "curly quote",
    ],
    [
      "a mid-sentence colon",
      replaceOnce(skeleton, "The body is a how-to.", "The body is a how-to: now."),
      "mid-sentence colon",
    ],
    [
      "a verify block without the rule",
      replaceOnce(
        skeleton,
        "**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.",
        "**Verify, unit.** Skip the rule.",
      ),
      "Verify, unit. does not open with the rule",
    ],
  ])("rejects %s", (_name, mutated, expected) => {
    expect(problemsOf(mutated as string).join("\n")).toContain(expected as string);
  });

  it("CLI exits 0 on the extracted skeleton", async () => {
    const file = await writePlan(skeleton);
    const result = runNode([file]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("1 PR sections, 0 problems");
    expect(result.stderr).toBe("");
  });

  it("CLI exits 1 and prints the problem", async () => {
    const file = await writePlan(replaceOnce(skeleton, "- [ ] Baseline.", "- [ ] Base."));
    const result = runNode([file]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("perf boxes are");
    expect(result.stdout).toContain("1 PR sections,");
  });

  it("CLI exits 2 when the plan path is missing", () => {
    const result = runNode([]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Usage: node check-plan.mjs <plan.md>");
  });

  it("CLI exits 2 when the plan file cannot be read", () => {
    const result = runNode([join(tmpdir(), "check-plan-missing.md")]);
    expect(result.status).toBe(2);
    expect(result.stderr.length).toBeGreaterThan(0);
    expect(result.stderr).not.toContain("Usage: node check-plan.mjs <plan.md>");
  });
});
