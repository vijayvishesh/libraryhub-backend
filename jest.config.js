require('dotenv').config({ path: '.env' });
/** @type {import('jest').Config} */
module.exports = {
  testRegex: "src/.*\\.(test|spec)\\.(ts|js)$",
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 60,
      functions: 70,
      lines: 80,
    },
  },
  coveragePathIgnorePatterns: [
    'dist/',
    'node_modules/',
    'projects/',
    'coverage/',
    'commands/',
    '.tmp/',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
  },
  extensionsToTreatAsEsm: ['.ts'],
};
