/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_URL?: string;
  readonly VITE_GOOGLE_ADSENSE_ID?: string;
  readonly VITE_GOOGLE_ADSENSE_SLOT_HEADER?: string;
  readonly VITE_GOOGLE_ADSENSE_SLOT_SIDEBAR?: string;
  readonly VITE_GOOGLE_ADSENSE_SLOT_IN_ARTICLE?: string;
  readonly VITE_GOOGLE_ADSENSE_SLOT_FOOTER?: string;
  [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
