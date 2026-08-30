import { describe, expect, it } from "bun:test";
import {
  activeInstall,
  compareVersions,
  newestCacheVersion,
  servedVersion,
} from "./verify-installed-version.ts";

const pstackList = (versions: string[]) =>
  JSON.stringify({
    marketplace: [
      {
        id: "ponytail@ponytail",
        scope: "user",
        entries: [{ version: "4.9.0", installPath: "/x/ponytail___ponytail___4.9.0" }],
      },
      {
        id: "pstack@omp-pstack",
        scope: "user",
        entries: versions.map((version) => ({
          version,
          installPath: `/x/omp-pstack___pstack___${version}`,
        })),
      },
    ],
  });

describe("installed-version verify", () => {
  it("reads the served pstack version from omp plugin list --json", () => {
    expect(servedVersion(pstackList(["2.1.2"]))).toBe("2.1.2");
    expect(servedVersion(pstackList(["2.1.0", "2.1.2"]))).toBe("2.1.2");
    expect(servedVersion(pstackList(["1.2.0"]))).toBe("1.2.0");
    expect(servedVersion(JSON.stringify({ marketplace: [] }))).toBe(null);
    expect(servedVersion("not json")).toBe(null);
  });

  it("resolves the active install source for cache and linked installs", () => {
    expect(activeInstall(pstackList(["2.1.2"]))).toEqual({
      version: "2.1.2",
      installPath: "/x/omp-pstack___pstack___2.1.2",
      linked: false,
    });
    const linked = JSON.stringify({
      marketplace: [
        {
          id: "pstack@omp-pstack",
          scope: "user",
          entries: [
            { version: "2.1.1", installPath: "/home/u/.omp/plugins/cache/plugins/omp-pstack___pstack___2.1.1" },
            { version: "2.1.2", installPath: "/home/u/dev/pstack-omp-five-findings" },
          ],
        },
      ],
    });
    expect(activeInstall(linked)).toEqual({
      version: "2.1.2",
      installPath: "/home/u/dev/pstack-omp-five-findings",
      linked: true,
    });
    expect(activeInstall(JSON.stringify({ marketplace: [] }))).toBe(null);
    expect(activeInstall("not json")).toBe(null);
  });

  it("picks the numerically newest marketplace cache directory", () => {
    expect(
      newestCacheVersion([
        "omp-pstack___pstack___2.1.0",
        "omp-pstack___pstack___2.1.2",
        "omp-pstack___pstack___2.1.10",
      ]),
    ).toBe("2.1.10");
    expect(newestCacheVersion([])).toBe(null);
    expect(newestCacheVersion(["ponytail___ponytail___4.9.0"])).toBe(null);
  });

  it("passes only when listed and cached versions match the repo", () => {
    expect(compareVersions("2.1.2", "2.1.2", "2.1.2").ok).toBe(true);
    expect(compareVersions("2.1.2", "2.1.2", "2.1.2").reasons).toEqual([]);

    const downgrade = compareVersions("2.1.2", "2.1.1", "2.1.2");
    expect(downgrade.ok).toBe(false);
    expect(downgrade.reasons).toEqual([
      "omp plugin list serves 2.1.1, expected 2.1.2",
    ]);

    const stale = compareVersions("2.1.2", "2.1.2", "2.1.0");
    expect(stale.ok).toBe(false);
    expect(stale.reasons).toEqual([
      "newest marketplace cache dir is 2.1.0, expected 2.1.2",
    ]);

    const absent = compareVersions("2.1.2", null, null);
    expect(absent.ok).toBe(false);
    expect(absent.reasons).toEqual([
      "omp plugin list serves nothing, expected 2.1.2",
      "newest marketplace cache dir is none, expected 2.1.2",
    ]);
  });
});
