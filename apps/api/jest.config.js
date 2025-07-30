module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.module.ts',
    '!src/main.ts',
  ],
  coverageDirectory: './coverage',
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 90,
      statements: 90,
    },
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@oasis/(.*)$': '<rootDir>/../../libs/$1/src',
  },
  setupFilesAfterEnv: ['<rootDir>/test/jest-setup.ts'],
  testTimeout: 60000, // 60 seconds for container startup
};
