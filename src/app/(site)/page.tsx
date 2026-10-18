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

export default async function Landing() {
  const user = await getCurrentUser();
  if (user) redirect(user.onboarded ? '/dashboard' : '/onboarding');
  const { t, locale } = await getT();

  const [plans, sample] = await Promise.all([
    getPlansView(null, locale).catch(() => []),
    db.question
      .findFirst({ where: { isActive: true, imageUrl: { not: null } }, orderBy: { sortOrder: 'asc' }, include: { answers: { orderBy: { sortOrder: 'asc' } } } })
      .catch(() => null),
  ]);

  const preview: PreviewData | null = sample && {
    text: pick(sample, 'text', locale),
    imageUrl: sample.imageUrl,
    answers: sample.answers.map((a) => ({ id: a.id, text: pick(a, 'text', locale) })),
    correctId: sample.answers.find((a) => a.isCorrect)?.id ?? '',
    explanation: pick(sample, 'explanation', locale),
    ruleRef: sample.ruleRef,
  };

  const benefits = [
    ['⏱️', t('landing.b1Title'), t('landing.b1Text')],
    ['💡', t('landing.b2Title'), t('landing.b2Text')],
    ['🧠', t('landing.b3Title'), t('landing.b3Text')],
    ['🌐', t('landing.b4Title'), t('landing.b4Text')],
  ];
  const steps = [
    [t('landing.how1Title'), t('landing.how1Text')],
    [t('landing.how2Title'), t('landing.how2Text')],
    [t('landing.how3Title'), t('landing.how3Text')],
  ];
  const faqs = [1, 2, 3, 4, 5].map((i) => [t(`landing.faq${i}q` as 'landing.faq1q'), t(`landing.faq${i}a` as 'landing.faq1a')]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-slate-50 dark:from-brand-950/60 dark:to-slate-950">
        <div className="container-app grid items-center gap-10 py-12 sm:py-20 lg:grid-cols-[1.15fr_1fr]">
          <div className="animate-fade-up">
            <span className="chip bg-mint-500/15 text-mint-700 dark:text-mint-300">✓ {t('landing.heroBadge')}</span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">{t('landing.heroTitle')}</h1>
            <p className="mt-4 max-w-xl text-lg muted">{t('landing.heroSubtitle')}</p>
            <div className="mt-8 max-w-xl">
              <PhoneForm compact />
              <p className="-mt-2 text-sm font-medium text-mint-700 dark:text-mint-400">🎁 {t('landing.heroNote')}</p>
            </div>
          </div>
          <div className="relative mx-auto hidden w-full max-w-sm lg:block" aria-hidden>
            <div className="card rotate-2 p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{t('dashboard.readiness')}</span>
                <span className="chip bg-mint-500/15 text-mint-700">🔥 7</span>
              </div>
              <div className="mt-4 grid place-items-center">
                <ProgressRing value={86} size={170} tone="mint" sub={t('dashboard.readiness')} />
              </div>
              <div className="mt-5 space-y-2">
                {[92, 78, 64].map((v, i) => (
                  <div key={i} className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${v}%` }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="container-app py-14" aria-labelledby="benefits">
        <h2 id="benefits" className="h-section text-center">{t('landing.benefitsTitle')}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map(([icon, title, text]) => (
            <div key={title} className="card p-5">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-2xl dark:bg-brand-950" aria-hidden>{icon}</div>
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-1 text-sm muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works + preview */}
      <section id="how" className="bg-white py-14 dark:bg-slate-900/50" aria-labelledby="how-h">
        <div className="container-app grid gap-10 lg:grid-cols-2">
          <div>
            <h2 id="how-h" className="h-section">{t('landing.howTitle')}</h2>
            <ol className="mt-8 space-y-6">
              {steps.map(([title, text], i) => (
                <li key={title} className="flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-mint-500 text-lg font-bold text-white">{i + 1}</span>
                  <div>
                    <h3 className="font-bold">{title}</h3>
                    <p className="muted">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          {preview && (
            <div>
              <h2 className="h-section">{t('landing.previewTitle')}</h2>
              <p className="mb-4 mt-1 muted">{t('landing.previewHint')}</p>
              <PreviewQuestion q={preview} />
            </div>
          )}
        </div>
      </section>

      {/* Pricing */}
      {plans.length > 0 && (
        <section className="container-app py-14" aria-labelledby="pricing-h">
          <h2 id="pricing-h" className="h-section text-center">{t('landing.pricingTitle')}</h2>
          <p className="mt-2 text-center muted">{t('pricing.subtitle')}</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => (
              <PlanCard key={p.id} plan={p} t={t} href="/login?next=/pricing" />
            ))}
          </div>
        </section>
      )}

      {/* Testimonials placeholder */}
      <section className="bg-white py-14 dark:bg-slate-900/50" aria-labelledby="tst-h">
        <div className="container-app">
          <h2 id="tst-h" className="h-section text-center">{t('landing.testimonialsTitle')}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <figure key={i} className="card border-dashed p-5">
                <div className="text-cta-500" aria-hidden>★★★★★</div>
                <blockquote className="mt-2 text-sm muted">{t('landing.testimonialsPlaceholder')}</blockquote>
                <figcaption className="mt-4 flex items-center gap-3">
                  <span className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700" />
                  <span className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container-app max-w-3xl py-14" aria-labelledby="faq-h">
        <h2 id="faq-h" className="h-section text-center">{t('landing.faqTitle')}</h2>
        <div className="mt-8 space-y-3">
          {faqs.map(([q, a]) => (
            <details key={q} className="card group p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {q}
                <span className="text-xl transition group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-3 muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="container-app pb-6">
        <div className="rounded-3xl bg-gradient-to-br from-brand-600 to-mint-600 p-8 text-white sm:p-12">
          <h2 className="text-3xl font-extrabold">{t('landing.ctaTitle')}</h2>
          <p className="mt-2 text-white/85">{t('landing.ctaText')}</p>
          <a href="/login" className="btn mt-6 bg-white text-brand-700 hover:bg-brand-50">{t('landing.heroCta')} →</a>
        </div>
      </section>
    </>
  );
}
