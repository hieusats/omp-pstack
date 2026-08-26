#!/usr/bin/env node
import fs from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const RULE =
  "Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.";
const LANE_SENTENCE =
  "Ten lanes on the configured `swarm workers` role at the PR head";
const BOX = /^\s*- \[[ x]\] (.*)$/;

/** @typedef {"none" | "any" | "lanes" | "ordered-leads" | "gate"} BoxShape */
/** @typedef {{ name: string, shape: BoxShape, opensWithRule?: boolean, leads?: readonly string[], words?: readonly string[] }} PrBlock */
/** @typedef {{ n: number, text: string, code: boolean }} Line */
/** @typedef {{ title: string, n: number, body: Line[] }} Section */
/** @typedef {{ name: string, n: number, rest: string, lines: Line[] }} Heading */
/** @typedef {{ problems: string[], report: string[], prCount: number, ok: boolean }} CheckResult */

const PR_BLOCKS = Object.freeze([
  Object.freeze({ name: "Depends on.", shape: "none" }),
  Object.freeze({ name: "Files.", shape: "any" }),
  Object.freeze({ name: "Build.", shape: "any" }),
  Object.freeze({ name: "You see.", shape: "any" }),
  Object.freeze({ name: "Verify, unit.", shape: "any", opensWithRule: true }),
  Object.freeze({ name: "Verify, live.", shape: "lanes", opensWithRule: true }),
  Object.freeze({
    name: "Verify, perf.",
    shape: "ordered-leads",
    opensWithRule: true,
    leads: Object.freeze(["Metric.", "Probe.", "Baseline.", "Rule."]),
  }),
  Object.freeze({
    name: "Review gate.",
    shape: "gate",
    words: Object.freeze(["screenshot", "video", "operator"]),
  }),
  Object.freeze({ name: "Merge.", shape: "any" }),
]);

export const CONTRACT = Object.freeze({
  rule: RULE,
  laneSentence: LANE_SENTENCE,
  laneCount: 10,
  prBlocks: PR_BLOCKS,
  programSections: Object.freeze([
    "Arm the program",
    "Spawn owners",
    "PR mechanics",
    "Verdict and merge",
    "Boot recipe",
  ]),
  programMarkers: Object.freeze([
    "standing orders",
    "the installed plugin",
    /30[- ]minute/,
    "status message",
  ]),
  howToReadMarkers: Object.freeze([
    "One box is one unit of work",
    "names the evidence",
    "Check a box only when its evidence exists",
    "playbooks/",
    RULE,
  ]),
  punctuation: Object.freeze([
    Object.freeze({ message: "long dash", pattern: /[\u2013\u2014]/ }),
    Object.freeze({
      message: "curly quote",
      pattern: /[\u2018\u2019\u201c\u201d]/,
    }),
    Object.freeze({ message: "mid-sentence colon", pattern: /: \S/ }),
  ]),
});

const SUB_BLOCKS = CONTRACT.prBlocks.map((block) => block.name);

function toLines(raw) {
  const split = raw.split(/\r?\n/);
  let start = 0;
  if (split[0] === "---") {
    const close = split.indexOf("---", 1);
    start = close === -1 ? 0 : close + 1;
  }
  const lines = [];
  let fence = false;
  for (let i = start; i < split.length; i++) {
    const text = split[i];
    const n = i + 1;
    if (/^```/.test(text)) fence = !fence;
    lines.push({ n, text, code: fence });
  }
  return lines;
}

function checkPunctuation(lines, fail) {
  for (const line of lines) {
    if (line.code) continue;
    const prose = line.text
      .replace(/`[^`]*`/g, "`")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\]\([^)]*\)/g, "]");
    for (const rule of CONTRACT.punctuation) {
      if (rule.pattern.test(prose)) fail(line.n, rule.message);
    }
  }
}

function toSections(lines) {
  const sections = [];
  for (const line of lines) {
    const title =
      !line.code && line.text.startsWith("## ")
        ? line.text.slice(3).trim()
        : null;
    if (title !== null) sections.push({ title, n: line.n, body: [] });
    else if (sections.length) sections.at(-1).body.push(line);
  }
  return sections;
}

function findSection(sections, title) {
  return sections.find((section) => section.title === title);
}

function bodyText(section) {
  return section.body.map((line) => line.text).join("\n");
}

function boxes(lines) {
  return lines
    .filter((line) => !line.code && BOX.test(line.text))
    .map((line) => ({ n: line.n, text: line.text.match(BOX)[1] }));
}

