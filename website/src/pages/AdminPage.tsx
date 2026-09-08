import { useEffect, useState } from 'react';
import { api, put, type User } from '../api/client';
type Account = { id: string; email: string; active: boolean; verified: boolean; version: number; role: string };
type Settings = { dailyQuota: number; maxPdfBytes: number; maxPdfPages: number; quizQuestions: number; version: number };
export default function AdminPage({ user, onLogout }: { user: User; onLogout: () => Promise<void> }) {
  const [accounts, setAccounts] = useState<Account[]>([]); const [settings, setSettings] = useState<Settings>();
  const [query, setQuery] = useState(''); const [reason, setReason] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function load() { const [a, s] = await Promise.all([api<Account[]>(`/admin/accounts?query=${encodeURIComponent(query)}`), api<Settings>('/admin/settings')]); setAccounts(a); setSettings(s); }
  useEffect(() => { load().catch(e => setError(e.message)); }, []);
  async function action(work: () => Promise<unknown>) { setBusy(true); setError(''); try { await work(); await load(); setMessage('تم حفظ التعديل وتسجيله في سجل التدقيق.'); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <main className="page"><header className="navbar"><h1>إدارة StudyMate</h1><span dir="ltr">{user.email}</span><button className="secondary" onClick={() => onLogout().catch(e => setError(e.message))}>خروج</button></header><p>إدارة الحسابات وحدود الخدمة. المحتوى الدراسي ودرجات الطلاب خاصة بأصحابها.</p>
    {error && <p className="error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <div className="form"><label>سبب التعديل<input maxLength={500} required value={reason} onChange={e => setReason(e.target.value)} /></label></div>
    <form className="form" onSubmit={e => { e.preventDefault(); action(load); }}><label>البحث بالبريد أو المعرّف<input value={query} onChange={e => setQuery(e.target.value)} /></label><button disabled={busy}>بحث</button></form>
    {accounts.map(a => <article className="card goal-card" key={a.id}><strong dir="ltr">{a.email}</strong><p>{a.verified ? 'البريد متحقق' : 'بانتظار التحقق'} · {a.active ? 'نشط' : 'معطل'}</p>{a.role === 'student' && <button disabled={busy || !reason.trim()} className="secondary" onClick={() => action(() => put(`/admin/accounts/${a.id}/state`, { active: !a.active, version: a.version, reason }))}>{a.active ? 'تعطيل الحساب' : 'تفعيل الحساب'}</button>}</article>)}
    {settings && <form className="card form" onSubmit={e => { e.preventDefault(); action(() => put('/admin/settings', { ...settings, reason })); }}><h2>حدود التجربة</h2>{([['dailyQuota', 'حصة التوليد اليومية', 1000], ['maxPdfPages', 'حد صفحات الملف', 100], ['maxPdfBytes', 'حد حجم الملف بالبايت', 20000000]] as const).map(([key, label, max]) => <label key={key}>{label}<input required type="number" min="1" max={max} value={settings[key]} onChange={e => setSettings({ ...settings, [key]: Number(e.target.value) })} /></label>)}<button disabled={busy || !reason.trim()}>حفظ الحدود</button></form>}
  </main>;
}
