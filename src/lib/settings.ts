import { cache } from 'react';
import { db } from './db';

export const DEFAULT_SETTINGS = {
  referralFriendPct: 10,
  referralRewardDays: 7,
  supportPhone: '+998 71 200 00 00',
  supportEmail: 'support@example.uz',
  telegram: '@yhqtest_support',
  /** Free users can try this many questions of every topic (0 = topics are subscriber-only). */
  freeTopicQuestions: 3,
};
export type Settings = typeof DEFAULT_SETTINGS;

export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await db.setting.findMany().catch(() => []);
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out as Settings;
});
