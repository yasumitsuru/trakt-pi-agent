# Trakt Pi Agent v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Execute only one subagent at a time.

**Goal:** Build the read-only Trakt Pi Agent MCP server defined by the approved design specification.

**Architecture:** A standard MCP stdio server uses TraktCLI and a minimal read-only Trakt API adapter, backed by a normalized local SQLite cache and incremental synchronization.

**Tech Stack:** TypeScript, Node.js, MCP SDK, SQLite

**Spec:** docs/superpowers/specs/2026-08-23-trakt-pi-agent-design.md

---

## Execution Policy

- One active subagent at a time.
- Same model as main agent for every subagent.
- Fresh isolated context for every implementation task.
- Subagent receives only its task brief and required files.
- No parallel implementation.
- Main agent verifies every diff.
- Main agent reruns relevant tests.
- Main agent owns commit and push.
- Every green microtask gets its own commit and push.
- Failed tasks are not committed.
- Subagent output must be concise.
- Detailed artifacts/logs should be written to files instead of pasted into main context.

---

## Planned File Map

```
trakt-pi-agent/
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── vitest.config.ts
├── .gitignore
├── LICENSE
├── README.md
├── docs/
│   └── superpowers/
│       ├── specs/
│       │   └── 2026-08-23-trakt-pi-agent-design.md
│       ├── plans/
│       │   └── 2026-08-23-trakt-pi-agent-v1-implementation.md
│       └── guides/
│           └── v1-setup-and-usage.md
├── src/
│   ├── index.ts
│   ├── config/
│   │   ├── paths.ts
│   │   └── config.ts
│   ├── trakt/
│   │   ├── cli.ts
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   └── types.ts
│   ├── sync/
│   │   ├── initial-sync.ts
│   │   ├── incremental-sync.ts
│   │   └── last-activities.ts
│   ├── cache/
│   │   ├── database.ts
│   │   ├── migrations.ts
│   │   └── repositories/
│   │       ├── media.ts
│   │       ├── history.ts
│   │       ├── progress.ts
│   │       ├── watchlist.ts
│   │       ├── sync-state.ts
│   │       └── search-cache.ts
│   ├── classification/
│   │   └── media-category.ts
│   └── mcp/
│       ├── server.ts
│       └── tools/
│           ├── trakt-history.ts
│           ├── trakt-progress.ts
│           ├── trakt-watchlist.ts
│           ├── trakt-calendar.ts
│           ├── trakt-search.ts
│           ├── trakt-sync.ts
│           ├── trakt-sync-status.ts
│           └── trakt-cache-stats.ts
└── tests/
    ├── unit/
    │   ├── media-category.test.ts
    │   ├── ttl.test.ts
    │   ├── cache-rules.test.ts
    │   ├── cross-platform-paths.test.ts
    │   ├── trakt-cli-parsing.test.ts
    │   └── mcp-filters.test.ts
    ├── integration/
    │   ├── sqlite.test.ts
    │   ├── migrations.test.ts
    │   ├── initial-sync.test.ts
    │   ├── incremental-sync.test.ts
    │   └── stale-cache.test.ts
    ├── contract/
    │   ├── tool-schemas.test.ts
    │   └── structured-responses.test.ts
    └── smoke/
        └── server-start.test.ts
```

---

## Task 1 — Node/TypeScript Project Foundation

**Spec coverage:** Section 2 (Tech Stack), Section 11 (Testing Plan), Section 12 (CI)

**Goal:** Initialize the project with TypeScript, test runner, lint, typecheck, build, and minimal structure. No MCP functionality yet.

