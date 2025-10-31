# Turbo Configuration Implementation Plan

**Date**: 2025-10-31
**Type**: Feature Implementation
**Status**: Planning
**Context Tokens**: Configure Turborepo pipeline for efficient builds, dev mode, and database tasks across monorepo workspaces.

## Executive Summary

Update Turborepo configuration to support all workspace packages and applications with optimized caching, task dependencies, and parallel execution for maximum development velocity.

## Context Links

- **Related Plans**: `plans/251031-phase1-foundation.md`
- **Dependencies**: All workspace packages (@repo/database, @repo/utils, @repo/constants), all apps (api, web, worker)
- **Reference Docs**: https://turbo.build/repo/docs

## Requirements

### Functional Requirements

- [x] Build pipeline with proper dependencies
- [x] Dev mode with persistent tasks
- [x] Database tasks (generate, migrate, push, studio)
- [x] Lint and typecheck tasks
- [x] Proper output caching
- [x] Root package.json scripts

### Non-Functional Requirements

- [x] Fast builds with aggressive caching
- [x] Parallel execution where possible
- [x] No unnecessary rebuilds
- [x] Clear task output

## Architecture Overview

```
Root
├── turbo.json              # Pipeline configuration
├── package.json            # Root scripts
└── .turbo/                 # Cache directory (auto-generated)
    └── cache/
```

### Key Components

- **Build Pipeline**: Handles package builds with dependency order
- **Dev Pipeline**: Runs multiple dev servers concurrently
- **Database Pipeline**: Prisma tasks with cache invalidation
- **Lint Pipeline**: Type checking and code quality

## Implementation Phases

### Phase 1: Turbo Pipeline Configuration (Est: 0.5 days)

**Scope**: Configure turbo.json with all task definitions

**Tasks**:

1. [x] Update turbo.json - file: `turbo.json`
2. [x] Define build task with outputs
3. [x] Define dev task (persistent, no cache)
4. [x] Define database tasks
5. [x] Define lint/typecheck tasks
6. [x] Configure task dependencies

**Acceptance Criteria**:

- [x] `turbo build` builds all packages in correct order
- [x] `turbo dev` runs all dev servers concurrently
- [x] Database tasks don't cache inappropriately
- [x] Output directories properly cached

**Files to Update**:

`turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env", "tsconfig.json"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"],
      "env": ["NODE_ENV", "NEXT_PUBLIC_API_URL"]
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "dependsOn": ["^db:generate"]
    },
    "start": {
      "dependsOn": ["build"],
      "cache": false
    },
    "lint": {
      "dependsOn": ["^lint"],
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^typecheck"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": [],
      "inputs": ["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts", "test/**/*.tsx"]
    },
    "db:generate": {
      "cache": false,
      "outputs": ["node_modules/.prisma/**", "node_modules/@prisma/client/**"]
    },
    "db:migrate": {
      "cache": false
    },
    "db:migrate:deploy": {
      "cache": false
    },
    "db:push": {
      "cache": false
    },
    "db:studio": {
      "cache": false,
      "persistent": true
    },
    "clean": {
      "cache": false
    }
  },
  "globalEnv": ["DATABASE_URL", "NODE_ENV"]
}
```

### Phase 2: Root Package Scripts (Est: 0.25 days)

**Scope**: Add convenient npm scripts to root package.json

**Tasks**:

1. [x] Update root package.json - file: `package.json`
2. [x] Add turbo task wrappers
3. [x] Add convenience scripts
4. [x] Add workspace management scripts

**Acceptance Criteria**:

- [x] All tasks executable from root
- [x] Scripts follow consistent naming
- [x] Can target specific workspaces

**Files to Update**:

`package.json`:

```json
{
  "name": "streaming-video",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo dev",
    "dev:api": "turbo dev --filter=api",
    "dev:web": "turbo dev --filter=web",
    "dev:worker": "turbo dev --filter=worker",
    "build": "turbo build",
    "build:api": "turbo build --filter=api",
    "build:web": "turbo build --filter=web",
    "build:worker": "turbo build --filter=worker",
    "start": "turbo start",
    "start:api": "turbo start --filter=api",
    "start:web": "turbo start --filter=web",
    "start:worker": "turbo start --filter=worker",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "clean": "turbo clean && rm -rf node_modules .turbo",
    "db:generate": "turbo db:generate",
    "db:migrate": "turbo db:migrate",
    "db:migrate:deploy": "turbo db:migrate:deploy",
    "db:push": "turbo db:push",
    "db:studio": "turbo db:studio",
    "docker:build": "docker-compose build",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f",
    "docker:clean": "docker-compose down -v"
  },
  "devDependencies": {
    "@turbo/gen": "^2.3.3",
    "turbo": "^2.3.3"
  },
  "packageManager": "bun@1.1.38",
  "engines": {
    "node": ">=20",
    "bun": ">=1.1.0"
  }
}
```

