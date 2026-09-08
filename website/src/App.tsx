import { useEffect, useState } from 'react';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import StudyWorkspace from './pages/StudyWorkspace';
import AdminPage from './pages/AdminPage';
import { api, hasSession, setSession, type User } from './api/client';
import { auth, authReady, logoutFirebase } from './services/auth';

export default function App() {
  const [screen, setScreen] = useState<'landing' | 'auth' | 'dashboard'>(() => location.search.includes('action=') ? 'auth' : 'landing');
  const [user, setUser] = useState<User>();
  const [sessionError, setSessionError] = useState('');
  useEffect(() => {
    let active = true;
    void authReady.then(async () => {
      if (new URLSearchParams(location.search).has('action')) return;
      if (auth.currentUser?.emailVerified || (!auth.currentUser && hasSession())) {
        const u = await api<User>('/me');
        if (active) { setUser(u); setScreen('dashboard'); }
      }
    }).catch(e => { if (active) { setSessionError(e.message); if (e.status === 401) setSession(null); } });
    return () => { active = false; };
  }, []);
  function navigate(next: 'landing' | 'auth' | 'dashboard') {
    setScreen(next);
    window.scrollTo(0, 0);
  }
  async function logout() {
    try { if (!auth.currentUser) await api('/auth/logout', { method: 'POST' }); }
    finally { await logoutFirebase(); setSession(null); setUser(undefined); navigate('auth'); }
  }
  if (screen === 'dashboard' && user) return user.role === 'admin' ? <AdminPage user={user} onLogout={logout} /> : <StudyWorkspace user={user} onLogout={logout} />;
  if (screen === 'auth') return <AuthPage onBack={() => navigate('landing')} onSignedIn={u => { setUser(u); navigate('dashboard'); }} />;
  return <>{sessionError && <p className="error notice" role="alert">{sessionError}</p>}<LandingPage onOpenDashboard={() => navigate(user ? 'dashboard' : 'auth')} /></>;
}