**Files to create:**
- `package.json` (name: `trakt-pi-agent`, type: `module`, scripts: `test`, `test:live`, `lint`, `typecheck`, `build`, `clean`)
- `tsconfig.json` (ESM, strict, outDir `dist`, rootDir `src`)
- `.eslintrc.json` (TypeScript ESLint)
- `vitest.config.ts`
- `src/index.ts` (entry point stub)
- `src/config/paths.ts` (stub)
- `src/config/config.ts` (stub)
- `tests/unit/` directory structure
- `tests/integration/` directory structure
- `tests/contract/` directory structure
- `tests/smoke/` directory structure
- `.github/workflows/ci.yml` (scaffold with TODO for matrix)

**TDD steps:**
1. Write `tests/smoke/server-start.test.ts` that imports `src/index.ts` and verifies the module loads without error.
2. Run `npm test` — expect RED (no tests configured yet).
3. Configure vitest in `vitest.config.ts` and `package.json`.
4. Run `npm test` — expect GREEN.
5. Run `npm run typecheck` — expect GREEN.
6. Run `npm run build` — expect GREEN.
7. Main agent verifies diff.
8. Commit: `chore: initialize TypeScript project`
9. Push.

---

## Task 2 — Cross-Platform Configuration and Data Paths

**Spec coverage:** Section 5.1 (Data Directories), Section 7.1 (TTL), Section 13 (TraktCLI Dependency)

**Goal:** Implement cross-platform data path resolution and configuration with configurable TTL and optional TraktCLI path.

**Files to create/modify:**
- `src/config/paths.ts` — `getDataDirectory(): string` using `appData` (Windows), `XDG` (Linux), `appData` (macOS)
- `src/config/config.ts` — `Config` interface with `ttlSeconds`, `traktCliPath`, `cacheDbPath`, `configPath`
- `tests/unit/cross-platform-paths.test.ts`
- `tests/unit/ttl.test.ts`

**TDD steps:**
1. Write `tests/unit/cross-platform-paths.test.ts` with test cases for Windows (`%LOCALAPPDATA%`), Linux (`~/.local/share`), macOS (`~/Library/Application Support`).
2. Run tests — expect RED.
3. Implement `src/config/paths.ts` with `getDataDirectory()` using `os.homedir()` + platform detection.
4. Run tests — expect GREEN.
5. Write `tests/unit/ttl.test.ts` testing default TTL = 300 (5 min) and configurable TTL.
6. Run tests — expect RED.
7. Implement `src/config/config.ts` with `ttlSeconds: 300` default, user-configurable via `config.json`.
8. Run tests — expect GREEN.
9. Main agent verifies diff.
10. Commit: `feat: add cross-platform configuration`
11. Push.

---

## Task 3 — TraktCLI Discovery

**Spec coverage:** Section 13 (TraktCLI Dependency), Section 3.2 (TraktCLI Adapter)

**Goal:** Implement TraktCLI path discovery via PATH lookup and configured explicit path, with sanitized errors.

**Files to create:**
- `src/trakt/cli.ts` — `discoverTraktCli(): string | null` with PATH lookup (`trakt-cli` / `trakt-cli.exe`)
- `tests/unit/trakt-cli-parsing.test.ts`

**TDD steps:**
1. Write `tests/unit/trakt-cli-parsing.test.ts` testing PATH resolution with mocked `process.env.PATH`.
2. Run tests — expect RED.
3. Implement `discoverTraktCli()` in `src/trakt/cli.ts`.
4. Run tests — expect GREEN.
5. Main agent verifies diff.
6. Commit: `feat: add TraktCLI discovery`
7. Push.

---

## Task 4 — TraktCLI Command Adapter

**Spec coverage:** Section 3.2 (TraktCLI Adapter), Section 17 (Error Handling)

**Goal:** Implement safe child process execution for TraktCLI with JSON parsing, timeout, error handling, no shell injection, sanitized stderr.

**Files to create:**
- `src/trakt/cli.ts` — extend with `executeCommand(args: string[], timeoutMs?: number): Promise<TraktCliResult>`

