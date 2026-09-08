import { useState } from 'react';
import { post, setSession, type User } from '../api/client';
import { createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, authReady, authMessage } from '../services/auth';

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
      await authReady;
      if (mode === 'login') {
        const result = await signInWithEmailAndPassword(auth, email.trim(), password);
        setSession(null);
        if (!result.user.emailVerified) {
          setMessage('أكّد بريدك عبر الرسالة التي وصلتك ثم سجّل الدخول. يمكنك إعادة إرسال رسالة التحقق من الزر أدناه.');
          return;
        }
        await result.user.getIdToken(true);
        const user = await post<User>('/auth/firebase', {});
        setPassword(''); onSignedIn(user);
      } else if (mode === 'register') {
        const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
        setSession(null); setMode('login'); setPassword('');
        try {
          await sendEmailVerification(result.user);
          setMessage('تم إنشاء الحساب. افتح رسالة تأكيد البريد واضغط الرابط، ثم ارجع لتسجيل الدخول.');
        } catch {
          setMessage('تم إنشاء الحساب، لكن تعذّر إرسال رسالة التحقق. استخدم زر إعادة إرسال رسالة التحقق.');
        }
      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email.trim());
        setMessage('إذا كان البريد مسجّلًا، ستصلك رسالة لاستعادة كلمة المرور.');
      } else {
        const route = { register: 'register', forgot: 'forgot-password', verify: 'verify', reset: 'reset-password' }[mode];
        const payload = mode === 'verify' ? { token: link.token } : mode === 'reset' ? { token: link.token, password } : { email, ...(mode === 'register' ? { password } : {}) };
        const result = await post<{ message: string }>(`/auth/${route}`, payload);
        setMessage(result.message); setPassword('');
        if (mode === 'verify' || mode === 'reset') { history.replaceState(null, '', location.pathname); setMode('login'); }
      }
    } catch (err) { setError(authMessage(err)); }
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
            setBusy(true); setError(''); setMessage('');
            try {
              await authReady;
              let account = auth.currentUser;
              if (!account || account.email?.toLowerCase() !== email.trim().toLowerCase()) {
                if (!password) throw new Error('أدخل البريد وكلمة المرور لإعادة إرسال رسالة التحقق.');
                account = (await signInWithEmailAndPassword(auth, email.trim(), password)).user;
              }
              if (account.emailVerified) setMessage('بريدك مؤكّد بالفعل. يمكنك تسجيل الدخول.');
              else { await sendEmailVerification(account); setMessage('أُرسلت رسالة التحقق. افتح بريدك الإلكتروني.'); }
            } catch (err) { setError(authMessage(err)); } finally { setBusy(false); }
          }}>إعادة إرسال رسالة التحقق</button></div>
        </> : mode === 'register' ?
          <p>لديك حساب؟ <button type="button" className="auth-link" disabled={busy} onClick={() => change('login')}>تسجيل الدخول</button></p> :
          <button type="button" className="auth-link" disabled={busy} onClick={() => change('login')}>العودة لتسجيل الدخول</button>}
      </div>
    </section>
  </main>;
}
