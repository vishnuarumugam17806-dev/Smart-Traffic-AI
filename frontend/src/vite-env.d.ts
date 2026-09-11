/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_WS_URL: string;
  readonly VITE_MAP_PROVIDER?: string;
  readonly VITE_MAP_STYLE_URL?: string;
  readonly VITE_MAP_PUBLIC_KEY?: string;
  readonly VITE_TURN_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