**TDD steps:**
1. Write `tests/unit/trakt-cli-adapter.test.ts` testing:
   - Successful JSON output parsing
   - Timeout handling
   - Non-zero exit code handling
   - Sanitized stderr (no credential leakage)
   - No shell injection (spawn with array args, not shell)
2. Run tests — expect RED.
3. Implement `executeCommand()` using `child_process.spawn` with array args.
4. Run tests — expect GREEN.
5. Main agent verifies diff.
6. Commit: `feat: add TraktCLI command adapter`
7. Push.

---

## Task 5 — Authentication File Reader

**Spec coverage:** Section 9 (Security and Authentication), Section 17.3 (Authentication Error)

**Goal:** Implement secure local reading of `~/.trakt.yaml` with redaction rules.

**Files to create:**
- `src/trakt/auth.ts` — `readTraktConfig(): TraktAuthConfig | null`
- `tests/unit/auth-reader.test.ts`

**TDD steps:**
1. Write `tests/unit/auth-reader.test.ts` testing:
   - File not found → returns null
   - Valid YAML parsing
   - Redaction of access_token, refresh_token, client_id, client_secret
   - Never logs credentials
2. Run tests — expect RED.
3. Implement `src/trakt/auth.ts` with safe YAML parsing and redaction.
4. Run tests — expect GREEN.
5. Main agent verifies diff.
6. Commit: `feat: add secure Trakt credential reader`
7. Push.

---

## Task 6 — SQLite Foundation and Migrations

**Spec coverage:** Section 5 (Cache), Section 6 (Data Model), Section 11.2 (Integration Tests)

**Goal:** Implement SQLite database initialization, versioned migrations, foreign keys, schema version tracking.

**Files to create:**
- `src/cache/database.ts` — `initDatabase(): Promise<void>`, `getConnection(): Database`
- `src/cache/migrations.ts` — `runMigrations(): Promise<void>`, version tracking
- `tests/integration/sqlite.test.ts`
- `tests/integration/migrations.test.ts`

**TDD steps:**
1. Write `tests/integration/sqlite.test.ts` testing database creation and connection.
2. Run tests — expect RED.
3. Implement `src/cache/database.ts`.
4. Run tests — expect GREEN.
5. Write `tests/integration/migrations.test.ts` testing migration v1 → v2 → v3.
6. Run tests — expect RED.
7. Implement `src/cache/migrations.ts` with version table and migration registry.
8. Run tests — expect GREEN.
9. Main agent verifies diff.
10. Commit: `feat: add SQLite cache foundation`
11. Push.

---

## Task 7 — Media Schema and Repositories

**Spec coverage:** Section 6 (Data Model)

**Goal:** Implement all repository tables: media, history, progress, watchlist, sync_state, search_cache.

**Files to create:**
- `src/cache/repositories/media.ts`
- `src/cache/repositories/history.ts`
- `src/cache/repositories/progress.ts`
- `src/cache/repositories/watchlist.ts`
- `src/cache/repositories/sync-state.ts`
- `src/cache/repositories/search-cache.ts`
- `src/trakt/types.ts` — all type definitions

**TDD steps:**
1. Write `tests/unit/media-schema.test.ts` testing schema creation for all tables.
2. Run tests — expect RED.
3. Implement all repository files with table creation and basic CRUD.
4. Run tests — expect GREEN.
5. Main agent verifies diff.
6. Commit: `feat: add cache repositories`
7. Push.

---

## Task 8 — Movies / Series / Anime Classification

**Spec coverage:** Section 4 (Movies / Series / Anime Classification)

**Goal:** Implement classification logic with TDD. Preserve `trakt_type` separate from `category`.

**Files to create:**
- `src/classification/media-category.ts`
- `tests/unit/media-category.test.ts`

**TDD steps:**
1. Write `tests/unit/media-category.test.ts` with test cases:
   - `trakt_type=movie, genres includes anime` → `category=anime`
   - `trakt_type=movie, genres no anime` → `category=movie`
   - `trakt_type=show, genres includes anime` → `category=anime`
   - `trakt_type=show, genres no anime` → `category=series`
