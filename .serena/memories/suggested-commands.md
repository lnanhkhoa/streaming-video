# Suggested Commands

## Development Commands

### Run Applications

```bash
# Run all apps in development mode
bun dev

# Run specific apps
bun dev:api      # API server
bun dev:web      # Next.js web app
bun dev:worker   # Background worker

# Build all apps
bun build

# Build specific apps
bun build:api
bun build:web
bun build:worker

# Start production builds
bun start
bun start:api
bun start:web
bun start:worker
```

### Code Quality

```bash
# Run linting
bun lint

# Type checking
bun typecheck
bun check-types  # Alternative

# Format code
bun format       # Prettier formatting
```

### Testing

```bash
# Run all tests
bun test

# API integration tests
cd apps/api
bash scripts/run-integration.sh
bash scripts/run-integration.sh --ui  # With UI
bun test:watch                        # Watch mode
bun test:coverage                     # Coverage report
```

### Database (Prisma)

```bash
# Generate Prisma client
bun db:generate

# Run migrations
bun db:migrate
bun db:migrate:deploy  # Production deployment

# Push schema changes
bun db:push

# Open Prisma Studio
bun db:studio
```

### Docker

```bash
# Build containers
bun docker:build

# Start services
bun docker:up

# Stop services
bun docker:down

# View logs
bun docker:logs

# Clean up (removes volumes)
bun docker:clean
```

### Utility Commands

```bash
# Clean all build artifacts
bun clean

# Install dependencies
bun install
```

## Git Commands

```bash
# Check status
git status

# View diff
git diff

# Stage changes
git add .

# Commit (conventional commits format)
git commit -m "type(scope): description"

# Push
git push

# Pull
git pull
```

## System Commands (Darwin/macOS)

```bash
# List files
ls -la

# Find files
find . -name "pattern"

# Search in files
grep -r "pattern" .

# Check disk usage
du -sh *

# View file contents
cat filename
head filename
tail filename

# Process management
ps aux | grep process_name
kill PID
```

## Database Commands

```bash
# Connect to PostgreSQL (via psql)
psql $DATABASE_URL

# Run query
psql $DATABASE_URL -c "SELECT * FROM table_name LIMIT 10;"
```

## Testing Workflow

```bash
# Before committing
bun lint          # 1. Check linting
bun typecheck     # 2. Type checking
bun test          # 3. Run tests

# After making changes
bun build         # Verify build works
```

## Development Workflow

1. Start development: `bun dev`
2. Make changes
3. Check types: `bun typecheck`
4. Run tests: `bun test`
5. Format code: `bun format`
6. Lint code: `bun lint`
7. Build: `bun build`
8. Commit with conventional format
