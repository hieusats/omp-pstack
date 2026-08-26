#!/usr/bin/env bash
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
fail=0

note() { printf '%s\n' "$*"; }

legacy_command_dir="$repo/plugins/pstack/commands"
if [ -e "$legacy_command_dir" ]; then
  note "FAIL: legacy command layer still exists: $legacy_command_dir"
  find "$legacy_command_dir" -mindepth 1 -print 2>/dev/null || true
  fail=1
else
  note "ok: native skills are the only user-facing workflow surface"
fi

bad_principle=""
for skill in "$repo"/plugins/pstack/skills/principle-*/SKILL.md; do
  if [ ! -f "$skill" ]; then
    bad_principle="no principle-* leaves found"$'\n'
    break
  fi
  front="$(sed -n '2,/^---$/p' "$skill")"
  printf '%s\n' "$front" | grep -q '^user-invocable: false$' || bad_principle="$bad_principle$skill (missing user-invocable: false)"$'\n'
  printf '%s\n' "$front" | grep -q '^disable-model-invocation: true$' && bad_principle="$bad_principle$skill (still carries disable-model-invocation)"$'\n'
done
if [ -n "$bad_principle" ]; then
  note "FAIL: principle-* leaves must be user-invocable: false and model-readable:"
  note "$bad_principle"
  fail=1
else
  note "ok: all principle-* leaves request user-hidden and remain model-readable"
fi

