# Secret leak prevention

The `Secret leak prevention` workflow scans only commits introduced by a pull
request or protected-branch push. It uses a checksum-pinned Gitleaks release,
does not retain checkout credentials, and does not upload scanner reports.

The wrapper keeps scanner output in process memory and emits only credential
category, repository path, commit SHA, and a rotation recommendation. Secret
values and raw scanner diagnostics are never printed or written to an artifact.
It scans the complete final blob for every added, modified, or type-changed file
in each introduced commit. A repository-controlled Gitleaks configuration,
ignore file, or inline suppression cannot replace the trusted default rules.

## Safe examples and exceptions

- Use obvious non-credential placeholders and reserved domains in examples.
- Load real credentials at runtime from the approved secret store.
- Do not add repository-wide path or pattern allowlists for fixtures.
- Inline scanner suppression comments are ignored by the prevention check.
- If a safe example is rejected, rewrite its shape so it cannot be mistaken for
  a usable credential; do not suppress the finding.

An unexpected finding must be treated as unresolved. Remove it from the branch,
identify the owning system without validating the value, and request approval
before any rotation or broader history remediation.

## Required GitHub enforcement

This repository workflow and its wrapper are still code in the pull request and
cannot make themselves tamper-proof. The workflow must not be described as a
bypass-resistant required gate until the repository ruleset requires both:

- the `Scan introduced commit range` status check; and
- code-owner approval for changes covered by `.github/CODEOWNERS`.

Configuration of that GitHub ruleset is an approval-required operations gate.
Until evidence of the active ruleset is captured, a pull request that changes
the workflow, wrapper, tests, or CODEOWNERS file blocks readiness even if its
other checks are green.
