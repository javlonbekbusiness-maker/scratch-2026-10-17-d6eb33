import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return ['', '/pricing', '/library', '/library?tab=rules', '/leaderboard', '/privacy', '/terms'].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: 'weekly',
    priority: p === '' ? 1 : 0.6,
  }));
}
