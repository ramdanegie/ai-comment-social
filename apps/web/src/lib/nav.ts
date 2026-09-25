// Single source of truth for app pages ↔ URLs. Components keep using page ids
// ('review', 'comments', …); only this file knows the paths.

export type PageId =
  | 'dashboard'
  | 'review'
  | 'comments'
  | 'accounts'
  | 'policies'
  | 'reports'
  | 'billing'
  | 'settings';

export const PAGES: Record<PageId, { path: string; labelId: string; labelEn: string }> = {
  dashboard: { path: '/dashboard', labelId: 'Dashboard', labelEn: 'Dashboard' },
  review: { path: '/review', labelId: 'Antrean Review', labelEn: 'Review Queue' },
  comments: { path: '/comments', labelId: 'Semua Komentar', labelEn: 'All Comments' },
  accounts: { path: '/accounts', labelId: 'Akun Terhubung', labelEn: 'Social Accounts' },
  policies: { path: '/policies', labelId: 'Aturan Balasan', labelEn: 'Reply Policies' },
  reports: { path: '/reports', labelId: 'Laporan & Ekspor', labelEn: 'Reports & Export' },
  billing: { path: '/billing', labelId: 'Kuota & Paket', labelEn: 'Billing & Quota' },
  settings: { path: '/settings', labelId: 'Tim & Audit Log', labelEn: 'Team & Audit' }
};

export const LOGIN_PATH = '/login';
export const HOME_PATH = PAGES.dashboard.path;

export const pathFor = (id: string): string => PAGES[id as PageId]?.path ?? HOME_PATH;

export function pageIdFromPath(pathname: string): PageId | null {
  const entry = Object.entries(PAGES).find(([, p]) => pathname === p.path || pathname.startsWith(p.path + '/'));
  return (entry?.[0] as PageId) ?? null;
}
