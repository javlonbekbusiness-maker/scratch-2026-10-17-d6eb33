import { ImageResponse } from 'next/og';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { formatDate } from '@/lib/format';

/** Share card (1080×1080) or certificate (1600×1130) as PNG. Text kept in Latin so the built-in font renders it. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const s = await db.testSession.findUnique({ where: { id }, include: { user: true } });
  if (!s || !user || s.userId !== user.id || !s.finishedAt) return new Response('Not found', { status: 404 });
  const cert = new URL(req.url).searchParams.get('type') === 'cert' && s.mode === 'EXAM' && s.passed;
  const name = (s.user.name ?? '').replace(/[^\p{L}\p{N} .'-]/gu, '').slice(0, 40);

  if (cert) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', padding: 40, background: '#eef6ff' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '8px solid #1f5beb', borderRadius: 32, background: 'white' }}>
            <div style={{ fontSize: 36, color: '#1f5beb', fontWeight: 700, letterSpacing: 6 }}>YHQ TEST</div>
            <div style={{ fontSize: 72, fontWeight: 800, marginTop: 24 }}>SERTIFIKAT</div>
            <div style={{ fontSize: 30, color: '#64748b', marginTop: 12 }}>Sinov imtihoni muvaffaqiyatli topshirildi</div>
            <div style={{ fontSize: 64, fontWeight: 700, marginTop: 48, color: '#0f172a' }}>{name || '—'}</div>
            <div style={{ fontSize: 120, fontWeight: 800, color: '#16b27d', marginTop: 24 }}>{`${s.score}%`}</div>
            <div style={{ fontSize: 28, color: '#64748b', marginTop: 12 }}>{`${s.correctQ} / ${s.totalQ} · ${formatDate(s.finishedAt)}`}</div>
            <div style={{ fontSize: 20, color: '#94a3b8', marginTop: 40 }}>Mock exam certificate — not an official document</div>
          </div>
        </div>
      ),
      { width: 1600, height: 1130 },
    );
  }

  const passed = s.passed === true;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: passed ? 'linear-gradient(135deg,#1f5beb,#16b27d)' : 'linear-gradient(135deg,#1f5beb,#1c3884)', color: 'white',
        }}
      >
        <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: 4 }}>YHQ TEST</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 520, height: 520, borderRadius: 999, border: '28px solid rgba(255,255,255,.35)', marginTop: 60 }}>
          <div style={{ fontSize: 180, fontWeight: 800 }}>{`${s.score}%`}</div>
        </div>
        <div style={{ fontSize: 56, fontWeight: 700, marginTop: 60 }}>{passed ? "Sinov imtihonidan o'tdim!" : `${s.correctQ} / ${s.totalQ} to'g'ri`}</div>
        <div style={{ fontSize: 34, opacity: 0.8, marginTop: 16 }}>Haydovchilik imtihoniga tayyorgarlik</div>
      </div>
    ),
    { width: 1080, height: 1080 },
  );
}