### Phase 3: App-Specific Scripts (Est: 0.25 days)

**Scope**: Ensure all apps have consistent npm scripts

**Tasks**:

1. [x] Update apps/api/package.json scripts
2. [x] Update apps/web/package.json scripts
3. [x] Verify apps/worker/package.json scripts

**Acceptance Criteria**:

- [x] All apps have dev, build, start, lint, typecheck scripts
- [x] Scripts follow same pattern across apps
- [x] Turbo can discover and run all scripts

**Files to Update**:

`apps/api/package.json` (verify these scripts exist):

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsup",
    "start": "node dist/index.js",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  }
}
```

`apps/web/package.json` (verify these scripts exist):

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  }
}
```

`apps/worker/package.json` (already created in previous plan):

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsup",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  }
}
```

### Phase 4: .gitignore Updates (Est: 0.1 days)

**Scope**: Add Turbo cache to .gitignore

**Tasks**:

1. [x] Update .gitignore - file: `.gitignore`

**Acceptance Criteria**:

- [x] Turbo cache ignored
- [x] Build outputs ignored
- [x] No cache committed to git

**Files to Update**:

`.gitignore` (add these lines):

```gitignore
# Turbo
.turbo

# Build outputs
dist
.next
build

# Prisma
node_modules/.prisma

# Env
.env
.env.local
.env.production
```

## Testing Strategy

- **Build Tests**: Run `bun turbo build` from clean state
- **Dev Tests**: Start all dev servers with `bun turbo dev`
- **Cache Tests**: Build twice, verify second build uses cache
- **Dependency Tests**: Change package, verify dependent apps rebuild

## Security Considerations

- [x] No secrets in turbo.json
- [x] Environment variables properly scoped
- [x] Cache doesn't leak sensitive data

## Risk Assessment

| Risk                      | Impact | Mitigation                                  |
| ------------------------- | ------ | ------------------------------------------- |
| Cache invalidation issues | Medium | Use globalDependencies for critical files   |
| Parallel task conflicts   | Low    | Use task dependencies to enforce order      |
| Missing outputs           | Low    | Test builds thoroughly, add all output dirs |

## Quick Reference

### Key Commands

```bash
# Build all apps and packages
bun turbo build

# Run all dev servers
bun turbo dev

# Run specific app
bun turbo dev --filter=api

# Run multiple specific apps
bun turbo dev --filter=api --filter=web

# Clear cache and rebuild
bun run clean
bun install
bun turbo build

# Database tasks
bun turbo db:generate
bun turbo db:migrate

# Dry run (see what would execute)
bun turbo build --dry-run

# See task graph
bun turbo build --graph
```

### Configuration Files

- `turbo.json`: Pipeline configuration
- `package.json`: Root scripts
- `.turbo/`: Cache directory (ignored by git)

## TODO Checklist

- [x] Update turbo.json with all task definitions
- [x] Configure build task with outputs
- [x] Configure dev task (persistent, no cache)
- [x] Configure database tasks (no cache)
- [x] Configure lint/typecheck tasks
- [x] Update root package.json with convenience scripts
- [x] Verify apps/api/package.json scripts
- [x] Verify apps/web/package.json scripts
- [x] Verify apps/worker/package.json scripts
- [x] Update .gitignore with .turbo
- [x] Test `bun turbo build` from clean state
- [x] Test `bun turbo dev` starts all services
- [x] Test `bun turbo build --filter=api` targets correctly
- [x] Test build cache works (run build twice)
- [x] Test `bun turbo db:generate`
- [x] Generate task graph: `bun turbo build --graph`
- [x] Commit changes to git

## Performance Targets

- **First build**: < 2 minutes (all packages + apps)
- **Cached build**: < 10 seconds
- **Dev server start**: < 30 seconds
- **Database generate**: < 5 seconds

## Notes

- Turbo automatically detects changed files
- Use `--force` to bypass cache
- Use `--filter` to target specific workspaces
- Cache stored in `.turbo/cache` (local) or remote cache (if configured)
- `persistent: true` tasks run until manually stopped
- Tasks with `cache: false` always re-execute

## Troubleshooting

**Issue**: Build doesn't use cache

- **Solution**: Check `outputs` includes all build artifacts

**Issue**: Dev servers don't start

- **Solution**: Verify `persistent: true` and `cache: false` on dev task

**Issue**: Database generate runs too often

- **Solution**: Check `outputs` includes `node_modules/.prisma/**`

**Issue**: Tasks run in wrong order

- **Solution**: Add `dependsOn` to enforce dependencies
