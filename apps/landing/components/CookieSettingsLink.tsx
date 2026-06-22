"use client";

import { openCookieSettings } from "./CookieBanner";

export function CookieSettingsLink() {
  return (
    <button onClick={openCookieSettings} className="hover:text-white">
      Cookie settings
    </button>
  );
}
