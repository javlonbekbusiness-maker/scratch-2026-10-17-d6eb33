import { Icon } from './ui/Icon';

export type CategoryOption = { id: string; code: string; name: string; desc: string };

/** Licence category radio cards (real radio inputs, so keyboard and forms work as usual). */
export function CategoryPicker({ categories, defaultValue, name = 'categoryId' }: { categories: CategoryOption[]; defaultValue?: string; name?: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {categories.map((c) => (
        <label key={c.id} className="group relative cursor-pointer">
          <input type="radio" name={name} value={c.id} defaultChecked={c.id === defaultValue} className="peer sr-only" required />
          <div className="flex h-full min-h-[96px] flex-col rounded-tile border-2 border-line bg-raised p-3 transition peer-checked:border-brand-500 peer-checked:bg-brand-600/10 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500">
            <span className="flex items-center justify-between">
              <span className="text-h2">{c.code}</span>
              <Icon name="car" size={22} className="text-muted" />
            </span>
            <span className="mt-1 text-xs leading-snug text-muted">{c.desc || c.name}</span>
          </div>
          <span className="absolute right-2 top-2 hidden h-6 w-6 place-items-center rounded-full bg-brand-600 text-white peer-checked:grid" aria-hidden>
            <Icon name="check" size={14} />
          </span>
        </label>
      ))}
    </div>
  );
}
