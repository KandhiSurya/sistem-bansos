const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    // KUNCI PERBAIKAN: Perhatikan ada '/src/' di sini
    '^@/(.*)$': '<rootDir>/src/$1',
  }
}

module.exports = createJestConfig(customJestConfig) 