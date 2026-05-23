const path = require('path')

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  collectCoverageFrom: [
    '<rootDir>/src/modules/order/**/*.ts',
    '<rootDir>/src/modules/order-processing/**/*.ts',
    '!<rootDir>/src/modules/**/index.ts',
    '!<rootDir>/src/modules/**/*.module.ts'
  ],
  coverageDirectory: path.join(__dirname, '..', 'coverage', 'server'),
  coverageReporters: ['text-summary', 'text', 'lcov'],
  coverageThreshold: {
    global: {
      statements: 5,
      branches: 3,
      functions: 8,
      lines: 5
    }
  }
}
