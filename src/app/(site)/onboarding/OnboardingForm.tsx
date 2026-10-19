'use client';

import { useActionState } from 'react';
import { useT } from '@/i18n/client';
import type { MessageKey } from '@/i18n/translate';
import { completeOnboarding } from './actions';
import { CategoryPicker, type CategoryOption } from '@/components/CategoryPicker';

export function OnboardingForm({ defaults, categories }: { defaults: { name: string; email: string; categoryId: string }; categories: CategoryOption[] }) {
  const { t } = useT();
  const [state, action, pending] = useActionState(completeOnboarding, null);
  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="name" className="label">{t('auth.name')}</label>
        <input id="name" name="name" required maxLength={60} defaultValue={defaults.name} autoComplete="given-name" className="input" />
      </div>
      <div>
        <label htmlFor="email" className="label">
          {t('auth.email')} <span className="font-normal muted">({t('common.optional')})</span>
        </label>
        <input id="email" name="email" type="email" defaultValue={defaults.email} autoComplete="email" className="input" aria-describedby="email-hint" />
        <p id="email-hint" className="mt-1 text-xs muted">{t('auth.emailHint')}</p>
      </div>
      <fieldset>
        <legend className="label">{t('auth.category')}</legend>
        <CategoryPicker categories={categories} defaultValue={defaults.categoryId} />
      </fieldset>
      {state?.error && <p role="alert" className="text-sm font-medium text-danger">{t(state.error as MessageKey)}</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? t('common.loading') : t('auth.finishSignup')}</button>
    </form>
  );
}
