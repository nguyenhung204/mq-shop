---
name: conventional-commits
description: >-
  Draft and validate git commit messages using Conventional Commits 1.0.0.
  Use when creating commits, suggesting commit messages, or when the
  conventional-commits project rule applies.
---

# Conventional Commits

Follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).

## Format

```
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

## Types (only these)

| Type | When |
| --- | --- |
| `feat` | New user-facing capability |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting / whitespace; no logic change |
| `refactor` | Code change that is neither fix nor feat |
| `perf` | Performance improvement |
| `test` | Add or fix tests |
| `build` | Build system or dependencies |
| `ci` | CI config / scripts |
| `chore` | Maintenance that does not fit above |
| `revert` | Revert a previous commit |

Do not invent custom types (`wip`, `update`, `changes`, etc.).

## Description

- Lowercase imperative verb: `add`, `fix`, `hide`, `wire`, `extract`
- No trailing period
- No emojis
- Concise; focus on why / intent when helpful

## Scope (optional)

Short noun for the area touched, e.g. `auth`, `admin`, `header`, `api`.

Examples:

- `feat(admin): add shop detail page`
- `fix(header): hide mobile nav toggle on desktop`
- `chore: install conventional commits cursor rule`

## Breaking changes

Mark breaking changes with `!` after type or scope, and/or a footer:

```
feat(api)!: require auth on product list

BREAKING CHANGE: unauthenticated GET /products now returns 401
```

## Body and footers

- Body: explain motivation when the description is not enough
- Footers: `BREAKING CHANGE:`, `Refs:`, `Closes:`, etc.

## Commit hygiene

- One logical change per commit
- Do not mix unrelated refactors with feature work
- Pass the message via HEREDOC:

```bash
git commit -m "$(cat <<'EOF'
fix(header): hide mobile nav toggle on desktop

EOF
)"
```

## Quick checklist

Before committing: valid type, lowercase description, no period, no emoji, single concern, HEREDOC used.