verof() { { grep -m1 '"version"' "$1" || true; } | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/'; }
vc="$(verof "$repo/plugins/pstack/.claude-plugin/plugin.json")"
vx="$(verof "$repo/plugins/pstack/.codex-plugin/plugin.json")"
vm="$(verof "$repo/.claude-plugin/marketplace.json")"
vu="$(sed -n 's/| open-pstack version | `\([^`]*\)` |/\1/p' "$repo/UPSTREAM.md")"
if [ -n "$vc" ] && [ "$vc" = "$vx" ] && [ "$vc" = "$vm" ] && [ "$vc" = "$vu" ]; then
  note "ok: open-pstack version matches across UPSTREAM.md and the 3 manifests ($vc)"
else
  note "FAIL: open-pstack version differs: upstream=$vu claude-plugin=$vc codex-plugin=$vx marketplace=$vm"
  fail=1
fi

# Static invariant (CHANGES maintenance note): provider-dispatch owns the default
# provider/model quad and the four panel skills plus setup-pstack copy it verbatim.
setup="$repo/plugins/pstack/skills/setup-pstack/SKILL.md"
dispatch="$repo/plugins/pstack/skills/poteto-mode/references/provider-dispatch.md"
quad_of() { { grep -oE '(claude|codex|grok):[a-z0-9.-]+@(low|medium|high|xhigh|max)' || true; } | tr '\n' ' ' | sed 's/ $//'; }
canon_quad="$(awk '
  $0 == "## Model matrix" { in_matrix = 1; next }
  in_matrix && /^## / { exit }
  in_matrix && /^\|/ {
    line = $0
    sub(/^\|/, "", line)
    sub(/\|$/, "", line)
    n = split(line, cells, "|")
    for (i = 1; i <= n; i++) {
      gsub(/^ +| +$/, "", cells[i])
      gsub(/`/, "", cells[i])
    }
    family = cells[1]
    if (family == "Family" || family ~ /^:?-+:?$/) next
    provider = cells[3]
    model = cells[4]
    effort = cells[5]
    if (out != "") out = out " "
    out = out provider ":" model "@" effort
  }
  END { print out }
' "$dispatch")"
quad_bad=""
[ -n "$canon_quad" ] || quad_bad="could not read the canonical quad from $dispatch"$'\n'
# Anchor on the quad's last slug rather than a hard-coded one, so a model swap in
# setup-pstack cannot leave this check hunting for a slug nobody ships any more.
anchor="${canon_quad##* }"
# arena, architect, and how each state the quad on one line; interrogate lists it
# as one slug per row of its Reviewer A/B/C/D table (upstream #167).
for name in arena architect how; do
  skill="$repo/plugins/pstack/skills/$name/SKILL.md"
  n="$(grep -Fc "$anchor" "$skill" || true)"
  if [ "$n" != "1" ]; then
    quad_bad="$quad_bad$skill: expected exactly 1 default-quad line, found $n"$'\n'
    continue
  fi
  got="$(grep -F "$anchor" "$skill" | quad_of)"
  [ "$got" = "$canon_quad" ] || quad_bad="$quad_bad$skill: [$got] != [$canon_quad]"$'\n'
done
interrogate="$repo/plugins/pstack/skills/interrogate/SKILL.md"
got="$(grep -E '^\| Reviewer [A-Z] \|' "$interrogate" | quad_of)"
[ "$got" = "$canon_quad" ] || quad_bad="$quad_bad$interrogate reviewer table: [$got] != [$canon_quad]"$'\n'
while IFS= read -r line; do
  got="$(printf '%s\n' "$line" | quad_of)"
  [ "$got" = "$canon_quad" ] || quad_bad="$quad_bad$setup role row: [$got] != [$canon_quad]"$'\n'
done < <(grep -E '^(arena runners|arena cross-judge pool|architect runners|interrogate reviewers|how critics):' "$setup")
if [ -n "$quad_bad" ]; then
  note "FAIL: the default model quad is not identical across provider dispatch, the panel skills, and setup-pstack:"
  note "$quad_bad"
  fail=1
else
  note "ok: default model quad identical across provider dispatch + 4 panel skills + setup-pstack ($canon_quad)"
fi

# Dual Babysit entry points share one bugbot-triage.md. A second copy or a
# dropped relative path lets standalone /babysit apply a weaker policy.
bugbot_skill_rel="../poteto-mode/references/bugbot-triage.md"
bugbot_playbook_rel="../references/bugbot-triage.md"

check_bugbot_triage_binding() {
  local plugin="$1"
  local bad=""
  local canon="$plugin/skills/poteto-mode/references/bugbot-triage.md"
  local skill="$plugin/skills/babysit/SKILL.md"
  local playbook="$plugin/skills/poteto-mode/playbooks/babysit.md"
  local copies n canon_abs resolved_dir resolved_abs

  if [ ! -f "$canon" ]; then
    bad="${bad}canonical rubric missing: $canon"$'\n'
  fi
  if [ ! -f "$skill" ]; then
    bad="${bad}standalone babysit skill missing: $skill"$'\n'
  elif ! grep -Fq "$bugbot_skill_rel" "$skill"; then
    bad="${bad}standalone babysit skill lost bugbot-triage binding ($bugbot_skill_rel)"$'\n'
  fi
  if [ ! -f "$playbook" ]; then
    bad="${bad}poteto-mode babysit playbook missing: $playbook"$'\n'
  elif ! grep -Fq "$bugbot_playbook_rel" "$playbook"; then
    bad="${bad}poteto-mode babysit playbook lost bugbot-triage binding ($bugbot_playbook_rel)"$'\n'
  fi
  if [ ! -f "$plugin/skills/babysit/$bugbot_skill_rel" ]; then
    bad="${bad}standalone relative link does not resolve: $bugbot_skill_rel"$'\n'
  elif [ -f "$canon" ]; then
    canon_abs="$(cd "$(dirname "$canon")" && pwd)/$(basename "$canon")"
    resolved_dir="$(cd "$plugin/skills/babysit/$(dirname "$bugbot_skill_rel")" && pwd)"
    resolved_abs="$resolved_dir/$(basename "$bugbot_skill_rel")"
    if [ "$canon_abs" != "$resolved_abs" ]; then
      bad="${bad}standalone relative link resolves to $resolved_abs, not $canon_abs"$'\n'
    fi
  fi
  copies="$(find "$plugin" -name 'bugbot-triage.md' -print 2>/dev/null || true)"
  n="$(printf '%s\n' "$copies" | awk 'NF { c++ } END { print c+0 }')"
  if [ "$n" != "1" ]; then
    bad="${bad}expected exactly 1 bugbot-triage.md under plugin, found $n"$'\n'
    if [ -n "$copies" ]; then
      bad="${bad}$copies"$'\n'
    fi
  fi
  if [ -n "$bad" ]; then
    printf '%s' "$bad"
    return 1
  fi
  return 0
}

write_valid_bugbot_plugin() {
  local plugin="$1"
  mkdir -p "$plugin/skills/babysit" \
    "$plugin/skills/poteto-mode/playbooks" \
    "$plugin/skills/poteto-mode/references"
  printf '%s\n' "per [$bugbot_skill_rel]($bugbot_skill_rel)" > "$plugin/skills/babysit/SKILL.md"
  printf '%s\n' "per \`$bugbot_playbook_rel\`" > "$plugin/skills/poteto-mode/playbooks/babysit.md"
  printf '%s\n' "# rubric" > "$plugin/skills/poteto-mode/references/bugbot-triage.md"
}

expect_bugbot_ok() {
  local label="$1"
  local plugin="$2"
  local bad=""
  local rc=0
  bad="$(check_bugbot_triage_binding "$plugin")" || rc=$?
  if [ "$rc" -eq 0 ]; then
    note "ok: $label"
  else
    note "FAIL: $label"
    note "$bad"
    fail=1
  fi
}

expect_bugbot_fail() {
  local label="$1"
  local plugin="$2"
  local rc=0
  check_bugbot_triage_binding "$plugin" >/dev/null || rc=$?
  if [ "$rc" -eq 0 ]; then
    note "FAIL: $label: expected a binding error, check passed"
    fail=1
  else
    note "ok: $label"
  fi
}

expect_bugbot_ok "babysit Bugbot binding on the packaged plugin" "$repo/plugins/pstack"

bugbot_fx="$(mktemp -d)"
write_valid_bugbot_plugin "$bugbot_fx/ok"
expect_bugbot_ok "valid babysit Bugbot fixture" "$bugbot_fx/ok"

write_valid_bugbot_plugin "$bugbot_fx/missing-canon"
rm -f "$bugbot_fx/missing-canon/skills/poteto-mode/references/bugbot-triage.md"
expect_bugbot_fail "canonical rubric absent" "$bugbot_fx/missing-canon"

write_valid_bugbot_plugin "$bugbot_fx/skill-unbound"
printf '%s\n' "no rubric link" > "$bugbot_fx/skill-unbound/skills/babysit/SKILL.md"
expect_bugbot_fail "standalone babysit lost the Bugbot binding" "$bugbot_fx/skill-unbound"

write_valid_bugbot_plugin "$bugbot_fx/playbook-unbound"
printf '%s\n' "no rubric link" > "$bugbot_fx/playbook-unbound/skills/poteto-mode/playbooks/babysit.md"
expect_bugbot_fail "poteto-mode babysit playbook lost the Bugbot binding" "$bugbot_fx/playbook-unbound"

write_valid_bugbot_plugin "$bugbot_fx/broken-link"
rm -f "$bugbot_fx/broken-link/skills/poteto-mode/references/bugbot-triage.md"
mkdir -p "$bugbot_fx/broken-link/skills/poteto-mode/other"
printf '%s\n' "# rubric" > "$bugbot_fx/broken-link/skills/poteto-mode/other/bugbot-triage.md"
expect_bugbot_fail "standalone relative Bugbot link does not resolve" "$bugbot_fx/broken-link"

write_valid_bugbot_plugin "$bugbot_fx/extra-copy"
mkdir -p "$bugbot_fx/extra-copy/skills/babysit/references"
cp "$bugbot_fx/extra-copy/skills/poteto-mode/references/bugbot-triage.md" \
  "$bugbot_fx/extra-copy/skills/babysit/references/bugbot-triage.md"
expect_bugbot_fail "extra bugbot-triage.md copy under the plugin" "$bugbot_fx/extra-copy"

rm -rf "$bugbot_fx"

if [ "${PSTACK_STATIC_ONLY:-0}" = "1" ]; then
  exit "$fail"
fi

scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
mkdir -p "$scratch/.claude-plugin" "$scratch/skills/foo"
printf '%s\n' '{"name": "testplug", "version": "0.0.1", "description": "native skill repro"}' \
  > "$scratch/.claude-plugin/plugin.json"
cat > "$scratch/skills/foo/SKILL.md" <<'EOF'
---
name: foo
description: collision test skill
---

Say exactly: SKILL-RAN
Then stop. Do not invoke any skill or tool.
EOF

run() {
  claude -p --plugin-dir "$scratch" --model claude-fable-5 --effort max --max-turns 3 "$1" < /dev/null 2>&1
}

check() { # $1 label, $2 expected marker, $3 output
  if printf '%s' "$3" | grep -q "$2"; then
    note "ok: $1 -> $2"
  else
    note "FAIL: $1 expected $2, got: $3"
    fail=1
  fi
}

invoke='Call the Skill tool with skill "testplug:foo" exactly once and follow what it says.'

check "model-initiated Skill-tool invocation" "SKILL-RAN" "$(run "$invoke")"
check "user /testplug:foo invocation" "SKILL-RAN" "$(run '/testplug:foo')"

exit "$fail"
