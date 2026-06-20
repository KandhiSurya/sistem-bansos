import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  // Menunjukkan path ke aplikasi Next.js kamu untuk memuat next.config.js dan file .env
  dir: './',
})

// Konfigurasi kustom Jest
const config = {
  setupFiles: ['<rootDir>/jest.polyfills.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: '<rootDir>/jest-environment-jsdom-with-globals.js',
  moduleNameMapper: {
    // Membantu Jest membaca absolute import menggunakan tanda '@'
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}

export default createJestConfig(config)