type ClickedLink = { href: string; target: string; download: boolean };
type Click = { button: number; modified: boolean };

/** A URL's page: path and query, without the hash (a hash change never loads anything). */
const pageOf = (url: URL) => `${url.pathname}?${new URLSearchParams(url.search).toString()}`;

/**
 * Whether a click on a link makes the app load another of its pages in this
 * tab: a plain left click, same origin, a different path or query. New tabs,
 * downloads, other sites and hash jumps don't.
 */
export function startsNavigation(link: ClickedLink, click: Click, currentHref: string): boolean {
  if (click.button !== 0 || click.modified || link.download) return false;
  if (link.target && link.target !== "_self") return false;
  const current = new URL(currentHref);
  const next = new URL(link.href, current);
  return next.origin === current.origin && pageOf(next) !== pageOf(current);
}
