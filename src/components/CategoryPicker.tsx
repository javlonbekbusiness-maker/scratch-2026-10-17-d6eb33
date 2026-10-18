export type CategoryOption = { id: string; code: string; name: string; desc: string };

const ICON: Record<string, string> = { A: '🏍️', B: '🚗', C: '🚚', D: '🚌', BE: '🚙', CE: '🚛', DE: '🚍' };

export function CategoryPicker({ categories, defaultValue, name = 'categoryId' }: { categories: CategoryOption[]; defaultValue?: string; name?: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {categories.map((c) => (
        <label key={c.id} className="group relative cursor-pointer">
          <input type="radio" name={name} value={c.id} defaultChecked={c.id === defaultValue} className="peer sr-only" required />
          <div className="flex h-full flex-col rounded-2xl border-2 border-slate-200 p-3 transition peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 dark:border-slate-700 dark:peer-checked:bg-brand-950">
            <span className="text-2xl" aria-hidden>{ICON[c.code] ?? '🚘'}</span>
            <span className="mt-1 font-bold">{c.code}</span>
            <span className="text-xs leading-snug muted">{c.desc || c.name}</span>
          </div>
        </label>
      ))}
    </div>
  );
}
