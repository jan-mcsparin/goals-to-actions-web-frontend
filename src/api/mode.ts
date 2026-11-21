// Mock or real, for the whole app, chosen when it's built: the API unless
// VITE_API=mock (npm run dev:mock, and every test run: vite.config.ts).
export const realApi = import.meta.env.VITE_API !== 'mock'
