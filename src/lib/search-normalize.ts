/**
 * Folds text for forgiving search in Uzbek Latin and Russian: case, the many apostrophe forms used
 * for oʻ/gʻ and the tutuq belgisi (' ʻ ʼ ‘ ’ ` ´), and diacritics (so ё matches е and й matches и).
 * "togri", "to'g'ri" and "toʻgʻri" all match each other.
 */
export function normalizeSearch(s: string) {
  return s
    .toLowerCase()
    .replace(/['ʻʼ‘’`´]/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