2. Run tests — expect RED.
3. Implement `src/classification/media-category.ts` with `classifyMedia(traktType, genres): Category`.
4. Run tests — expect GREEN.
5. Main agent verifies diff.
6. Commit: `feat: add media classification`
7. Push.

---

## Task 9 — Initial Full Synchronization

**Spec coverage:** Section 7.2 (First Synchronization), Section 3.5 (Sync Engine)

**Goal:** Implement lazy/on-demand initial sync for history, progress, watchlist using fixtures.

**Files to create:**
- `src/sync/initial-sync.ts`
- `tests/integration/initial-sync.test.ts`

**TDD steps:**
1. Write `tests/integration/initial-sync.test.ts` with mock TraktCLI output fixtures.
2. Run tests — expect RED.
3. Implement `src/sync/initial-sync.ts` with `performInitialSync()`.
4. Run tests — expect GREEN.
5. Main agent verifies diff.
6. Commit: `feat: add initial synchronization`
7. Push.

---

## Task 10 — Read-Only Trakt API Adapter

**Spec coverage:** Section 3.3 (Trakt API Adapter), Section 9 (Read-Only Guarantee)

**Goal:** Implement minimal read-only API adapter. Primary endpoint: `/sync/last_activities`. No mutations.

**Files to create:**
- `src/trakt/api.ts`
- `tests/unit/api-adapter.test.ts`

**TDD steps:**
1. Write `tests/unit/api-adapter.test.ts` testing:
   - `/sync/last_activities` endpoint
   - Read-only verification (no POST/PUT/DELETE methods)
   - Authentication header construction from Trakt config
2. Run tests — expect RED.
3. Implement `src/trakt/api.ts` with `getLastActivities()` and read-only enforcement.
4. Run tests — expect GREEN.
5. Main agent verifies diff.
6. Commit: `feat: add read-only Trakt API adapter`
7. Push.

---

## Task 11 — Incremental Synchronization

**Spec coverage:** Section 7.3 (Subsequent Synchronizations), Section 7.1 (TTL)

**Goal:** Implement TTL-based incremental sync using `/sync/last_activities`. Default TTL = 5 minutes, configurable in v1.

**Files to create:**
- `src/sync/incremental-sync.ts`
- `src/sync/last-activities.ts`
- `tests/integration/incremental-sync.test.ts`

**TDD steps:**
1. Write `tests/integration/incremental-sync.test.ts` testing:
   - TTL check (cache < 5 min → skip sync)
   - TTL check (cache >= 5 min → call last_activities)
   - Changed resources only sync
   - Unchanged resources return cache
2. Run tests — expect RED.
3. Implement `src/sync/incremental-sync.ts` and `src/sync/last-activities.ts`.
4. Run tests — expect GREEN.
5. Main agent verifies diff.
6. Commit: `feat: add incremental synchronization`
7. Push.

---

## Task 12 — Offline/Stale-Cache Behavior

**Spec coverage:** Section 7.4 (Offline Behavior), Section 17 (Error Handling)

**Goal:** Implement stale-cache fallback and error handling for Trakt unavailability.

**Files to create:**
- `tests/integration/stale-cache.test.ts`

**TDD steps:**
1. Write `tests/integration/stale-cache.test.ts` testing:
   - Cache exists + Trakt offline → returns `{ source: "cache", stale: true }`
   - No cache + Trakt offline → returns clear error
   - Auth error → sanitized error (no tokens exposed)
   - Invalid TraktCLI data → sync fails with sanitized error
2. Run tests — expect RED.
3. Implement stale-cache logic in sync engine.
4. Run tests — expect GREEN.
5. Main agent verifies diff.
6. Commit: `feat: add offline cache fallback`
7. Push.

---

## Task 13 — MCP stdio Server Foundation

