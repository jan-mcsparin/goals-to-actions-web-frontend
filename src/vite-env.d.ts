/// <reference types="vite/client" />

interface ImportMetaEnv {
  // 'mock' runs the whole app on mock data (npm run dev:mock, and every test);
  // anything else, or nothing, talks to the API.
  readonly VITE_API?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
