import { redirect } from 'next/navigation';
import { getT } from '@/i18n/server';
import { pick } from '@/i18n/config';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { getPlansView } from '@/lib/plans-view';
import { PhoneForm } from '@/components/PhoneForm';
import { PlanCard } from '@/components/PlanCard';
import { PreviewQuestion, type PreviewData } from '@/components/PreviewQuestion';
import { ProgressRing } from '@/components/ProgressRing';
import { IconTile } from '@/components/ui/Cards';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ButtonLink } from '@/components/ui/Primitives';

export default async function Landing() {
  const user = await getCurrentUser();
  if (user) redirect(user.onboarded ? '/dashboard' : '/onboarding');
  const { t, locale } = await getT();

  const [plans, sample, questionCount, topicCount, ticketCount] = await Promise.all([
    getPlansView(null, locale).catch(() => []),
    db.question
      .findFirst({ where: { isActive: true, imageUrl: { not: null } }, orderBy: { sortOrder: 'asc' }, include: { answers: { orderBy: { sortOrder: 'asc' } } } })
      .catch(() => null),
    db.question.count({ where: { isActive: true } }).catch(() => 0),
    db.topic.count({ where: { questions: { some: { isActive: true } } } }).catch(() => 0),
    db.ticket.count().catch(() => 0),
  ]);

  const preview: PreviewData | null = sample && {
    text: pick(sample, 'text', locale),
    imageUrl: sample.imageUrl,
    answers: sample.answers.map((a) => ({ id: a.id, text: pick(a, 'text', locale) })),
    correctId: sample.answers.find((a) => a.isCorrect)?.id ?? '',
    explanation: pick(sample, 'explanation', locale),
    ruleRef: sample.ruleRef,
  };

  const benefits: [IconName, string, string, 'brand' | 'accent' | 'warning' | 'violet'][] = [
    ['timer', t('landing.b1Title'), t('landing.b1Text'), 'violet'],
    ['book', t('landing.b2Title'), t('landing.b2Text'), 'brand'],
    ['sparkles', t('landing.b3Title'), t('landing.b3Text'), 'accent'],
    ['globe', t('landing.b4Title'), t('landing.b4Text'), 'warning'],
  ];
  const steps = [
    [t('landing.how1Title'), t('landing.how1Text')],
    [t('landing.how2Title'), t('landing.how2Text')],
    [t('landing.how3Title'), t('landing.how3Text')],
  ];
  const faqs = [1, 2, 3, 4, 5].map((i) => [t(`landing.faq${i}q` as 'landing.faq1q'), t(`landing.faq${i}a` as 'landing.faq1a')]);
  // Real numbers from the database only.
  const stats = [
    [questionCount, t('landing.statQuestions')],
    [topicCount, t('landing.statTopics')],
    [ticketCount, t('landing.statTickets')],
  ] as const;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgb(31_91_235/0.25),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgb(58_204_149/0.12),transparent_50%)]" aria-hidden />
        <div className="container-app relative grid items-center gap-10 py-10 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <span className="chip border border-success/30 bg-success/10 px-3 py-1.5 text-accent-fg"><Icon name="shield" size={14} /> {t('landing.heroBadge')}</span>
            <h1 className="mt-4 text-[34px] font-extrabold leading-[1.1] tracking-tight sm:text-5xl">{t('landing.heroTitle')}</h1>
            <p className="mt-4 max-w-xl text-lg text-muted">{t('landing.heroSubtitle')}</p>
            <div className="mt-7 max-w-xl">
              <PhoneForm compact />
              <p className="-mt-2 flex items-center gap-2 text-sm font-medium text-accent-fg"><Icon name="gift" size={16} /> {t('landing.heroNote')}</p>
            </div>
            <dl className="mt-8 flex max-w-xl divide-x divide-line">
              {stats.map(([n, label]) => (
                <div key={label} className="px-4 first:pl-0">
                  <dt className="sr-only">{label}</dt>
                  <dd className="num text-h1">{n}</dd>
                  <dd className="text-small text-muted">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
          <HeroPreview label={t('landing.previewCard')} readiness={t('dashboard.readiness')} tiles={[t('home.tickets'), t('home.topics'), t('home.exam'), t('home.mistakes')]} />
        </div>
      </section>

      {/* Benefits */}
      <section className="container-app py-12" aria-labelledby="benefits">
        <h2 id="benefits" className="h-section text-center">{t('landing.benefitsTitle')}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map(([icon, title, text, tone]) => (
            <div key={title} className="card p-5">
              <IconTile icon={icon} tone={tone} />
              <h3 className="mt-4 text-title">{title}</h3>
              <p className="mt-1 text-small text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works + try a question */}
      <section id="how" className="scroll-mt-20 border-y border-line bg-surface/50 py-12" aria-labelledby="how-h">
        <div className="container-app grid gap-10 lg:grid-cols-2">
          <div>
            <h2 id="how-h" className="h-section">{t('landing.howTitle')}</h2>
            <ol className="mt-8 space-y-4">
              {steps.map(([title, text], i) => (
                <li key={title} className="card flex gap-4 p-4">
                  <span className="num grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-600 text-lg font-bold text-white">{i + 1}</span>
                  <div>
                    <h3 className="text-title">{title}</h3>
                    <p className="text-small text-muted">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          {preview && (
            <div>
              <h2 className="h-section">{t('landing.previewTitle')}</h2>
              <p className="mb-4 mt-1 text-muted">{t('landing.previewHint')}</p>
              <PreviewQuestion q={preview} />
            </div>
          )}
        </div>
      </section>

      {/* Pricing */}
      {plans.length > 0 && (
        <section className="container-app py-12" aria-labelledby="pricing-h">
          <h2 id="pricing-h" className="h-section text-center">{t('landing.pricingTitle')}</h2>
          <p className="mt-2 text-center text-muted">{t('pricing.subtitle')}</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => (
              <PlanCard key={p.id} plan={p} t={t} href="/login?next=/pricing" />
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section id="faq" className="container-app max-w-3xl scroll-mt-20 py-12" aria-labelledby="faq-h">
        <h2 id="faq-h" className="h-section text-center">{t('landing.faqTitle')}</h2>
        <div className="mt-8 space-y-3">
          {faqs.map(([q, a]) => (
            <details key={q} className="card group p-0 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 font-semibold">
                {q}
                <Icon name="chevronRight" size={20} className="text-muted transition group-open:rotate-90" />
              </summary>
              <p className="px-5 pb-5 text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="container-app pb-6">
        <div className="relative overflow-hidden rounded-card bg-gradient-to-br from-brand-700 via-brand-600 to-[#2a7be6] p-8 text-white sm:p-12">
          <svg className="pointer-events-none absolute -bottom-10 -right-10 h-56 w-56 opacity-20" viewBox="0 0 200 200" aria-hidden>
            <path d="M20 200 C 70 120, 120 90, 200 60" stroke="white" strokeWidth="28" fill="none" strokeLinecap="round" />
            <path d="M20 200 C 70 120, 120 90, 200 60" stroke="#0e1730" strokeWidth="3" strokeDasharray="12 12" fill="none" />
          </svg>
          <h2 className="relative text-h1 sm:text-[28px]">{t('landing.ctaTitle')}</h2>
          <p className="relative mt-2 text-white/85">{t('landing.ctaText')}</p>
          <ButtonLink href="/login" variant="secondary" icon="play" className="relative mt-6 border-transparent bg-white text-brand-700 hover:bg-white/90">{t('landing.heroCta')}</ButtonLink>
        </div>
      </section>
    </>
  );
}

/** Our own product preview: a readiness card and the main actions, drawn with the app's components. Decorative. */
function HeroPreview({ label, readiness, tiles }: { label: string; readiness: string; tiles: string[] }) {
  const icons: [IconName, 'brand' | 'accent' | 'violet' | 'danger'][] = [['ticket', 'brand'], ['layers', 'accent'], ['timer', 'violet'], ['mistakes', 'danger']];
  return (
    <div className="relative mx-auto hidden w-full max-w-sm lg:block" role="img" aria-label={label}>
      <div className="absolute -inset-6 rounded-[40px] bg-brand-600/10 blur-2xl" aria-hidden />
      <div className="relative space-y-3 rounded-[32px] border border-line bg-canvas/80 p-4 shadow-raised" aria-hidden>
        <div className="flex items-center gap-4 rounded-card bg-gradient-to-br from-brand-700 via-brand-600 to-[#2a7be6] p-4 text-white">
          <div className="rounded-full bg-white/10 p-1"><ProgressRing value={86} size={84} stroke={8} onBrand /></div>
          <div>
            <p className="font-bold">{readiness}</p>
            <div className="mt-2 h-2 w-32 overflow-hidden rounded-full bg-white/20"><div className="h-full w-3/4 rounded-full bg-accent" /></div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((title, i) => (
            <div key={title} className="card flex min-h-[104px] flex-col justify-between p-3">
              <IconTile icon={icons[i][0]} tone={icons[i][1]} size="sm" />
              <span className="text-sm font-semibold leading-tight">{title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
