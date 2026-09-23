"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

/**
 * Document Picture-in-Picture: an always-on-top window opened from this page,
 * which the timer renders into with a React portal (same state, same
 * handlers). Chrome/Edge 116+ and Firefox 151+ on desktop; elsewhere
 * `supported` is false and the button isn't shown.
 *
 * The new document starts empty, so the page's stylesheets, fonts and theme
 * attributes are copied into it when it opens, and a theme picked while it's
 * open follows it there.
 */
export function useDocumentPip() {
  // False on the server and during hydration, the real answer after.
  const supported = useSyncExternalStore(
    subscribeNever,
    () => "documentPictureInPicture" in window,
    () => false,
  );
  const [pipWindow, setPipWindow] = useState<Window | null>(null);

  const open = useCallback(async (size: { width: number; height: number }) => {
    const api = window.documentPictureInPicture;
    if (!api) return;

    const pip = await api.requestWindow(size);
    copyDocumentLook(document, pip.document);
    const followTheme = new MutationObserver(() => copyRootAttributes(document, pip.document));
    followTheme.observe(document.documentElement, { attributes: true, attributeFilter: ["class", ...ROOT_ATTRIBUTES] });
    pip.addEventListener(
      "pagehide",
      () => {
        followTheme.disconnect();
        setPipWindow(null);
      },
      { once: true },
    );
    setPipWindow(pip);
  }, []);

  const close = useCallback(() => {
    pipWindow?.close();
  }, [pipWindow]);

  // The floating window never outlives this page (a platform rule); closing
  // it on unmount keeps a stale one from lingering after navigation.
  useEffect(() => () => pipWindow?.close(), [pipWindow]);

  return { supported, pipWindow, open, close };
}

function copyDocumentLook(from: Document, to: Document) {
  for (const sheet of Array.from(from.styleSheets)) {
    try {
      const style = to.createElement("style");
      style.textContent = Array.from(sheet.cssRules, (rule) => rule.cssText).join("\n");
      to.head.append(style);
    } catch {
      // Cross-origin sheets can't be read; link them instead.
      if (sheet.href) {
        const link = to.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        to.head.append(link);
      }
    }
  }

  copyRootAttributes(from, to);
  // The window's content sizes itself to the window: it never scrolls.
  to.body.className = `${from.body.className} overflow-hidden`;
}

const ROOT_ATTRIBUTES = ["lang", "data-palette", "data-theme"];

function copyRootAttributes(from: Document, to: Document) {
  const root = from.documentElement;
  to.documentElement.className = root.className;
  for (const attribute of ROOT_ATTRIBUTES) {
    const value = root.getAttribute(attribute);
    if (value) to.documentElement.setAttribute(attribute, value);
  }
}