function checkPreamble(lines, sections, fail) {
  const h1 = lines.findIndex((line) => !line.code && line.text.startsWith("# "));
  if (h1 === -1) fail(1, "no H1 title");
  const howToRead = findSection(sections, "How to read this");
  if (!howToRead) fail(1, 'no "## How to read this" section');
  if (h1 !== -1 && howToRead) {
    const intro = lines
      .slice(h1 + 1)
      .filter((line) => line.n < howToRead.n && line.text.trim() !== "");
    if (intro.length >= 10) {
      fail(
        lines[h1].n,
        `intro is ${intro.length} lines, under ten required`,
      );
    }
    const text = bodyText(howToRead);
    for (const marker of CONTRACT.howToReadMarkers) {
      if (!text.includes(marker)) {
        fail(howToRead.n, `How to read this lacks "${marker}"`);
      }
    }
  }
}

function checkProgram(section, fail) {
  const h3s = section.body
    .filter((line) => !line.code && line.text.startsWith("### "))
    .map((line) => line.text.slice(4).trim());
  let cursor = 0;
  for (const name of CONTRACT.programSections) {
    const at = h3s.findIndex((title, i) => i >= cursor && title.startsWith(name));
    if (at === -1) fail(section.n, `Program checklist lacks "### ${name}" in order`);
    else cursor = at + 1;
  }
  const text = bodyText(section);
  for (const marker of CONTRACT.programMarkers) {
    const ok =
      marker instanceof RegExp ? marker.test(text) : text.includes(marker);
    if (!ok) fail(section.n, `Program checklist lacks "${marker}"`);
  }
}

function headingsOf(section) {
  const heads = [];
  for (const line of section.body) {
    if (line.code) continue;
    const match = line.text.match(/^\*\*([^*]+)\*\*(.*)$/);
    if (match && SUB_BLOCKS.includes(match[1])) {
      heads.push({
        name: match[1],
        n: line.n,
        rest: match[2].trim(),
        lines: [],
      });
    } else if (heads.length) {
      heads.at(-1).lines.push(line);
    }
  }
  return heads;
}

