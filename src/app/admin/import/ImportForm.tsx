'use client';

import { useActionState } from 'react';
import { importCommit, importPreview, type ImportPreview } from '../actions';

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportPreview, FormData>(importPreview, null);
  return (
    <>
      <form action={action} className="card grid gap-3 p-5 sm:grid-cols-[180px_1fr_auto] sm:items-end">
        <label className="block">
          <span className="label">Type</span>
          <select name="kind" defaultValue={state?.kind ?? 'questions'} className="input min-h-[40px] text-sm">
            <option value="questions">Questions</option>
            <option value="promo">Promo codes</option>
            <option value="users">Users</option>
          </select>
        </label>
        <label className="block">
          <span className="label">File (.csv or .json)</span>
          <input name="file" type="file" accept=".csv,.json,text/csv,application/json" required className="text-sm" />
        </label>
        <button disabled={pending} className="btn-primary btn-sm">{pending ? 'Validating…' : 'Validate'}</button>
      </form>

      {state && (
        <section className="card mt-6 p-5" aria-live="polite">
          {state.fatal ? (
            <p className="font-semibold text-red-600">{state.fatal}</p>
          ) : (
            <>
              <p className="font-semibold">
                {state.total} rows · <span className="text-mint-700">{state.valid} valid</span> ·{' '}
                <span className={state.errors.length ? 'text-red-600' : ''}>{state.errors.length} with errors</span>
              </p>
              {state.errors.length > 0 && (
                <div className="mt-3 max-h-96 overflow-auto rounded-xl border border-red-200 dark:border-red-900">
                  <table className="tbl">
                    <thead><tr><th>Row</th><th>Problems</th></tr></thead>
                    <tbody>
                      {state.errors.map((e) => (
                        <tr key={e.row}><td className="font-mono">{e.row}</td><td><ul className="list-disc pl-4">{e.messages.map((m, i) => <li key={i}>{m}</li>)}</ul></td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {state.token && (
                <form action={importCommit} className="mt-4 flex items-center gap-3">
                  <input type="hidden" name="token" value={state.token} />
                  <button className="btn-cta btn-sm">Import {state.valid} valid rows</button>
                  {state.errors.length > 0 && <span className="text-xs muted">Rows with errors are skipped. Fix them and re-upload to import the rest.</span>}
                </form>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}
