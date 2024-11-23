/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  // this test emulates a browser environment
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.config.browser.setup.js']
};
