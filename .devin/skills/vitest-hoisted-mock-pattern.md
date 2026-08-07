---
description: Vitest vi.hoisted pattern for mock factories that reference mock variables — prevents "Cannot access X before initialization" errors in test files
---

# Vitest `vi.hoisted` Mock Pattern

## When to use

Any test file that uses `vi.mock()` with a factory function referencing variables (mock functions, mock objects). This is the standard pattern for service unit tests in `apps/api/src/services/__tests__/`.

## The Problem

`vi.mock()` calls are **hoisted to the top of the file** by Vitest's transform pipeline — they run before any `const` declarations. If a mock factory references a variable declared with `const` at module scope, the variable won't be initialized yet:

```ts
// ❌ BROKEN — mockPromptService is not initialized when vi.mock runs
const mockPromptService = {
  createExecution: vi.fn(),
  getExecution: vi.fn(),
};

vi.mock('../MarketingPromptService', () => ({
  default: mockPromptService,  // ReferenceError: Cannot access 'mockPromptService' before initialization
}));
```

This error is cryptic and easy to miss — it manifests as `Error: [vitest] There was an error when mocking a module` with `Caused by: ReferenceError: Cannot access 'X' before initialization`.

## The Fix

Move all mock variables that are referenced inside `vi.mock()` factories into a single `vi.hoisted()` call at the top of the file. `vi.hoisted()` is also hoisted, so its return value is available when the `vi.mock()` factories run:

```ts
// ✅ CORRECT — all mock variables in vi.hoisted()
const {
  mockExecutions,
  mockCampaigns,
  mockPromptService,
  mockCampaignService,
} = vi.hoisted(() => ({
  mockExecutions: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mockCampaigns: { findUnique: vi.fn(), update: vi.fn() },
  mockPromptService: {
    createExecution: vi.fn(),
    getExecution: vi.fn(),
    updateExecution: vi.fn(),
  },
  mockCampaignService: {
    transitionStage: vi.fn(),
  },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_prompt_executions_list: mockExecutions,
    mkt_campaigns_list: mockCampaigns,
  },
}));

vi.mock('../MarketingPromptService', () => ({
  default: mockPromptService,  // ✅ Works — hoisted
}));

vi.mock('../MarketingCampaignService', () => ({
  default: mockCampaignService,  // ✅ Works — hoisted
}));
```

## Mocking dynamically-imported modules

When the service under test uses `await import('./SomeModule.js')` (dynamic import), the `vi.mock()` path must match the **import specifier relative to the test file**, not the service file. For example, if `DisputeIntakeService.ts` does `await import('./intake/IntakeDefinitionService.js')`, the test file (in `__tests__/`) must mock `../intake/IntakeDefinitionService`:

```ts
// DisputeIntakeService.ts (in services/) does:
const { intakeDefinitionService } = await import('./intake/IntakeDefinitionService.js');

// DisputeIntakeService.test.ts (in services/__tests__/) must mock:
vi.mock('../intake/IntakeDefinitionService', () => ({
  intakeDefinitionService: {
    resolve: vi.fn().mockResolvedValue(null),
    buildSubmitSchema: vi.fn(),
    runCustomValidators: vi.fn().mockResolvedValue({}),
  },
}));
```

## Asserting on mocked dynamically-imported modules

To assert on mock calls (e.g., `expect(mockFn).toHaveBeenCalled()`), import the mocked module at the top of the test file. Vitest returns the mock factory's output:

```ts
import { intakeDefinitionService as mockIntakeDefService } from '../intake/IntakeDefinitionService';

// In a test:
mockIntakeDefService.resolve.mockResolvedValue(gbpDefinition);
// ... call the service ...
expect(mockIntakeDefService.resolve).toHaveBeenCalledWith('gbp_optimization', null, undefined);
```

Do **not** use `require()` inside `beforeEach` to access the mock — vitest's `require` resolution can fail with `Cannot find module` even when `vi.mock` is set up correctly. Use a top-level `import` instead.

## Common Pitfalls

1. **Forgetting to hoist a variable that's referenced in a factory.** Any variable used inside a `vi.mock()` factory must come from `vi.hoisted()`. This includes nested objects (e.g., `mockProvider` referenced inside `mockFactoryInstance`'s factory).

2. **Mocking the wrong path for dynamic imports.** The mock path is resolved relative to the **test file**, not the source file. If the source does `import('./foo/Bar.js')` and the test is in `__tests__/`, the mock path is `../foo/Bar`.

3. **Using `require()` to access mocks at runtime.** Vitest's `require` doesn't always resolve mocked modules the same way as `import`. Use a top-level `import` of the mocked module to get a reference to the mock factory's return value.

4. **Mocking a module that exports a singleton instance.** Many platform services export `export default MyService.getInstance()` — the default export is an instance, not the class. Mock the default export as an object with the methods you need, not as a class with `getInstance()`.

5. **Shared mock state across test files.** Vitest isolates mocks per file by default, but if tests run in the same worker and a mock leaks via a shared module (e.g., a base class that caches), it can cause cross-file failures. If you see a test pass alone but fail when run with others, check for singleton caching in the mocked module.

## Files That Follow This Pattern

- `apps/api/src/services/__tests__/DisputeIntakeService.test.ts` — mocks prisma, logger, IntakeDefinitionService, MarketingCampaignService, RecoveryResolutionService
- `apps/api/src/services/__tests__/IntakeDefinitionService.test.ts` — mocks prisma, logger, unifiedConfig
- `apps/api/src/services/__tests__/recoveryResolution.test.ts` — mocks prisma, logger, id-generator, MarketingPromptService, MarketingCampaignService, AiProviderFactory
- `apps/api/src/services/__tests__/marketingCampaign.recovery.test.ts` — mocks prisma, logger, id-generator