function checkLanes(prTitle, live, fail) {
  if (!live.rest.includes(CONTRACT.laneSentence)) {
    fail(
      live.n,
      `${prTitle}: Verify, live lacks "${CONTRACT.laneSentence}"`,
    );
  }
  const laneBoxes = boxes(live.lines);
  const expected = Array.from(
    { length: CONTRACT.laneCount },
    (_, i) => i + 1,
  ).join(",");
  const numbers = [];
  for (const lane of laneBoxes) {
    const match = lane.text.match(/^Lane (\d+)\. /);
    if (!match) fail(lane.n, `${prTitle}: live box is not a lane`);
    else {
      numbers.push(Number(match[1]));
      if (!/Save `[^`]+`/.test(lane.text)) {
        fail(lane.n, `${prTitle}: lane ${match[1]} names no screenshot`);
      } else if (!lane.text.includes("Pass when")) {
        fail(lane.n, `${prTitle}: lane ${match[1]} has no pass predicate`);
      }
    }
  }
  if (numbers.join(",") !== expected) {
    fail(
      live.n,
      `${prTitle}: lanes are [${numbers.join(",")}], expected 1 to ${CONTRACT.laneCount}`,
    );
  }
}

function checkOrderedLeads(prTitle, heading, spec, fail) {
  const items = boxes(heading.lines).map((box) => box.text.split(" ")[0]);
  const expected = spec.leads.join("|");
  if (items.join("|") !== expected) {
    fail(
      heading.n,
      `${prTitle}: perf boxes are [${items.join(", ")}], expected [${spec.leads.join(", ")}]`,
    );
  }
}

function checkGate(prTitle, gate, spec, fail) {
  const gateBoxes = boxes(gate.lines);
  if (gate.rest.startsWith("None.")) {
    if (gateBoxes.length) {
      fail(gate.n, `${prTitle}: Review gate says None but has boxes`);
    }
    return;
  }
  const text = gate.lines.map((line) => line.text).join("\n");
  if (gateBoxes.length === 0) {
    fail(gate.n, `${prTitle}: Review gate has no box`);
  }
  for (const word of spec.words) {
    if (!text.includes(word)) {
      fail(gate.n, `${prTitle}: Review gate lacks "${word}"`);
    }
  }
}

function checkBlock(prTitle, heading, spec, fail) {
  if (spec.opensWithRule && !heading.rest.startsWith(CONTRACT.rule)) {
    fail(heading.n, `${prTitle}: ${spec.name} does not open with the rule`);
  }
  switch (spec.shape) {
    case "none":
      if (heading.rest === "") {
        fail(heading.n, `${prTitle}: Depends on names nothing`);
      }
      break;
    case "any":
      if (boxes(heading.lines).length === 0) {
        fail(heading.n, `${prTitle}: ${spec.name} has no box`);
      }
      break;
    case "lanes":
      checkLanes(prTitle, heading, fail);
      break;
    case "ordered-leads":
      checkOrderedLeads(prTitle, heading, spec, fail);
      break;
    case "gate":
      checkGate(prTitle, heading, spec, fail);
      break;
  }
}

function reportLine(section, heads) {
  const counts = Object.fromEntries(
    heads.map((head) => [head.name, boxes(head.lines).length]),
  );
  const total = boxes(section.body).length;
  const cells = SUB_BLOCKS.filter((name) => name !== "Depends on.").map(
    (name) =>
      `${name.replace(/[ ,.]+/g, "-").replace(/-$/, "").toLowerCase()}=${counts[name] ?? 0}`,
  );
  return `${section.title}  boxes=${total}  ${cells.join(" ")}`;
}

function checkPrSection(section, fail) {
  const heads = headingsOf(section);
  const names = heads.map((head) => head.name);
  if (names.join("|") !== SUB_BLOCKS.join("|")) {
    fail(
      section.n,
      `${section.title}: sub-blocks are [${names.join(", ")}], expected [${SUB_BLOCKS.join(", ")}]`,
    );
  }
  const byName = Object.fromEntries(heads.map((head) => [head.name, head]));
  for (const spec of CONTRACT.prBlocks) {
    const heading = byName[spec.name];
    if (heading) checkBlock(section.title, heading, spec, fail);
  }
  return reportLine(section, heads);
}

function checkTail(sections, close, fail) {
  const closeIndex = sections.indexOf(close);
  if (closeIndex === -1) return;
  const tail = sections.slice(closeIndex + 1);
  for (const section of tail) {
    if (!section.title.startsWith("Appendix")) {
      fail(
        section.n,
        `"## ${section.title}" after Close the program is not an appendix`,
      );
    }
  }
  if (!tail.some((section) => section.title.includes("Prototype evidence"))) {
    fail(close.n, 'no "## Appendix ... Prototype evidence" section');
  }
}

/**
 * @param {string} raw
 * @param {string} [file]
 * @returns {CheckResult}
 */
export function checkPlan(raw, file = "plan.md") {
  const problems = [];
  const fail = (line, message) => problems.push(`${file}:${line}: ${message}`);
  const lines = toLines(raw);
  checkPunctuation(lines, fail);
  const sections = toSections(lines);
  checkPreamble(lines, sections, fail);

  const program = findSection(sections, "Program checklist");
  if (!program) fail(1, 'no "## Program checklist" section');
  else checkProgram(program, fail);

  const close = findSection(sections, "Close the program");
  if (!close) fail(1, 'no "## Close the program" section');

  const programIndex = sections.indexOf(program);
  const closeIndex = sections.indexOf(close);
  const prSections =
    programIndex === -1 || closeIndex === -1
      ? []
      : sections.slice(programIndex + 1, closeIndex);
  if (prSections.length === 0) {
    fail(1, "no PR sections between Program checklist and Close the program");
  }

  const report = [];
  for (const section of prSections) report.push(checkPrSection(section, fail));
  if (close) checkTail(sections, close, fail);

  return {
    problems,
    report,
    prCount: prSections.length,
    ok: problems.length === 0,
  };
}

/**
 * @param {string} playbookRaw
 * @returns {string}
 */
export function extractSkeleton(playbookRaw) {
  const lines = playbookRaw.split(/\r?\n/);
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("````markdown")) starts.push(i);
  }
  if (starts.length !== 1) {
    throw new Error(
      `expected exactly one fenced skeleton, found ${starts.length}`,
    );
  }
  const start = starts[0];
  let end = -1;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^````\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  if (end === -1) throw new Error("unclosed skeleton fence");
  return `${lines.slice(start + 1, end).join("\n")}\n`;
}

function isCliEntry() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return fileURLToPath(import.meta.url) === resolve(entry);
  } catch {
    return false;
  }
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node check-plan.mjs <plan.md>");
    process.exit(2);
  }
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
  const result = checkPlan(raw, file);
  for (const line of result.report) console.log(line);
  console.log(`${result.prCount} PR sections, ${result.problems.length} problems`);
  for (const problem of result.problems) console.error(problem);
  process.exit(result.problems.length ? 1 : 0);
}

if (isCliEntry()) main();
