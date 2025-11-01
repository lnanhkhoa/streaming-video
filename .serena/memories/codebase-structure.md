# Codebase Structure

## Root Structure

```
streaming-video/
├── apps/                      # Applications
│   ├── api/                  # Hono API server
│   ├── web/                  # Next.js web app
│   └── worker/               # Background worker
├── packages/                  # Shared packages
│   ├── database/             # Prisma database layer
│   ├── constants/            # Shared constants
│   ├── utils/                # Shared utilities
│   ├── eslint-config/        # ESLint config
│   └── typescript-config/    # TypeScript config
├── .claude/                   # Claude Code configuration
│   ├── agents/               # Agent definitions
│   ├── commands/             # Slash commands
│   ├── hooks/                # Git hooks & scripts
│   ├── skills/               # Knowledge modules
│   └── workflows/            # Workflow definitions
├── docs/                      # Documentation
│   ├── project-overview-pdr.md
│   ├── code-standards.md
│   ├── codebase-summary.md
│   └── *.md
├── plans/                     # Implementation plans
│   ├── reports/              # Agent reports
│   └── templates/            # Plan templates
├── turbo.json                # Turborepo configuration
├── package.json              # Root package.json
├── .prettierrc               # Prettier config
├── .gitignore                # Git ignore
├── CLAUDE.md                 # Claude instructions
└── README.md                 # Project overview
```

## Apps Structure

### API (apps/api)

```
apps/api/
├── src/
│   ├── index.ts              # Entry point
│   ├── routes/               # API routes
│   ├── middleware/           # Middleware
│   ├── services/             # Business logic
│   └── types/                # TypeScript types
├── scripts/
│   └── run-integration.sh    # Integration test runner
├── test/                     # Tests
├── package.json
└── tsconfig.json
```

**Key Dependencies**:

- Hono: Web framework
- Zod: Validation
- Prisma: Database (via @repo/database)
- RabbitMQ: Message queue
- Redis: Caching
- MinIO: Object storage

### Web (apps/web)

```
apps/web/
├── src/
│   ├── app/                  # Next.js App Router
│   ├── components/           # React components
│   ├── lib/                  # Utilities
│   └── types/                # TypeScript types
├── public/                   # Static assets
├── package.json
└── tsconfig.json
```

### Worker (apps/worker)

```
apps/worker/
├── src/
│   ├── index.ts              # Entry point
│   ├── jobs/                 # Job handlers
│   ├── services/             # Business logic
│   └── types/                # TypeScript types
├── package.json
└── tsconfig.json
```

## Packages Structure

### Database (@repo/database)

- Prisma schema and client
- Database migrations
- Database utilities
- Shared types

### Constants (@repo/constants)

- Application constants
- Environment variables
- Configuration values

### Utils (@repo/utils)

- Shared utility functions
- Common helpers
- Logging utilities

### Config Packages

- **eslint-config**: Shared ESLint rules
- **typescript-config**: Shared TypeScript configs

## Claude Configuration (.claude/)

### Agents (`.claude/agents/`)

Specialized AI agents:

- planner.md
- researcher.md
- tester.md
- code-reviewer.md
- docs-manager.md
- git-manager.md
- project-manager.md
- database-admin.md
- debugger.md

### Commands (`.claude/commands/`)

Slash commands organized by category:

- plan.md
- cook.md
- test.md
- fix/\*.md
- design/\*.md
- git/\*.md
- docs/\*.md

### Workflows (`.claude/workflows/`)

- primary-workflow.md
- development-rules.md
- orchestration-protocol.md
- documentation-management.md

### Skills (`.claude/skills/`)

Knowledge modules for specific technologies:

- better-auth/
- cloudflare/
- mongodb/
- nextjs/
- And more...

## Documentation (docs/)

```
docs/
├── project-overview-pdr.md   # Product requirements
├── code-standards.md         # Coding standards
├── codebase-summary.md       # Codebase overview
├── design-guidelines.md      # Design guidelines
├── deployment-guide.md       # Deployment guide
├── system-architecture.md    # Architecture docs
└── project-roadmap.md        # Project roadmap
```

## Plans Directory

```
plans/
├── reports/                  # Agent communication
│   └── YYMMDD-from-[agent]-to-[agent]-[task]-report.md
├── templates/                # Plan templates
└── YYMMDD-[feature]-plan.md  # Implementation plans
```

## Important Files

### turbo.json

Defines Turborepo tasks:

- build: Build all apps
- dev: Development mode
- test: Run tests
- lint: Run linting
- typecheck: Type checking
- db:\* : Database tasks

### package.json (root)

Scripts:

- dev, build, start, test, lint
- Database tasks (db:\*)
- Docker tasks (docker:\*)

### .gitignore

Excludes:

- node_modules/
- .env files
- Build outputs (dist/, .next/)
- IDE files
- OS files
- Temporary files
- Plans and docs subdirectories
- Claude configuration subdirectories
