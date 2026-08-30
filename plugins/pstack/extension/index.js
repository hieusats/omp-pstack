// Pstack status line: one line drawn on session_start from the lane sheet in
// task.agentModelOverrides (~/.omp/agent/config.yml). Event-driven only — no
// timers, no polling — and a failed draw never takes the session down.

import { readFile } from "node:fs/promises";

/** @typedef {"low" | "medium" | "high" | "xhigh" | "max"} Effort */

/** A `<provider>/<model>:<effort>` lane selector. */
/** @typedef {{ provider: string, model: string, effort: Effort }} Selector */

/** A setup escape hatch accepted verbatim in place of a selector. */
/** @typedef {{ alias: "inherit-parent" | "auto" }} Alias */

/** @typedef {Selector | Alias} LaneSlug */
/** @typedef {{ key: string, value: string }} LaneEntry */

/** `code` discriminates the union. */
/** @typedef {{
 *   code: "unknown-lane" | "missing-lane" | "bad-slug" | "unreadable-config",
 *   message: string,
 * }} Problem */

/** @typedef {{ lane: string, raw: string, slug: LaneSlug }} LaneRow */
/** @typedef {{ state: "unconfigured" }} UnconfiguredSheet */
/** @typedef {{ state: "configured", rows: LaneRow[] }} ConfiguredSheet */
/** @typedef {{ state: "inconsistent", problems: Problem[] }} InconsistentSheet */
/** @typedef {UnconfiguredSheet | ConfiguredSheet | InconsistentSheet} Sheet */

/** Canonical lane keys, in setup-pstack sheet order. */
export const LANES = Object.freeze([
  "pstack-scout",
  "pstack-librarian",
  "pstack-sonic",
  "pstack-designer",
  "pstack-reviewer",
  "pstack-security-reviewer",
  "pstack-task",
]);

export const STATUS_KEY = "pstack";

