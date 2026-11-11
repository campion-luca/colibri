/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  /** chiave publishable (sb_publishable_…): è pubblica, va nel frontend */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
