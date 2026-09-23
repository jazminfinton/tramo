import { getRequestConfig } from "next-intl/server";

import { DEFAULT_TIME_ZONE, LOCALE } from "@/i18n/config";

export default getRequestConfig(async () => ({
  locale: LOCALE,
  // An explicit time zone keeps server and client formatting identical.
  timeZone: DEFAULT_TIME_ZONE,
  messages: (await import(`../messages/${LOCALE}.json`)).default,
}));
