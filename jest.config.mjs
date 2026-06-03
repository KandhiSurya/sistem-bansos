import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  // Menunjukkan path ke aplikasi Next.js kamu untuk memuat next.config.js dan file .env
  dir: './',
})

// Konfigurasi kustom Jest
const config = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    // Membantu Jest membaca absolute import menggunakan tanda '@'
    '^@/(.*)$': '<rootDir>/$1',
  },
}

export default createJestConfig(config)