---
description: Write why test design cannot start from these requirements
argument-hint: --r <requirements file>
---

# Requirements testing blocked

**Inputs**: $inputs.output

**Review**: $review.output

**Evidence**: $evidence.output

**Environment**: $preflight.output

**Gate**: $gate.output

---

## Your task

The run is blocked: the requirements review did not finish, or it found blocker findings that make test design impossible. Write `<outputDir>/requirements-testing-blocked.md` (`outputDir` from `$ARTIFACTS_DIR/inputs.json`) and copy it to `$ARTIFACTS_DIR/`. Empty output above or a missing artifact file means the step did not run — say so.

1. **Result: Blocked** — one line per reason from **Gate** `reasons`.
2. **Blocking findings** — every blocker finding of `$ARTIFACTS_DIR/requirements-review.md`: the quoted requirement text, why test design cannot continue, and the question or decision needed from the author.
3. **What the application shows** — when `$ARTIFACTS_DIR/evidence.md` exists: only the rows that help answer those blockers.
4. **Environment** — the **Environment** result and any Chrome, MCP or rate-limit problem, plus steps that did not run.
5. **Next steps** — what to answer or fix, then: `archon workflow run playwright-requirements-testing -- --r <file>`.

Do not write test cases. Leave `requirements-testing-result.md` and `test-cases.md` from an earlier run untouched, and say in the report that they are older than these requirements. Do not edit other project files.

## Output

The blocking reasons, one per line, and the report path.
