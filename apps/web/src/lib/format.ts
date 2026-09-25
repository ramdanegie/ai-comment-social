// Shared display formatting (PRD §18.2-8: id-ID locale, Asia/Jakarta by default).

const TZ = 'Asia/Jakarta';

/** "baru saja", "5 mnt lalu", "3 jam lalu", "kemarin", then a short date. */
export function timeAgo(iso: string | Date, en = false): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const sec = Math.round((Date.now() - date.getTime()) / 1000);

  if (sec < 60) return en ? 'just now' : 'baru saja';
  const min = Math.floor(sec / 60);
  if (min < 60) return en ? `${min}m ago` : `${min} mnt lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return en ? `${hr}h ago` : `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  if (day === 1) return en ? 'yesterday' : 'kemarin';
  if (day < 7) return en ? `${day}d ago` : `${day} hari lalu`;

  return date.toLocaleDateString(en ? 'en-GB' : 'id-ID', { day: 'numeric', month: 'short', timeZone: TZ });
}

export function formatNumber(n: number): string {
  return n.toLocaleString('id-ID');
}

const IDR = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
export const formatIdr = (n: number) => IDR.format(n);

export const formatDate = (iso: string | Date, en = false) =>
  new Date(iso).toLocaleDateString(en ? 'en-GB' : 'id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
