import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView, Text } from 'react-native';
import { api, ApiError, restoreSession, setSession, type User } from './src/api/client';
import AuthScreen from './src/screens/AuthScreen';
import StudyScreen from './src/screens/StudyScreen';
import { Button, ui } from './src/components/Controls';
import LandingScreen from './src/screens/landing/LandingScreen';

export default function App() {
  const [screen, setScreen] = useState<'landing' | 'auth'>('landing');
  const [user,setUser]=useState<User>();const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  const expired=useCallback(async()=>{await setSession(null);setUser(undefined);setScreen('auth');},[]);
  useEffect(()=>{(async()=>{try{if(await restoreSession())setUser(await api<User>('/me'));}catch(e){if(e instanceof ApiError&&e.status===401)await expired();else setError((e as Error).message);}finally{setLoading(false);}})();},[expired]);
  async function logout(){await api('/auth/logout','POST');await expired();}
  if(loading)return <SafeAreaView style={[ui.root,ui.page]}><Text style={ui.text}>جارٍ استعادة الجلسة…</Text></SafeAreaView>;
  if(user?.role==='admin')return <SafeAreaView style={[ui.root,ui.page]}><Text style={ui.heading}>لوحة المشرف متاحة على الموقع.</Text><Button title="تسجيل الخروج" onPress={()=>logout().catch(e=>setError(e.message))}/>{!!error&&<Text style={ui.error}>{error}</Text>}</SafeAreaView>;
  if(user)return <StudyScreen user={user} onLogout={logout} onExpired={expired}/>;
  if(screen==='auth')return <AuthScreen onLogin={setUser} onBack={()=>setScreen('landing')}/>;
  if(error)return <SafeAreaView style={[ui.root,ui.page]}><Text style={ui.error}>{error}</Text><Button title="الانتقال لتسجيل الدخول" onPress={()=>{setError('');setScreen('auth');}}/></SafeAreaView>;
  return <LandingScreen onOpenDashboard={()=>setScreen('auth')}/>;
}
