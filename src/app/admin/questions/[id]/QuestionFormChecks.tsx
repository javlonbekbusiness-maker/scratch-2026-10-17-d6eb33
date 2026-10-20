'use client';

import { useEffect, useRef, useState } from 'react';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Checks the question form in the browser before it is sent, so simple mistakes don't cost
 * the admin a round trip (the server repeats the same checks). Renders the error banner.
 */
export function QuestionFormChecks() {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    const onSubmit = (e: SubmitEvent) => {
      const val = (name: string) => ((form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '').trim();
      const problems: string[] = [];
      const filled = [0, 1, 2, 3, 4].filter((i) => val(`a${i}_uz`) || val(`a${i}_ru`));
      if (filled.length < 2 || filled.length > 5) problems.push('Fill in 2 to 5 answers.');
      if (filled.some((i) => !val(`a${i}_uz`) || !val(`a${i}_ru`))) problems.push('Every answer needs Uzbek and Russian text.');
      const correct = (form.querySelector('input[name=correct]:checked') as HTMLInputElement | null)?.value;
      if (correct === undefined || !filled.includes(Number(correct))) problems.push('Select the correct answer (it must be one of the filled rows).');
      const file = (form.elements.namedItem('image') as HTMLInputElement | null)?.files?.[0];
      if (file) {
        if (!IMAGE_TYPES.includes(file.type)) problems.push(`“${file.name}” is not a PNG, JPEG or WebP image.`);
        else if (file.size > MAX_BYTES) problems.push(`“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 2 MB.`);
      }
      if (problems.length) {
        e.preventDefault();
        setError(problems.join(' '));
        ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } else setError(null);
    };
    form.addEventListener('submit', onSubmit);
    return () => form.removeEventListener('submit', onSubmit);
  }, []);

  return (
    <div ref={ref} aria-live="polite">
      {error && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}