const SELECTOR = /^([\w-]+)\/([\w.-]+):(low|medium|high|xhigh|max)$/;
const TASK_KEY = /^task:\s*(?:#.*)?$/;
const OVERRIDES_KEY = /^agentModelOverrides:\s*(?:#.*)?$/;

/**
 * @param {string} raw
 * @returns {LaneSlug | null}
 */
export function parseSlug(raw) {
  if (raw === "inherit-parent" || raw === "auto") return { alias: raw };
  const match = SELECTOR.exec(String(raw));
  return match
    ? { provider: match[1], model: match[2], effort: /** @type {Effort} */ (match[3]) }
    : null;
}

/**
 * `$HOME` instead of `node:os` keeps this helper import-free, so builtin use
 * stays inside readSheet and the factory.
 * @param {string} [home]
 * @returns {string}
 */
export function configPath(home) {
  return `${home ?? process.env.HOME ?? ""}/.omp/agent/config.yml`;
}

/** Strip one pair of matching YAML quotes. */
function unquote(value) {
  if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.endsWith(value[0])) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Pull the `pstack-*` rows out of `task.agentModelOverrides` with a narrow
 * indentation-window scan — no YAML dependency, and rows anywhere else in the
 * file (other blocks, other keys) never leak in.
 * @param {string} yamlText
 * @returns {LaneEntry[]}
 */
export function extractLaneEntries(yamlText) {
  const lines = String(yamlText).split(/\r?\n/);
  const indentOf = (line) => line.length - line.trimStart().length;
  const isNoise = (line) => {
    const trimmed = line.trim();
    return trimmed === "" || trimmed.startsWith("#");
  };

  /** @type {Map<string, string>} */
  const entries = new Map();
  let windowIndent = 0;
  // task: -> agentModelOverrides: -> the sheet window between block siblings.
  let phase = "task";

  for (const line of lines) {
    if (isNoise(line)) continue;
    const indent = indentOf(line);
    if (phase === "window") {
      if (indent <= windowIndent) break; // window closed
      const row = /^\s+(pstack-[\w-]+):\s*(.*?)\s*$/.exec(line);
      if (row) entries.set(row[1], unquote(row[2]));
    } else if (phase === "task") {
      if (indent === 0 && TASK_KEY.test(line.trim())) phase = "overrides";
    } else if (indent === 0) {
      break; // task block ended without agentModelOverrides
    } else if (OVERRIDES_KEY.test(line.trim())) {
      phase = "window";
      windowIndent = indent;
    }
  }
  if (phase !== "window") return [];
  return [...entries].map(([key, value]) => ({ key, value }));
}

/**
 * Classify the extracted rows against the canonical lanes. Rows under a
 * non-lane `pstack-*` key, rows with an unparseable selector, and lanes with
 * no row at all are all inconsistent states, not configurations.
 * @param {LaneEntry[]} entries
 * @returns {Sheet}
 */
export function classifySheet(entries) {
  if (entries.length === 0) return { state: "unconfigured" };

  /** @type {Problem[]} */
  const problems = [];
  /** @type {Map<string, { raw: string, slug: LaneSlug }>} */
  const parsed = new Map();

  for (const { key, value } of entries) {
    if (!LANES.includes(key)) {
      problems.push({ code: "unknown-lane", message: `unknown lane: ${key}` });
      continue;
    }
    const slug = parseSlug(value);
    if (!slug) {
      problems.push({ code: "bad-slug", message: `invalid selector for ${key}: ${value}` });
      continue;
    }
    parsed.set(key, { raw: value, slug });
  }
  for (const lane of LANES) {
    if (!parsed.has(lane)) {
      problems.push({ code: "missing-lane", message: `missing lane: ${lane}` });
    }
  }

  if (problems.length > 0) return { state: "inconsistent", problems };
  return {
    state: "configured",
    rows: LANES.map((lane) => {
      const row = /** @type {{ raw: string, slug: LaneSlug }} */ (parsed.get(lane));
      return { lane, raw: row.raw, slug: row.slug };
    }),
  };
}

/**
 * Render the one-line status text. ASCII only — omp strips escapes and
 * truncates to the bar width, so the line stays plain and short.
 * @param {Sheet} sheet
 * @returns {string}
 */
export function renderStatus(sheet) {
  if (sheet.state === "unconfigured") {
    return "pstack: unconfigured - run /skill:setup-pstack";
  }
  if (sheet.state === "configured") {
    /** @type {string[]} */
    const distinct = [];
    for (const { raw } of sheet.rows) {
      if (!distinct.includes(raw)) distinct.push(raw);
    }
    let text = `pstack: configured - ${sheet.rows.length} lanes: ${distinct.slice(0, 3).join(", ")}`;
    if (distinct.length > 3) text += ` +${distinct.length - 3} more`;
    return text;
  }
  let text = `pstack: inconsistent - ${sheet.problems.slice(0, 2).map((problem) => problem.message).join(", ")}`;
  if (sheet.problems.length > 2) text += ` (+${sheet.problems.length - 2} more)`;
  return text;
}

/**
 * Read and classify the live sheet. A missing config is a fresh machine
 * (unconfigured — setup is the right next step); any other read failure is
 * inconsistent (a setup run would fail on the same file, so it must not be
 * nudged).
 * @param {string} [path] - override for tests; defaults to configPath()
 * @returns {Promise<Sheet>}
 */
export async function readSheet(path) {
  let yamlText;
  try {
    yamlText = await readFile(path ?? configPath(), "utf8");
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") {
      return { state: "unconfigured" };
    }
    const message = error instanceof Error ? error.message : String(error);
    return {
      state: "inconsistent",
      problems: [{ code: "unreadable-config", message: `config unreadable: ${message}` }],
    };
  }
  return classifySheet(extractLaneEntries(yamlText));
}

/**
 * omp extension entry: registers exactly one session_start draw.
 * @param {{ on: (event: string, handler: (...args: any[]) => Promise<void>) => void }} pi
 */
export default function pstackStatusLine(pi) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const sheet = await readSheet();
      ctx?.ui?.setStatus?.(STATUS_KEY, renderStatus(sheet));
    } catch {
      // omp drops a status line silently; it must never end a session.
    }
  });
}
