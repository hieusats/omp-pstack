import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CACHE_PREFIX = "omp-pstack___pstack___";

const compareSemver = (a: string[], b: string[]): number => {
  for (let i = 0; i < 3; i++) {
    const diff = Number(a[i]) - Number(b[i]);
    if (diff !== 0) return diff;
  }
  return 0;
};

const newestSemver = (values: string[]): string | null => {
  const parts = values
    .map((value) => value.split("."))
    .filter((parts) => parts.length === 3 && parts.every((part) => /^\d+$/.test(part)));
  if (parts.length === 0) return null;
  parts.sort(compareSemver);
  return parts[parts.length - 1].join(".");
};

export function servedVersion(listJson: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(listJson);
  } catch {
    return null;
  }
  const marketplace =
    typeof parsed === "object" && parsed !== null
      ? (parsed as { marketplace?: unknown }).marketplace
      : undefined;
  if (!Array.isArray(marketplace)) return null;
  const versions = marketplace
    .filter(
      (entry): entry is { entries?: Array<{ version?: unknown }> } =>
        typeof entry === "object" &&
        entry !== null &&
        (entry as { id?: unknown }).id === "pstack@omp-pstack",
    )
    .flatMap((entry) => (Array.isArray(entry.entries) ? entry.entries : []))
    .map((entry) => (typeof entry.version === "string" ? entry.version : ""));
  return newestSemver(versions);
}

export function newestCacheVersion(dirs: string[]): string | null {
  return newestSemver(
    dirs
      .filter((dir) => dir.startsWith(CACHE_PREFIX))
      .map((dir) => dir.slice(CACHE_PREFIX.length)),
  );
}

export function compareVersions(
  repo: string,
  listed: string | null,
  cache: string | null,
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (listed !== repo) {
    reasons.push(`omp plugin list serves ${listed ?? "nothing"}, expected ${repo}`);
  }
  if (cache !== repo) {
    reasons.push(`newest marketplace cache dir is ${cache ?? "none"}, expected ${repo}`);
  }
  return { ok: reasons.length === 0, reasons };
}

if (import.meta.main) {
  const manifest = JSON.parse(
    readFileSync(
      join(import.meta.dir, "..", "plugins", "pstack", ".omp-plugin", "plugin.json"),
      "utf8",
    ),
  ) as { version: string };
  const repo = manifest.version;
  const listed = servedVersion(
    Bun.spawnSync(["omp", "plugin", "list", "--json"]).stdout.toString(),
  );
  const cacheRoot = join(
    process.env.HOME ?? "",
    ".omp",
    "plugins",
    "cache",
    "plugins",
  );
  const cache = existsSync(cacheRoot)
    ? newestCacheVersion(readdirSync(cacheRoot))
    : null;
  const verdict = compareVersions(repo, listed, cache);
  console.log(`pstack repo ${repo} | served ${listed ?? "none"} | cache ${cache ?? "none"}`);
  if (!verdict.ok) {
    for (const reason of verdict.reasons) console.error(reason);
    console.error(
      "repair: reinstall from the intended source (omp plugin install --force hieusats/omp-pstack) and rerun",
    );
    process.exit(1);
  }
  console.log("installed version verified");
}
