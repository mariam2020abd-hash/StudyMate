import { useState } from 'react';
import { post, setSession, type User } from '../api/client';

type Mode = 'login' | 'register' | 'forgot' | 'verify' | 'reset';
export default function AuthPage({ onSignedIn, onBack }: { onSignedIn: (user: User) => void; onBack: () => void }) {
  const [link] = useState(() => {
    const search = new URLSearchParams(location.search);
    const action = search.get('action');
    return { mode: action === 'verify' || action === 'reset' ? action : 'login', token: search.get('token') ?? '' } as { mode: Mode; token: string };
  });
  const [mode, setMode] = useState<Mode>(link.mode);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const title = { login: 'تسجيل الدخول', register: 'إنشاء حساب', forgot: 'استعادة كلمة المرور', verify: 'تأكيد البريد الإلكتروني', reset: 'تعيين كلمة مرور جديدة' }[mode];
  const passwordTooShort = password.length > 0 && password.length < 8;
  function change(next: Mode) { setMode(next); setPassword(''); setError(''); setMessage(''); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage(''); setBusy(true);
    try {
      if (mode === 'login') {
        const result = await post<{ token: string; user: User }>('/auth/login', { email, password });
        setSession(result.token); setPassword(''); onSignedIn(result.user);
      } else {
        const route = { register: 'register', forgot: 'forgot-password', verify: 'verify', reset: 'reset-password' }[mode];
        const payload = mode === 'verify' ? { token: link.token } : mode === 'reset' ? { token: link.token, password } : { email, ...(mode === 'register' ? { password } : {}) };
        const result = await post<{ message: string }>(`/auth/${route}`, payload);
        setMessage(result.message); setPassword('');
        if (mode === 'verify' || mode === 'reset') { history.replaceState(null, '', location.pathname); setMode('login'); }
      }
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return <main className="page auth-page">
    <header className="navbar"><strong className="brand">StudyMate</strong><button className="secondary" onClick={onBack}>الرئيسية</button></header>
    <section className="card auth-card"><h1>{title}</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <form className="form" onSubmit={submit}>
        {mode !== 'verify' && mode !== 'reset' && <label>البريد الإلكتروني<input type="email" autoComplete="email" dir="ltr" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>}
        {mode !== 'verify' && mode !== 'forgot' && <label>كلمة المرور<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} aria-invalid={passwordTooShort} aria-describedby={passwordTooShort ? 'password-hint' : undefined} required minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /><small id="password-hint" className="password-hint" aria-live="polite">{passwordTooShort ? 'كلمة المرور قصيرة؛ استخدم 8 خانات على الأقل (حروف أو أرقام أو رموز).' : ''}</small></label>}
        {mode === 'verify' && <p>اضغط لتأكيد بريدك. رابط التحقق صالح للاستخدام مرة واحدة.</p>}
        <button className="auth-submit" disabled={busy || ((mode === 'verify' || mode === 'reset') && !link.token)}>{busy ? 'جارٍ إكمال العملية…' : title}</button>
      </form>
      <div className="auth-navigation">
        {mode === 'login' ? <>
          <p>ليس لديك حساب؟ <button type="button" className="auth-link" disabled={busy} onClick={() => change('register')}>إنشاء حساب</button></p>
          <div className="auth-help-links"><button type="button" className="auth-link" disabled={busy} onClick={() => change('forgot')}>نسيت كلمة المرور</button>
          <button type="button" className="auth-link auth-verification" disabled={busy || !email} onClick={async () => {
            setBusy(true); setError(''); setMessage(''); try { const r = await post<{ message: string }>('/auth/resend-verification', { email }); setMessage(r.message); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
          }}>إعادة إرسال رسالة التحقق</button></div>
        </> : mode === 'register' ?
          <p>لديك حساب؟ <button type="button" className="auth-link" disabled={busy} onClick={() => change('login')}>تسجيل الدخول</button></p> :
          <button type="button" className="auth-link" disabled={busy} onClick={() => change('login')}>العودة لتسجيل الدخول</button>}
      </div>
    </section>
  </main>;
}
