import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getT } from '@/i18n/server';
import { pick } from '@/i18n/config';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/Primitives';

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
    <div className="container-app max-w-[1120px] py-6 lg:py-8">
      <h1 className="text-h1">{t('library.title')}</h1>
      <form className="relative mt-4" role="search">
        <input type="hidden" name="tab" value={tab} />
        <label htmlFor="q" className="sr-only">{t('common.search')}</label>
        <Icon name="search" size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input id="q" name="q" type="search" defaultValue={q} placeholder={t('library.searchPlaceholder')} className="input h-14 pl-12 text-lg" />
      </form>
      <div className="mt-4 inline-flex rounded-2xl border border-line bg-surface p-1" role="tablist">
        {(['signs', 'rules'] as const).map((k) => (
          <Link
            key={k}
            href={tabHref(k)}
            role="tab"
            aria-selected={tab === k}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition ${tab === k ? 'bg-brand-600 text-white' : 'text-muted hover:text-ink'}`}
          >
            {t(`library.${k}`)} <span className="num">({k === 'signs' ? signs.length : rules.length})</span>
          </Link>
        ))}
      </div>

      {tab === 'signs' ? (
        signs.length === 0 ? (
          <div className="card mt-6"><EmptyState icon="search" title={t('library.empty')} /></div>
        ) : (
          groups.map((g) => (
            <section key={g} className="mt-8">
              <h2 className="text-h2">{g}</h2>
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {signs.filter((s) => s.group === g).map((s) => (
                  <li key={s.id} className="card flex flex-col items-center p-4 text-center">
                    <span className="grid h-28 w-28 place-items-center rounded-2xl bg-white p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.imageUrl} alt={pick(s, 'name', locale)} width={96} height={96} loading="lazy" decoding="async" className="h-24 w-24 object-contain" />
                    </span>
                    <span className="num mt-3 rounded-full bg-brand-600/10 px-2 py-0.5 text-xs font-bold text-brand-fg">{s.code}</span>
                    <span className="mt-1 text-sm font-semibold">{pick(s, 'name', locale)}</span>
                    <span className="mt-1 text-xs text-muted">{pick(s, 'desc', locale)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )
      ) : rules.length === 0 ? (
        <div className="card mt-6"><EmptyState icon="search" title={t('library.empty')} /></div>
      ) : (
        <div className="mt-6 space-y-3">
          {rules.map((r) => (
            <details key={r.id} id={`rule-${r.number}`} className="card group p-0" open={!!q}>
              <summary className="flex min-h-[60px] cursor-pointer list-none items-center gap-3 px-5 py-3 font-semibold [&::-webkit-details-marker]:hidden">
                <span className="num chip bg-brand-600/10 text-brand-fg">{r.number}</span>
                <span className="flex-1">{pick(r, 'title', locale)}</span>
                <Icon name="chevronRight" size={20} className="text-muted transition group-open:rotate-90" />
              </summary>
              <p className="whitespace-pre-line px-5 pb-5 text-sm leading-relaxed">{pick(r, 'body', locale)}</p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
