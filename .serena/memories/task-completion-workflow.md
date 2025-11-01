# Task Completion Workflow

## Pre-Commit Checklist

### 1. Code Quality

```bash
# Type checking
bun typecheck

# Expected: No type errors
```

### 2. Linting

```bash
# Run linting
bun lint

# Expected: No linting errors (or only warnings if acceptable)
```

### 3. Testing

```bash
# Run all tests
bun test

# Or run specific app tests
cd apps/api
bash scripts/run-integration.sh

# Expected: All tests pass
# DO NOT ignore failed tests just to pass the build!
```

### 4. Build Verification

```bash
# Build all apps
bun build

# Or build specific apps
bun build:api
bun build:web
bun build:worker

# Expected: Build completes without errors
```

### 5. Code Formatting

```bash
# Format code
bun format

# Expected: All files formatted according to .prettierrc
```

## Pre-Push Checklist

### 1. All Pre-Commit Checks

Run all pre-commit checks first

### 2. Integration Tests

```bash
# Run full integration test suite
cd apps/api
bash scripts/run-integration.sh

# Expected: All integration tests pass
```

### 3. Security Check

- Review changes for secrets/credentials
- Verify no .env files are staged
- Check .gitignore is up to date

### 4. Commit Message

- Use conventional commit format
- Clear, professional message
- No AI attribution
- Reference issues if applicable

## Task Completion Workflow

### Step 1: Implementation

1. Make code changes
2. Follow code standards (500 line limit, YANGI, KISS, DRY)
3. Add error handling
4. Write/update tests

### Step 2: Verification

```bash
# 1. Compile check
bun typecheck

# 2. Linting
bun lint

# 3. Tests
bun test

# 4. Build
bun build
```

### Step 3: Documentation

- Update relevant documentation in `docs/`
- Add comments for complex logic
- Update API documentation if needed

### Step 4: Code Review

Use `code-reviewer` agent:

```bash
# Through Claude Code slash command
/review
```

### Step 5: Commit

```bash
# Stage changes
git add .

# Commit with conventional format
git commit -m "type(scope): description"

# Examples:
# git commit -m "feat(api): add video upload endpoint"
# git commit -m "fix(worker): resolve queue processing timeout"
# git commit -m "refactor(web): extract video player component"
```

### Step 6: Push

```bash
# Push to remote
git push origin branch-name
```

## Agent Delegation Workflow

### Planning Phase

1. Use `planner` agent to create implementation plan
2. Planner spawns multiple `researcher` agents in parallel
3. Review and approve plan

### Implementation Phase

1. Implement according to plan
2. Run compile checks after each file change
3. Test incrementally

### Review Phase

1. Use `code-reviewer` agent to review code
2. Address any issues found
3. Ensure adherence to standards

### Testing Phase

1. Use `tester` agent to run comprehensive tests
2. Review test coverage report
3. Fix any test failures

### Documentation Phase

1. Use `docs-manager` agent to update documentation
2. Verify docs are accurate and up-to-date
3. Update codebase-summary.md for significant changes

### Git Phase

1. Use `git-manager` agent for commit and push
2. Ensure conventional commit format
3. Professional, clean commit messages

### Project Management

1. Use `project-manager` agent after major features
2. Track progress and completion
3. Update project documentation

## Commands to Run When Task is Completed

### Full Verification Suite

```bash
# Type check
bun typecheck

# Lint
bun lint

# Format
bun format

# Test
bun test

# Build
bun build
```

### Database Tasks (if schema changed)

```bash
# Generate Prisma client
bun db:generate

# Run migrations
bun db:migrate

# Or push schema
bun db:push
```

### Integration Tests

```bash
cd apps/api
bash scripts/run-integration.sh
```

### Docker Environment (if testing locally)

```bash
# Start services
bun docker:up

# Run tests
bun test

# Stop services
bun docker:down
```

## Discord Notification (Important)

After finishing implementation, send summary to Discord:

```bash
./.claude/hooks/send-discord.sh 'Task completed: [description]

Summary:
- Feature X implemented
- Tests passing
- Documentation updated

Status: ✅ Ready for review'
```

## Common Issues & Solutions

### Type Errors

```bash
bun typecheck
# Fix type issues in reported files
```

### Linting Errors

```bash
bun lint
# Fix linting issues or adjust ESLint config if reasonable
```

### Test Failures

```bash
bun test
# Debug and fix failing tests
# DO NOT skip or ignore failed tests!
```

### Build Errors

```bash
bun build
# Fix compilation errors
# Check for missing dependencies
```

### Database Issues

```bash
# Regenerate Prisma client
bun db:generate

# Reset database (if needed)
bun db:push --force-reset
```
