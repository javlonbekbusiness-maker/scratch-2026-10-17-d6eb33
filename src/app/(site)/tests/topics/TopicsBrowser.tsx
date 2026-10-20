'use client';

import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useT } from '@/i18n/client';
import { normalizeSearch } from '@/lib/search-normalize';
import { IconTile, toTone, type Tone } from '@/components/ui/Cards';
import { Icon, isIconName } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/Primitives';

export type BrowserGroup = { id: string; name: string; tone: string };
export type BrowserTopic = {
  id: string;
  slug: string;
  name: string;
  /** Both languages, folded, so a search in either finds the topic. */
  search: string;
  icon: string;
  groupId: string | null;
  sortOrder: number;
  createdAt: string;
  total: number;
  answered: number;
  accuracy: number | null;
  status: 'new' | 'progress' | 'weak' | 'done';
};

const FILTERS = ['all', 'new', 'progress', 'weak', 'done'] as const;
const SORTS = ['order', 'weak', 'new'] as const;
type Filter = (typeof FILTERS)[number];
type Sort = (typeof SORTS)[number];

/** Topics grouped under collapsible headings, with search, status filter and sort. All on the client: ~40 items. */
export function TopicsBrowser({ groups, topics, freeQuestions }: { groups: BrowserGroup[]; topics: BrowserTopic[]; freeQuestions: number | null }) {
  const { t } = useT();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('order');
  const [closed, setClosed] = useState<Set<string>>(new Set());

  // Debounced search (typing stays smooth; the list updates after a short pause).
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(id);
  }, [query]);
  const q = useDeferredValue(normalizeSearch(debounced));

  const visible = useMemo(() => {
    const words = q ? q.split(' ') : [];
    const list = topics.filter((tp) => (filter === 'all' || tp.status === filter) && words.every((w) => tp.search.includes(w)));
    const cmp: Record<Sort, (a: BrowserTopic, b: BrowserTopic) => number> = {
      order: (a, b) => a.sortOrder - b.sortOrder,
      // Started topics by accuracy (lowest first), then not-started ones in their usual order.
      weak: (a, b) => (a.accuracy ?? 101) - (b.accuracy ?? 101) || a.sortOrder - b.sortOrder,
      new: (a, b) => b.createdAt.localeCompare(a.createdAt) || a.sortOrder - b.sortOrder,
    };
    return list.sort(cmp[sort]);
  }, [topics, q, filter, sort]);

  const sections = useMemo(() => {
    const byGroup = new Map<string, BrowserTopic[]>();
    for (const tp of visible) byGroup.set(tp.groupId ?? '', [...(byGroup.get(tp.groupId ?? '') ?? []), tp]);
    const known = groups.map((g) => ({ ...g, items: byGroup.get(g.id) ?? [] }));
    const rest = byGroup.get('') ?? [];
    return [...known, ...(rest.length ? [{ id: '', name: t('topicsPage.title'), tone: 'brand', items: rest }] : [])].filter((s) => s.items.length);
  }, [visible, groups, t]);

  const filtering = q !== '' || filter !== 'all';
  const toggle = (id: string) => setClosed((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <div className="space-y-4">
      {/* Sticky under the app header: back, title and search stay in reach while scrolling. */}
      <div className="sticky top-[65px] z-20 -mx-4 space-y-3 border-b border-line/70 bg-canvas/95 px-4 pb-3 pt-2 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-2">
          <Link href="/tests" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-muted hover:bg-raised hover:text-ink" aria-label={t('common.back')}>
            <Icon name="chevronLeft" />
          </Link>
          <h1 className="text-h1">{t('topicsPage.title')}</h1>
        </div>
        <div role="search" className="relative">
          <label htmlFor="topic-search" className="sr-only">{t('topicsPage.search')}</label>
          <Icon name="search" size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="topic-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('topicsPage.search')}
            autoComplete="off"
            maxLength={80}
            className="input h-12 w-full pl-12"
            aria-describedby="topic-count"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('topicsPage.filterLabel')}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`inline-flex min-h-[48px] items-center rounded-full border px-4 text-sm font-semibold transition ${filter === f ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface text-ink hover:border-brand-500/50'}`}
          >
            {t(`topicsPage.f_${f}`)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id="topic-count" className="text-small text-muted" aria-live="polite">{t('topicsPage.found', { n: visible.length })}</p>
        <label className="flex items-center gap-2 text-small text-muted">
          {t('topicsPage.sortLabel')}
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input h-12 w-auto min-w-0 py-0 pr-8 text-sm text-ink">
            {SORTS.map((s) => <option key={s} value={s}>{t(`topicsPage.s_${s}`)}</option>)}
          </select>
        </label>
      </div>

      {sections.length === 0 ? (
        <div className="card"><EmptyState icon="search" title={q ? t('lists.noResults') : t('topicsPage.none')} /></div>
      ) : (
        sections.map((s) => {
          const open = filtering || !closed.has(s.id);
          const tone = toTone(s.tone);
          return (
            <section key={s.id || 'other'} aria-labelledby={`g-${s.id}`} className="[content-visibility:auto] [contain-intrinsic-size:auto_480px]">
              <h2 id={`g-${s.id}`}>
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  aria-expanded={open}
                  aria-controls={`gl-${s.id}`}
                  disabled={filtering}
                  className="flex min-h-[48px] w-full items-center gap-2 rounded-xl text-left text-h2 text-ink disabled:cursor-default"
                >
                  <span className={`h-3 w-3 shrink-0 rounded-full ${DOT[tone]}`} aria-hidden />
                  <span className="min-w-0 flex-1">{s.name}</span>
                  <span className="text-small font-normal text-muted">{t('topicsPage.groupCount', { n: s.items.length })}</span>
                  {!filtering && <Icon name="chevronRight" size={20} className={`text-muted transition ${open ? 'rotate-90' : ''}`} />}
                </button>
              </h2>
              {open && (
                <ul id={`gl-${s.id}`} className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {s.items.map((tp) => <TopicCard key={tp.id} tp={tp} tone={tone} freeQuestions={freeQuestions} />)}
                </ul>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

const DOT: Record<Tone, string> = {
  brand: 'bg-brand-600', accent: 'bg-accent', warning: 'bg-warning', danger: 'bg-danger', violet: 'bg-violet-500', sky: 'bg-sky-500', slate: 'bg-slate-500',
};

function TopicCard({ tp, tone, freeQuestions }: { tp: BrowserTopic; tone: Tone; freeQuestions: number | null }) {
  const { t } = useT();
  const locked = freeQuestions !== null;
  const pct = tp.total ? Math.round((100 * tp.answered) / tp.total) : 0;
  const accTone = tp.accuracy === null ? 'text-muted' : tp.accuracy >= 85 ? 'text-accent-fg' : tp.accuracy >= 70 ? 'text-ink' : 'text-warning';
  return (
    <li>
      <Link
        href={`/tests/topics/${tp.slug}`}
        className="card group flex h-full flex-col gap-3 p-4 outline-none transition pressable hover:border-brand-500/40 focus-visible:ring-2 focus-visible:ring-brand-500"
        data-topic={tp.slug}
      >
        <span className="flex items-start gap-3">
          <IconTile icon={isIconName(tp.icon) ? tp.icon : 'book'} tone={tone} />
          <span className="min-w-0 flex-1">
            <span className="block text-title leading-snug text-ink [hyphens:auto] [overflow-wrap:anywhere]">{tp.name}</span>
            <span className="mt-0.5 block text-small text-muted">{t('modes.qCount', { n: tp.total })}</span>
          </span>
        </span>
        {locked && (
          <span className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-raised px-2 py-0.5 text-micro font-semibold text-muted">
              <Icon name="lock" size={12} /> {t('common.locked')}
            </span>
            {freeQuestions > 0 && (
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-micro font-semibold text-accent-fg" data-free-label>{t('topicsPage.free', { n: Math.min(freeQuestions, tp.total) })}</span>
            )}
          </span>
        )}
        <span className="mt-auto block">
          <span className="block h-2 overflow-hidden rounded-full bg-raised" role="progressbar" aria-label={t('topicsPage.solved', { n: tp.answered, total: tp.total })} aria-valuemin={0} aria-valuemax={tp.total} aria-valuenow={tp.answered}>
            <span className="block h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
          </span>
          <span className="mt-2 flex flex-wrap justify-between gap-x-3 text-small">
            <span className="num text-muted">{t('topicsPage.solved', { n: tp.answered, total: tp.total })}</span>
            <span className={`num font-semibold ${accTone}`}>{tp.accuracy === null ? t('topicsPage.noAccuracy') : t('topicsPage.accuracy', { p: tp.accuracy })}</span>
          </span>
        </span>
      </Link>
    </li>
  );
}
