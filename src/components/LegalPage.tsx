export function LegalPage({ title, body, draft }: { title: string; body: string; draft: string }) {
  return (
    <article className="container-app max-w-3xl py-10">
      <h1 className="text-3xl font-extrabold">{title}</h1>
      <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">{draft}</p>
      <div className="mt-6 space-y-4 leading-relaxed">
        {body.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
      </div>
    </article>
  );
}