**Spec coverage:** Section 2 (Tech Stack), Section 3.1 (MCP Layer), Section 11.4 (Smoke Tests)

**Goal:** Create standard MCP stdio server. No HTTP. Smoke test: `tools/list`.

**Files to create:**
- `src/mcp/server.ts`
- `tests/smoke/server-start.test.ts`

**TDD steps:**
1. Write `tests/smoke/server-start.test.ts` that spawns the MCP server and verifies `tools/list` returns.
2. Run tests — expect RED.
3. Implement `src/mcp/server.ts` with `stdio` transport and empty tool list.
4. Run tests — expect GREEN.
5. Main agent verifies diff.
6. Commit: `feat: add MCP stdio server`
7. Push.

---

## Task 14 — trakt_history Tool

**Spec coverage:** Section 8 (MCP Tools), Section 8.1 (Filters), Section 8.2 (Response Limits)

**Goal:** Implement `trakt_history` with category filter, limit (default 50, max 250).

**Files to create:**
- `src/mcp/tools/trakt-history.ts`
- `tests/contract/trakt-history.test.ts`

**TDD steps:**
1. Write `tests/contract/trakt-history.test.ts` testing:
   - Default limit = 50
   - Max limit = 250
   - Category filter (all, movie, series, anime)
   - Schema validation
2. Run tests — expect RED.
3. Implement `src/mcp/tools/trakt-history.ts`.
4. Run tests — expect GREEN.
5. Main agent verifies diff.
6. Commit: `feat: add trakt_history tool`
7. Push.

---

## Task 15 — trakt_progress Tool

**Spec coverage:** Section 8 (MCP Tools)

**Goal:** Implement `trakt_progress` with approved filters.

**Files to create:**
- `src/mcp/tools/trakt-progress.ts`
- `tests/contract/trakt-progress.test.ts`

**TDD steps:**
1. Write `tests/contract/trakt-progress.test.ts` testing schema and response format.
2. Run tests — expect RED.
3. Implement `src/mcp/tools/trakt-progress.ts`.
4. Run tests — expect GREEN.
5. Main agent verifies diff.
6. Commit: `feat: add trakt_progress tool`
7. Push.

---

## Task 16 — trakt_watchlist Tool

**Spec coverage:** Section 8 (MCP Tools)

**Goal:** Implement `trakt_watchlist` read-only.

**Files to create:**
- `src/mcp/tools/trakt-watchlist.ts`
- `tests/contract/trakt-watchlist.test.ts`

**TDD steps:**
1. Write `tests/contract/trakt-watchlist.test.ts` testing schema and read-only response.
2. Run tests — expect RED.
3. Implement `src/mcp/tools/trakt-watchlist.ts`.
4. Run tests — expect GREEN.
5. Main agent verifies diff.
6. Commit: `feat: add trakt_watchlist tool`
7. Push.

---

## Task 17 — trakt_calendar Tool

**Spec coverage:** Section 8 (MCP Tools)

**Goal:** Implement `trakt_calendar` read-only.

**Files to create:**
- `src/mcp/tools/trakt-calendar.ts`
- `tests/contract/trakt-calendar.test.ts`

**TDD steps:**
1. Write `tests/contract/trakt-calendar.test.ts` testing schema and response.
2. Run tests — expect RED.
3. Implement `src/mcp/tools/trakt-calendar.ts`.
4. Run tests — expect GREEN.
5. Main agent verifies diff.
6. Commit: `feat: add trakt_calendar tool`
7. Push.

---

## Task 18 — trakt_search Tool

**Spec coverage:** Section 8 (MCP Tools), Section 6.6 (Search Cache)

**Goal:** Implement `trakt_search` with local search cache.

**Files to create:**
- `src/mcp/tools/trakt-search.ts`
- `tests/contract/trakt-search.test.ts`

