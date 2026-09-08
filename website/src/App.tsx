import { useEffect, useState } from 'react';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import StudyWorkspace from './pages/StudyWorkspace';
import AdminPage from './pages/AdminPage';
import { api, hasSession, setSession, type User } from './api/client';

export default function App() {
  const [screen, setScreen] = useState<'landing' | 'auth' | 'dashboard'>(() => location.search.includes('action=') ? 'auth' : 'landing');
  const [user, setUser] = useState<User>();
  const [sessionError, setSessionError] = useState('');
  useEffect(() => { if (hasSession() && !new URLSearchParams(location.search).has('action')) api<User>('/me').then(u => { setUser(u); setScreen('dashboard'); }).catch(e => { setSessionError(e.message); if (e.status === 401) setSession(null); }); }, []);
  function navigate(next: 'landing' | 'auth' | 'dashboard') {
    setScreen(next);
    window.scrollTo(0, 0);
  }
  async function logout() { await api('/auth/logout', { method: 'POST' }); setSession(null); setUser(undefined); navigate('auth'); }
  if (screen === 'dashboard' && user) return user.role === 'admin' ? <AdminPage user={user} onLogout={logout} /> : <StudyWorkspace user={user} onLogout={logout} />;
  if (screen === 'auth') return <AuthPage onBack={() => navigate('landing')} onSignedIn={u => { setUser(u); navigate('dashboard'); }} />;
  return <>{sessionError && <p className="error notice" role="alert">{sessionError}</p>}<LandingPage onOpenDashboard={() => navigate(user ? 'dashboard' : 'auth')} /></>;
}
