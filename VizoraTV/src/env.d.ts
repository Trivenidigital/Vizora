/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WEBSOCKET_URL: string
  readonly VITE_DISPLAY_PORT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 