**TDD steps:**
1. Write `tests/contract/trakt-search.test.ts` testing search with cache hit/miss.
2. Run tests — expect RED.
3. Implement `src/mcp/tools/trakt-search.ts`.
4. Run tests — expect GREEN.
5. Main agent verifies diff.
6. Commit: `feat: add trakt_search tool`
7. Push.

---

## Task 19 — Synchronization Tools

**Spec coverage:** Section 8 (MCP Tools)

**Goal:** Implement `trakt_sync`, `trakt_sync_status`, `trakt_cache_stats`. `trakt_sync(force=true)` modifies only local cache.

**Files to create:**
- `src/mcp/tools/trakt-sync.ts`
- `src/mcp/tools/trakt-sync-status.ts`
- `src/mcp/tools/trakt-cache-stats.ts`
- `tests/contract/trakt-sync.test.ts`
- `tests/contract/trakt-sync-status.test.ts`
- `tests/contract/trakt-cache-stats.test.ts`

**TDD steps:**
1. Write contract tests for all three tools.
2. Run tests — expect RED.
3. Implement all three tools.
4. Run tests — expect GREEN.
5. Main agent verifies diff.
6. Commit: `feat: add synchronization MCP tools`
7. Push.

---

## Task 20 — Security Regression Suite

**Spec coverage:** Section 9 (Security and Authentication)

**Goal:** Test that MCP/logs do not expose access-token, refresh-token, client-id, client-secret.

**Files to create:**
- `tests/unit/credential-leakage.test.ts`

**TDD steps:**
1. Write `tests/unit/credential-leakage.test.ts` testing:
   - MCP tool outputs do not contain access_token
   - MCP tool outputs do not contain refresh_token
   - MCP tool outputs do not contain client_id
   - MCP tool outputs do not contain client_secret
   - Log outputs do not contain any of the above
2. Run tests — expect RED.
3. Implement redaction in all MCP tools and logging.
4. Run tests — expect GREEN.
5. Main agent verifies diff.
6. Commit: `test: add credential leakage regression coverage`
7. Push.

---

## Task 21 — GitHub Actions

**Spec coverage:** Section 12 (CI)

**Goal:** Cross-platform CI with lint, typecheck, test, build.

**Files to create:**
- `.github/workflows/ci.yml`

**TDD steps:**
1. Write CI workflow with matrix: Windows, Linux, macOS.
2. Steps: lint, typecheck, test, build.
3. Main agent verifies workflow syntax.
4. Commit: `ci: add cross-platform validation`
5. Push.

---

## Task 22 — User Documentation

**Spec coverage:** Section 14 (Credits), Section 15 (Disclaimer), Section 13 (TraktCLI Dependency)

**Goal:** Complete EN + PT-BR documentation.

**Files to create:**
- `docs/superpowers/guides/v1-setup-and-usage.md`

**Content (EN + PT-BR):**
- Installation
- TraktCLI requirement
- Authentication
- MCP configuration examples (Pi Agent + generic)
- Configuration (TTL, cache path, TraktCLI path)
- Troubleshooting
- Security
- Credits (omarshahine/trakt-plugin + angristan/trakt-cli)
- Unofficial disclaimer

**TDD steps:**
1. Write EN section.
2. Write PT-BR section.
3. Main agent reviews for completeness and accuracy.
4. Commit: `docs: add v1 setup and usage guide`
5. Push.

---

## Task 23 — Final v1 Integration Verification

**Spec coverage:** All sections

**Goal:** Final integration verification. No new features.

**Steps:**
1. Clean install: `npm ci && npm run build`
2. Run lint: `npm run lint`
3. Run typecheck: `npm run typecheck`
4. Run full tests: `npm test`
5. Run MCP smoke test
6. Run credential scan
7. `git status` — must be clean
8. If documentation/metadata needs changes, commit separately.
9. If all green, commit: `chore: finalize v1 integration`
10. Push.

---

*Plan created: 2026-08-23*
*Approved by: project author*
*Next phase: Sequential subagent implementation*
