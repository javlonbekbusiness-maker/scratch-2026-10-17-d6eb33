import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getT } from '@/i18n/server';
import { pick } from '@/i18n/config';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t('library.title'), description: `${t('library.signs')} · ${t('library.rules')}` };
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string }> }) {
  const sp = await searchParams;
  const { t, locale } = await getT();
  const q = (sp.q ?? '').trim().slice(0, 80);
  const tab = sp.tab === 'rules' ? 'rules' : 'signs';
  const contains = { contains: q, mode: 'insensitive' as const };

  const [signs, rules] = await Promise.all([
    db.roadSign.findMany({
      where: q ? { OR: [{ code: contains }, { nameUz: contains }, { nameRu: contains }, { descUz: contains }, { descRu: contains }] } : {},
      orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }],
    }),
    db.ruleArticle.findMany({
      where: q ? { OR: [{ number: contains }, { titleUz: contains }, { titleRu: contains }, { bodyUz: contains }, { bodyRu: contains }] } : {},
      orderBy: { number: 'asc' },
    }),
  ]);
  const groups = [...new Set(signs.map((s) => s.group))];
  const tabHref = (k: string) => `/library?tab=${k}${q ? `&q=${encodeURIComponent(q)}` : ''}`;

  return (
    <div className="container-app py-8">
      <h1 className="text-3xl font-extrabold">{t('library.title')}</h1>
      <form className="mt-5" role="search">
        <input type="hidden" name="tab" value={tab} />
        <label htmlFor="q" className="sr-only">{t('common.search')}</label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder={t('library.searchPlaceholder')} className="input h-14 text-lg" />
      </form>
      <div className="mt-5 flex gap-2" role="tablist">
        {(['signs', 'rules'] as const).map((k) => (
          <Link key={k} href={tabHref(k)} role="tab" aria-selected={tab === k} className={`btn btn-sm ${tab === k ? 'bg-brand-600 text-white' : 'btn-secondary'}`}>
            {t(`library.${k}`)} <span className="opacity-70">({k === 'signs' ? signs.length : rules.length})</span>
          </Link>
        ))}
      </div>

      {tab === 'signs' ? (
        signs.length === 0 ? (
          <p className="mt-8 muted">{t('library.empty')}</p>
        ) : (
          groups.map((g) => (
            <section key={g} className="mt-8">
              <h2 className="text-lg font-bold">{g}</h2>
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {signs.filter((s) => s.group === g).map((s) => (
                  <li key={s.id} className="card flex flex-col items-center p-4 text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.imageUrl} alt={pick(s, 'name', locale)} width={96} height={96} loading="lazy" className="h-24 w-24 object-contain" />
                    <span className="mt-2 text-xs font-bold text-brand-600">{s.code}</span>
                    <span className="text-sm font-semibold">{pick(s, 'name', locale)}</span>
                    <span className="mt-1 text-xs muted">{pick(s, 'desc', locale)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )
      ) : rules.length === 0 ? (
        <p className="mt-8 muted">{t('library.empty')}</p>
      ) : (
        <div className="mt-6 space-y-3">
          {rules.map((r) => (
            <details key={r.id} id={`rule-${r.number}`} className="card group p-5" open={!!q}>
              <summary className="flex cursor-pointer list-none items-center gap-3 font-semibold">
                <span className="chip bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">{r.number}</span>
                <span className="flex-1">{pick(r, 'title', locale)}</span>
                <span className="transition group-open:rotate-90" aria-hidden>›</span>
              </summary>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{pick(r, 'body', locale)}</p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
