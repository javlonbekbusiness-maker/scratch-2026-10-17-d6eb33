import { requireAdmin } from '@/lib/session';
import Link from 'next/link';
import { db } from '@/lib/db';
import { LOCALES, LOCALE_LABELS, isLocale, type Locale } from '@/i18n/config';
import { MESSAGES, flatten } from '@/i18n/translate';
import { saveTranslation } from '../actions';
import { Badge, PageHeader, inputSm } from '../ui';

export const dynamic = 'force-dynamic';

const MESSAGES_UI: Record<string, [string, 'ok' | 'warn' | 'err']> = {
  saved: ['Saved. The site shows the new text now.', 'ok'],
  reset: ['Override removed; the shipped text is used again.', 'ok'],
  placeholders: ['Keep exactly the same {placeholders} as the shipped text (they are filled in by the app).', 'err'],
  'too-long': ['Text is too long (max 2000 characters).', 'err'],
  'unknown-key': ['Unknown key.', 'err'],
};
const TONE = { ok: 'bg-mint-500/10 text-mint-700', warn: 'bg-amber-100 text-amber-800', err: 'bg-red-500/10 text-red-700' };
const LIMIT = 80;

export default async function TranslationsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const lang: Locale = isLocale(sp.lang) ? sp.lang : 'uz';
  const q = (sp.q ?? '').trim().toLowerCase();
  const section = sp.section ?? '';
  const onlyOverridden = sp.only === '1';

  const shipped = flatten(MESSAGES[lang]);
  const reference = flatten(MESSAGES.uz);
  const overrides = await db.translationOverride.findMany({ where: { lang } });
  const counts = await db.translationOverride.groupBy({ by: ['lang'], _count: true });
  const over = new Map(overrides.map((o) => [o.key, o.value]));
  const sections = [...new Set(Object.keys(shipped).map((k) => k.split('.')[0]))];

  const keys = Object.keys(shipped).filter((k) => {
    if (section && !k.startsWith(`${section}.`)) return false;
    if (onlyOverridden && !over.has(k)) return false;
    if (!q) return true;
    return k.toLowerCase().includes(q) || shipped[k].toLowerCase().includes(q) || (over.get(k) ?? '').toLowerCase().includes(q) || reference[k].toLowerCase().includes(q);
  });
  const shown = keys.slice(0, LIMIT);
  const msg = sp.msg ? MESSAGES_UI[sp.msg] : undefined;
  const qs = (l: string) => `/admin/translations?${new URLSearchParams({ lang: l, ...(sp.q ? { q: sp.q } : {}), ...(section ? { section } : {}), ...(onlyOverridden ? { only: '1' } : {}) })}`;

  return (
    <>
      <PageHeader
        title="Translations"
        desc="Override any interface text without a code change. Leave a field empty (or equal to the shipped text) to use the shipped version. New languages are added as files in src/i18n/messages."
      />
      {msg && (
        <p role="status" className={`mb-4 rounded-xl px-3 py-2 text-sm ${TONE[msg[1]]}`}>
          {msg[0]}{sp.key && <span className="font-mono"> ({sp.key})</span>}
        </p>
      )}

      <nav className="mb-3 flex flex-wrap gap-2" aria-label="Language">
        {LOCALES.map((l) => (
          <Link key={l} href={qs(l)} aria-current={l === lang ? 'page' : undefined} className={`btn btn-sm ${l === lang ? 'bg-brand-600 text-white' : 'btn-secondary'}`}>
            {LOCALE_LABELS[l]} <span className="opacity-70">({counts.find((c) => c.lang === l)?._count ?? 0} overrides)</span>
          </Link>
        ))}
      </nav>

      <form className="card mb-4 grid gap-2 p-3 sm:grid-cols-[2fr_1fr_auto_auto]">
        <input type="hidden" name="lang" value={lang} />
        <input name="q" defaultValue={sp.q} placeholder="Search key or text" className={inputSm} aria-label="Search" />
        <select name="section" defaultValue={section} className={inputSm} aria-label="Section">
          <option value="">All sections</option>
          {sections.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="only" value="1" defaultChecked={onlyOverridden} className="h-4 w-4" /> Overridden only</label>
        <button className="btn-primary btn-sm">Filter</button>
      </form>

      <p className="mb-2 text-sm muted">{keys.length} texts{keys.length > LIMIT ? ` · showing the first ${LIMIT}; narrow the search` : ''}</p>
      <div className="space-y-2">
        {shown.map((k) => {
          const o = over.get(k);
          return (
            <form key={k} action={saveTranslation} className={`card grid gap-2 p-3 lg:grid-cols-[14rem_1fr_1fr_auto] lg:items-start ${sp.key === k ? 'ring-2 ring-brand-500' : ''}`}>
              <input type="hidden" name="lang" value={lang} />
              <input type="hidden" name="key" value={k} />
              <input type="hidden" name="q" value={sp.q ?? ''} />
              <div>
                <p className="break-all font-mono text-xs font-semibold">{k}</p>
                {o !== undefined && <Badge tone="blue">overridden</Badge>}
              </div>
              <div className="text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide muted">Shipped ({lang})</p>
                <p className="whitespace-pre-line">{shipped[k]}</p>
                {lang !== 'uz' && <p className="mt-1 text-xs muted">uz: {reference[k]}</p>}
              </div>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide muted">Override</span>
                <textarea name="value" defaultValue={o ?? ''} placeholder={shipped[k]} rows={shipped[k].length > 90 ? 3 : 1} className="input min-h-[40px] rounded-xl px-3 py-2 text-sm" />
              </label>
              <button className="btn-secondary btn-sm self-end">Save</button>
            </form>
          );
        })}
      </div>
    </>
  );
}
