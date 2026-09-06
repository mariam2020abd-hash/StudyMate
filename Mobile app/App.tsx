import { useState } from 'react';
import DashboardScreen from './src/screens/dashboard/DashboardScreen';
import LandingScreen from './src/screens/landing/LandingScreen';

export default function App() {
  const [screen, setScreen] = useState<'landing' | 'dashboard'>('landing');

  return screen === 'dashboard' ? (
    <DashboardScreen onBack={() => setScreen('landing')} />
  ) : (
    <LandingScreen onOpenDashboard={() => setScreen('dashboard')} />
  );
}
