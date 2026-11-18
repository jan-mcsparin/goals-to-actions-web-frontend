/// <reference types="vite/client" />

interface ImportMetaEnv {
  // 'real' sends the screens already on the API to it (npm run dev:real);
  // anything else, or nothing, keeps the whole app on mock data.
  readonly VITE_API?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
