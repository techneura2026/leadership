require('dotenv').config({ path: '.env.test' });

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'test/e2e/.*\\.e2e-spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  testEnvironment: 'node',
  testTimeout: 60000,
  // Run suites sequentially so shared DB state is predictable
  maxWorkers: 1,
  globalSetup: '<rootDir>/test/e2e/setup/global-setup.ts',
  globalTeardown: '<rootDir>/test/e2e/setup/global-teardown.ts',
  moduleNameMapper: {
    '^@leaderprism/shared$': '<rootDir>/../shared/src/index.ts',
  },
  reporters: ['default'],
};
