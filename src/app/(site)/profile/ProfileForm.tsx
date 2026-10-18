'use client';

import { useActionState } from 'react';
import { useT } from '@/i18n/client';
import type { MessageKey } from '@/i18n/translate';
import { updateProfile } from '@/app/actions';

type U = { name: string; email: string; categoryId: string; remindSms: boolean; remindEmail: boolean; remindPush: boolean; leaderboardOptIn: boolean };

export function ProfileForm({ user, categories }: { user: U; categories: { id: string; label: string }[] }) {
  const { t } = useT();
  const [state, action, pending] = useActionState(updateProfile, null);
  const toggles = [
    ['remindSms', t('profile.remindSms')],
    ['remindEmail', t('profile.remindEmail')],
    ['remindPush', t('profile.remindPush')],
    ['leaderboardOptIn', t('profile.leaderboardOptIn')],
  ] as const;
  return (
    <form action={action} className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="p-name" className="label">{t('auth.name')}</label>
          <input id="p-name" name="name" defaultValue={user.name} required maxLength={60} className="input" />
        </div>
        <div>
          <label htmlFor="p-email" className="label">{t('auth.email')}</label>
          <input id="p-email" name="email" type="email" defaultValue={user.email} className="input" />
        </div>
      </div>
      <div>
        <label htmlFor="p-cat" className="label">{t('auth.category')}</label>
        <select id="p-cat" name="categoryId" defaultValue={user.categoryId} className="input">
          {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="p-pass" className="label">{t('profile.setPassword')}</label>
        <input id="p-pass" name="password" type="password" minLength={8} autoComplete="new-password" className="input" />
      </div>
      <fieldset className="space-y-2">
        <legend className="label">{t('profile.reminders')}</legend>
        {toggles.map(([name, label]) => (
          <label key={name} className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 dark:bg-slate-800">
            <span className="text-sm">{label}</span>
            <input type="checkbox" name={name} defaultChecked={user[name]} className="h-5 w-5 accent-brand-600" />
          </label>
        ))}
      </fieldset>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-primary">{pending ? t('common.loading') : t('common.save')}</button>
        {state?.ok && <span role="status" className="text-sm text-mint-700">{t('common.saved')}</span>}
        {state?.error && <span role="alert" className="text-sm text-red-600">{t(state.error as MessageKey)}</span>}
      </div>
    </form>
  );
}
