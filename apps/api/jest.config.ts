const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  moduleNameMapper: {
    '^\\.\\./prisma$': '<rootDir>/src/prisma',
    '^\\.\\./utils/revalidate$': '<rootDir>/src/utils/revalidate',
    '^\\.\\./audit$': '<rootDir>/src/audit',
  },
  globals: {
    'ts-jest': { tsconfig: 'tsconfig.jest.json' }
  }
} as const;

export default config;
