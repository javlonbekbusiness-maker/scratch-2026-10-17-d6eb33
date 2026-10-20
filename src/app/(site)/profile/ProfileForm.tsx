'use client';

import { useActionState } from 'react';
import { useT } from '@/i18n/client';
import type { MessageKey } from '@/i18n/translate';
import { updateProfile } from '@/app/actions';
import { Field, Switch } from '@/components/ui/Primitives';
import { Icon } from '@/components/ui/Icon';

type U = { name: string; email: string; remindSms: boolean; remindEmail: boolean; remindPush: boolean; leaderboardOptIn: boolean };

/** Personal details, optional password and reminders. */
export function ProfileForm({ user }: { user: U }) {
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
        <Field label={t('auth.name')} htmlFor="p-name">
          <input id="p-name" name="name" defaultValue={user.name} required maxLength={60} autoComplete="name" className="input" />
        </Field>
        <Field label={t('auth.email')} htmlFor="p-email">
          <input id="p-email" name="email" type="email" defaultValue={user.email} autoComplete="email" className="input" />
        </Field>
      </div>
      <Field label={t('profile.setPassword')} htmlFor="p-pass" hint={t('auth.passwordShort')}>
        <input id="p-pass" name="password" type="password" minLength={8} autoComplete="new-password" className="input" />
      </Field>
      <fieldset className="space-y-2">
        <legend className="label">{t('profile.reminders')}</legend>
        {toggles.map(([name, label]) => (
          <Switch key={name} name={name} label={label} defaultChecked={user[name]} />
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-primary">{pending ? t('common.loading') : t('common.save')}</button>
        {state?.ok && <span role="status" className="flex items-center gap-1 text-sm font-medium text-accent-fg"><Icon name="check" size={16} /> {t('common.saved')}</span>}
        {state?.error && <span role="alert" className="text-sm font-medium text-danger">{t(state.error as MessageKey)}</span>}
      </div>
    </form>
  );
}
