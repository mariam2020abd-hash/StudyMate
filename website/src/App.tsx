import { useState } from 'react';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  const [screen, setScreen] = useState<'landing' | 'dashboard'>('landing');
  function navigate(next: 'landing' | 'dashboard') {
    setScreen(next);
    window.scrollTo(0, 0);
  }
  return screen === 'dashboard'
    ? <DashboardPage onBack={() => navigate('landing')} />
    : <LandingPage onOpenDashboard={() => navigate('dashboard')} />;
}
