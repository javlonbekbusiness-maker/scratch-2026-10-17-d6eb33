'use client';

import { Icon } from '@/components/ui/Icon';

export function ShareButton({ text, imageUrl, labels }: { text: string; imageUrl: string; labels: { share: string; card: string } }) {
  async function share() {
    const url = window.location.origin;
    try {
      const blob = await fetch(imageUrl).then((r) => r.blob());
      const file = new File([blob], 'yhq-result.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `${text} ${url}` });
        return;
      }
      if (navigator.share) {
        await navigator.share({ text, url });
        return;
      }
    } catch {
      // User cancelled or sharing unsupported — fall through to download.
    }
    window.open(imageUrl, '_blank');
  }
  return (
    <>
      <button type="button" onClick={share} className="btn-secondary"><Icon name="arrowRight" size={18} className="-rotate-45" /> {labels.share}</button>
      <a href={imageUrl} download="yhq-result.png" className="btn-secondary"><Icon name="card" size={18} /> {labels.card}</a>
    </>
  );
}
