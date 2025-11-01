# Code Style & Conventions

## Core Principles

1. **YANGI** (You Aren't Gonna Need It) - Avoid over-engineering
2. **KISS** (Keep It Simple, Stupid) - Prefer simplicity
3. **DRY** (Don't Repeat Yourself) - Eliminate duplication

## File Size

- **Hard limit**: 500 lines per file
- Files exceeding limit MUST be refactored
- Split into smaller, focused modules
- Exception: Auto-generated files (mark clearly)

## Formatting (Prettier)

```json
{
  "semi": false, // No semicolons
  "singleQuote": true, // Single quotes
  "tabWidth": 2, // 2 spaces
  "useTabs": false, // Spaces not tabs
  "printWidth": 100, // Max line length
  "trailingComma": "none", // No trailing commas
  "bracketSpacing": true, // { foo: bar }
  "arrowParens": "always", // (x) => x
  "endOfLine": "lf" // Unix line endings
}
```

## Naming Conventions

### TypeScript/JavaScript

- **Variables**: camelCase (`userName`, `isAuthenticated`)
- **Functions**: camelCase (`calculateTotal`, `getUserById`)
- **Classes**: PascalCase (`UserService`, `AuthManager`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`, `API_BASE_URL`)
- **Private members**: Prefix with underscore (`_connectionPool`, `_connect()`)

### Files

- **Source files**: kebab-case (`user-service.ts`, `api-client.ts`)
- **React components**: PascalCase (`UserProfile.tsx`, `NavigationBar.tsx`)
- **Test files**: Match source + `.test` or `.spec` (`user-service.test.ts`)
- **Directories**: kebab-case (`services/`, `api-clients/`, `test-helpers/`)

### Agent/Command/Skill Files

- **Agents**: kebab-case (`code-reviewer.md`, `planner.md`)
- **Commands**: kebab-case with optional category (`plan.md`, `fix/ci.md`)
- **Skills**: kebab-case directory + `SKILL.md` (`better-auth/SKILL.md`)
- **Reports**: `YYMMDD-from-[agent]-to-[agent]-[task]-report.md`
- **Plans**: `YYMMDD-[feature-name]-plan.md`

## Code Structure

### Indentation

- 2 spaces (not tabs)
- Consistent throughout
- No trailing whitespace

### Line Length

- Preferred: 80-100 characters
- Hard limit: 120 characters
- Break long lines logically

### Whitespace

- One blank line between functions
- Two blank lines between classes
- Space after keywords: `if (`, `for (`, `while (`
- No space before function parentheses: `function name(`

## Comments & Documentation

### Inline Comments

- Explain WHY, not WHAT
- Comment complex logic
- TODO format: `// TODO(name, YYMMDD): description`

### Function Documentation

```typescript
/**
 * Brief description of function
 *
 * @param param1 - Description
 * @param param2 - Description
 * @returns Description of return value
 * @throws {ErrorType} When error occurs
 */
function example(param1: string, param2: number): ReturnType {
  // Implementation
}
```

## Error Handling

### Always Use Try-Catch

```typescript
async function processData(id: string) {
  try {
    const data = await fetchData(id)
    return processResult(data)
  } catch (error) {
    logger.error('Processing failed', { id, error })
    throw new ProcessingError('Failed to process data', { cause: error })
  }
}
```

### Custom Error Classes

```typescript
class ValidationError extends Error {
  constructor(
    message: string,
    public field: string
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}
```

## Security Standards

### Input Validation

- Validate all inputs
- Use Zod for schema validation
- Sanitize user input
- Never log sensitive data (passwords, tokens)

### Secrets Management

- Use environment variables
- Never commit secrets
- Add `.env*` to `.gitignore`
- Use secret scanning pre-commit hooks

### Database Queries

- Use parameterized queries (Prisma handles this)
- Never concatenate user input in queries

## Import/Export

### Import Order

1. External dependencies
2. Internal workspace packages (@repo/\*)
3. Relative imports
4. Type imports (separate)

```typescript
// External
import { Hono } from 'hono'
import { z } from 'zod'

// Workspace
import { db } from '@repo/database'
import { logger } from '@repo/utils'

// Relative
import { userService } from './services/user'
import { authMiddleware } from '../middleware/auth'

// Types
import type { User } from './types'
```

## Testing

### Test Structure

- Use Arrange-Act-Assert pattern
- Descriptive test names
- One assertion per test (when possible)
- Mock external dependencies

### Test Naming

```typescript
describe('UserService', () => {
  describe('authenticateUser', () => {
    it('should return user when credentials are valid', async () => {
      // Test
    })

    it('should throw AuthenticationError when password is incorrect', async () => {
      // Test
    })
  })
})
```

## Git Commit Format

### Conventional Commits

```
type(scope): description

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `refactor`: Code refactoring
- `test`: Tests
- `ci`: CI/CD
- `chore`: Maintenance

### Examples

```
feat(api): add video upload endpoint
fix(worker): resolve queue processing timeout
docs: update API documentation
refactor(web): extract video player component
```

### Rules

- Subject: imperative mood, lowercase, no period
- Max 72 characters for subject
- No AI attribution or signatures
- Professional and clean
