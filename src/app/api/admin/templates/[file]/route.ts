import { getCurrentUser } from '@/lib/session';
import { toCsv } from '@/lib/csv';
import { PROMO_CSV_COLUMNS, QUESTION_CSV_COLUMNS, USER_CSV_COLUMNS } from '@/lib/importers';

const QUESTION_EXAMPLE = {
  external_id: 'B-001', category: 'B', ticket: '1', topic: 'signs',
  text_uz: '[PLACEHOLDER] Savol matni', text_cy: '', text_ru: '[PLACEHOLDER] Текст вопроса', image_url: '/placeholders/intersection.svg',
  answer1_uz: 'Javob 1', answer1_cy: '', answer1_ru: 'Ответ 1',
  answer2_uz: 'Javob 2', answer2_cy: '', answer2_ru: 'Ответ 2',
  answer3_uz: 'Javob 3', answer3_cy: '', answer3_ru: 'Ответ 3',
  correct: '2', explanation_uz: 'Izoh', explanation_cy: '', explanation_ru: 'Объяснение', rule_ref: '10.1', difficulty: '1',
};

const JSON_EXAMPLE = [
  {
    externalId: 'B-001', category: 'B', ticket: 1, topic: 'signs',
    text: { uz: '[PLACEHOLDER] Savol matni', cy: '', ru: '[PLACEHOLDER] Текст вопроса' },
    imageUrl: '/placeholders/intersection.svg',
    answers: [{ uz: 'Javob 1', cy: '', ru: 'Ответ 1' }, { uz: 'Javob 2', cy: '', ru: 'Ответ 2' }, { uz: 'Javob 3', cy: '', ru: 'Ответ 3' }],
    correct: 2,
    explanation: { uz: 'Izoh', cy: '', ru: 'Объяснение' },
    ruleRef: '10.1', difficulty: 1,
  },
];

export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const user = await getCurrentUser();
  if (user?.role !== 'ADMIN') return new Response('Not found', { status: 404 });
  const { file } = await params;
  const csv = (body: string, name: string) =>
    new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` } });

  switch (file) {
    case 'questions.csv':
      return csv(toCsv([QUESTION_EXAMPLE], QUESTION_CSV_COLUMNS), 'questions-template.csv');
    case 'questions.json':
      return new Response(JSON.stringify(JSON_EXAMPLE, null, 2), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="questions-template.json"' } });
    case 'promo.csv':
      return csv(
        toCsv([{ code: 'SCHOOL2026A', type: 'PERCENT', value: 20, starts_at: '2026-01-01', ends_at: '2026-12-31', usage_limit: 1, per_user_limit: 1, min_order_uzs: '', plan_slugs: 'month|3months', new_users_only: 'true', combinable: 'false', note: 'Avtomaktab №1' }], PROMO_CSV_COLUMNS),
        'promo-codes-template.csv',
      );
    case 'users.csv':
      return csv(toCsv([{ phone: '+998901234567', name: 'Ali', email: '', category: 'B', grant_days: 30 }], USER_CSV_COLUMNS), 'users-template.csv');
    default:
      return new Response('Not found', { status: 404 });
  }
}
