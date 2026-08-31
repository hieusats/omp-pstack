// Pstack status line: exactly one line, `pstack: poteto-mode`, drawn only in
// sessions where poteto-mode has been activated. Event-driven only — no
// timers, no polling, no imports — and a failed draw never takes the session
// down.

/** Key omp draws the line under. */
export const STATUS_KEY = "pstack";

/** The one line, drawn only after activation. */
export const STATUS_TEXT = "pstack: poteto-mode";

/** Skill URI omp serves a bundled skill read through. */
export const SKILL_URI = "skill://poteto-mode";

/** Suffix of a filesystem path that resolves to poteto-mode's SKILL.md. */
export const SKILL_PATH = "skills/poteto-mode/SKILL.md";

/** A dispatched skill arrives as a user turn containing this marker. */
export const DISPATCH_MARKER = 'User invoked the "poteto-mode" skill';

/**
 * True when user-turn text carries the skill-dispatch marker. Prose that
 * merely mentions poteto-mode never matches — the marker includes the
 * quoted-skill phrase.
 * @param {unknown} text
 * @returns {boolean}
 */
export function isActivationText(text) {
  return typeof text === "string" && text.includes(DISPATCH_MARKER);
}

/**
 * True when tool-call arguments read the poteto-mode skill: the skill URI, or
 * a filesystem path ending in the SKILL.md suffix. omp hands events a JSON
 * string but persists the journal entry with the arguments already parsed.
 * @param {unknown} args
 * @returns {boolean}
 */
function argsActivate(args) {
  const text =
    typeof args === "string"
      ? args
      : args !== null && typeof args === "object"
        ? JSON.stringify(args)
        : "";
  return text.includes(SKILL_URI) || text.includes(SKILL_PATH);
}

/**
 * Flatten a user message's content — a plain string or an array of blocks
 * like `{ type: "text", text }` — into text.
 * @param {unknown} content
 * @returns {string}
 */
function messageText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) =>
        block !== null && typeof block === "object" && block.type === "text"
          ? /** @type {{ text: unknown }} */ (block).text
          : "",
      )
      .join("");
  }
  return "";
}

/**
 * True when one session-journal entry carries an activation signal: a
 * `tool_execution_start` reading the poteto-mode skill, or a user message
 * dispatching it.
 * @param {unknown} entry
 * @returns {boolean}
 */
export function entryActivates(entry) {
  if (entry === null || typeof entry !== "object") return false;
  if (entry.type === "custom" && entry.customType === "tool_execution_start") {
    return (
      entry.data !== null &&
      typeof entry.data === "object" &&
      argsActivate(entry.data.args)
    );
  }
  if (entry.type === "message") {
    return (
      entry.message !== null &&
      typeof entry.message === "object" &&
      entry.message.role === "user" &&
      isActivationText(messageText(entry.message.content))
    );
  }
  return false;
}

/**
 * True when any journal entry in the slice carries an activation signal.
 * @param {unknown} entries
 * @returns {boolean}
 */
export function scanEntries(entries) {
  return Array.isArray(entries) && entries.some(entryActivates);
}

/**
 * omp extension entry: wires session_start, before_agent_start,
 * tool_execution_start, and turn_end around one monotonic latch. Activation
 * has no off switch, and every later event re-asserts the line so a status
 * surface that arrives late still picks it up. turn_end rescans the journal
 * because the tool event alone does not reliably reach extensions with a
 * draw-capable ctx mid-turn.
 * @param {{ on: (event: string, handler: (...args: any[]) => unknown) => void }} pi
 */
export default function pstackStatusLine(pi) {
  /** @type {boolean} */
  let active = false;

  const draw = (ctx) => {
    ctx?.ui?.setStatus?.(STATUS_KEY, STATUS_TEXT);
  };

  pi.on("session_start", (_event, ctx) => {
    try {
      const entries = ctx?.sessionManager?.getBranch?.()?.getEntries?.();
      if (scanEntries(entries)) active = true;
      if (active) draw(ctx);
    } catch {
      // omp drops a status line silently; it must never end a session.
    }
  });

  pi.on("before_agent_start", (event, ctx) => {
    try {
      const payload = /** @type {{ data?: unknown }} */ (event)?.data ?? event;
      if (isActivationText(/** @type {{ prompt?: unknown }} */ (payload)?.prompt)) active = true;
      if (active) draw(ctx);
    } catch {}
  });

  pi.on("tool_execution_start", (event, ctx) => {
    try {
      const payload = /** @type {{ data?: unknown }} */ (event)?.data ?? event;
      if (argsActivate(/** @type {{ args?: unknown }} */ (payload)?.args)) active = true;
      if (active) draw(ctx);
    } catch {}
  });

  pi.on("turn_end", (_event, ctx) => {
    try {
      if (!active) {
        const entries = ctx?.sessionManager?.getBranch?.()?.getEntries?.();
        if (scanEntries(entries)) active = true;
      }
      if (active) draw(ctx);
    } catch {}
  });
}
