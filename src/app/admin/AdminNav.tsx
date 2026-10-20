'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const groups = [
  { title: 'Overview', items: [['/admin', '📊 Analytics']] },
  {
    title: 'Content',
    items: [
      ['/admin/questions', '❓ Questions'],
      ['/admin/import', '⬆️ Bulk import'],
      ['/admin/tickets', '🎟️ Tickets'],
      ['/admin/topics', '🧭 Topics'],
      ['/admin/categories', '🗂️ Categories'],
      ['/admin/exam', '⏱️ Exam templates'],
      ['/admin/library', '🚸 Signs & rules'],
      ['/admin/translations', '🌐 Translations'],
    ],
  },
  {
    title: 'Commerce',
    items: [
      ['/admin/users', '👥 Users'],
      ['/admin/payments', '💳 Payments'],
      ['/admin/plans', '🏷️ Plans'],
      ['/admin/promo', '🎫 Promo codes'],
      ['/admin/campaigns', '📣 Campaigns'],
    ],
  },
  { title: 'System', items: [['/admin/messages', '✉️ Message templates'], ['/admin/settings', '⚙️ Settings']] },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="mt-4 flex gap-4 overflow-x-auto pb-2 text-sm lg:block lg:space-y-5 lg:overflow-visible" aria-label="Admin">
      {groups.map((g) => (
        <div key={g.title} className="shrink-0">
          <p className="mb-1 hidden px-2 text-[11px] font-semibold uppercase tracking-wider muted lg:block">{g.title}</p>
          <ul className="flex gap-1 lg:block lg:space-y-0.5">
            {g.items.map(([href, label]) => {
              const active = href === '/admin' ? path === href : path.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`block whitespace-nowrap rounded-lg px-2 py-1.5 ${active ? 'bg-brand-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
