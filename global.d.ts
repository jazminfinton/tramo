import type { LOCALE } from "@/i18n/config";
import type messages from "@/messages/es-AR.json";

// Type-safe message keys and locale for next-intl.
declare module "next-intl" {
  interface AppConfig {
    Locale: typeof LOCALE;
    Messages: typeof messages;
  }
}

// Document Picture-in-Picture (Chrome/Edge 116+, Firefox 151+), used by the
// floating timer. Not in TypeScript's DOM lib yet.
declare global {
  interface DocumentPictureInPictureOptions {
    width?: number;
    height?: number;
    disallowReturnToOpener?: boolean;
    preferInitialWindowPlacement?: boolean;
  }

  interface DocumentPictureInPicture extends EventTarget {
    readonly window: Window | null;
    requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>;
  }

  interface Window {
    readonly documentPictureInPicture?: DocumentPictureInPicture;
  }
}
