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

const semverParts = (value: string): string[] | null => {
  const parts = value.split(".");
  return parts.length === 3 && parts.every((part) => /^\d+$/.test(part))
    ? parts
    : null;
};

const newestSemver = (values: string[]): string | null => {
  const parts = values
    .map(semverParts)
    .filter((parts): parts is string[] => parts !== null);
  if (parts.length === 0) return null;
  parts.sort(compareSemver);
  return parts[parts.length - 1].join(".");
};

type InstallEntry = { version: string; installPath: string };

const pstackEntries = (listJson: string): InstallEntry[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(listJson);
  } catch {
    return [];
  }
  const marketplace =
    typeof parsed === "object" && parsed !== null
      ? (parsed as { marketplace?: unknown }).marketplace
      : undefined;
  if (!Array.isArray(marketplace)) return [];
  return marketplace
    .filter(
      (entry): entry is { entries?: Array<{ version?: unknown; installPath?: unknown }> } =>
        typeof entry === "object" &&
        entry !== null &&
        (entry as { id?: unknown }).id === "pstack@omp-pstack",
    )
    .flatMap((entry) => (Array.isArray(entry.entries) ? entry.entries : []))
    .filter(
      (entry): entry is InstallEntry =>
        typeof entry.version === "string" &&
        typeof entry.installPath === "string",
    );
};
export function servedVersion(listJson: string): string | null {
  return newestSemver(pstackEntries(listJson).map((entry) => entry.version));
}

const byVersionDesc = (a: InstallEntry, b: InstallEntry): number =>
  compareSemver(b.version.split("."), a.version.split("."));


export function activeInstall(
  listJson: string,
): (InstallEntry & { linked: boolean }) | null {
  const entries = pstackEntries(listJson)
    .filter((entry) => semverParts(entry.version) !== null)
    .sort(byVersionDesc);
  const active = entries[0];
  if (active === undefined) return null;
  const base = active.installPath.split("/").pop() ?? "";
  return { ...active, linked: !base.startsWith(CACHE_PREFIX) };
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
  const install = activeInstall(
    Bun.spawnSync(["omp", "plugin", "list", "--json"]).stdout.toString(),
  );
  const listed = install?.version ?? null;
  const cacheRoot = join(
    process.env.HOME ?? "",
    ".omp",
    "plugins",
    "cache",
    "plugins",
  );
  let source: string | null = null;
  if (install?.linked === true) {
    source = (
      JSON.parse(
        readFileSync(
          join(install.installPath, "plugins", "pstack", ".omp-plugin", "plugin.json"),
          "utf8",
        ),
      ) as { version: string }
    ).version;
  } else if (existsSync(cacheRoot)) {
    source = newestCacheVersion(readdirSync(cacheRoot));
  }
  const verdict = compareVersions(repo, listed, source);
  console.log(
    `pstack repo ${repo} | served ${listed ?? "none"} | ${install?.linked === true ? "linked" : "cache"} ${source ?? "none"}`,
  );
  if (!verdict.ok) {
    for (const reason of verdict.reasons) console.error(reason);
    console.error(
      "repair: reinstall from the intended source (omp plugin install --force hieusats/omp-pstack) and rerun",
    );
    process.exit(1);
  }
  console.log("installed version verified");
}
