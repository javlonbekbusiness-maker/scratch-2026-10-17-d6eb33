export function LegalPage({ title, body, draft }: { title: string; body: string; draft: string }) {
  return (
    <article className="container-app max-w-3xl py-10">
      <h1 className="text-h1 sm:text-[28px]">{title}</h1>
      <p className="mt-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-ink">{draft}</p>
      <div className="card mt-6 space-y-4 p-5 leading-relaxed sm:p-8">
        {body.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
      </div>
    </article>
  );
}
