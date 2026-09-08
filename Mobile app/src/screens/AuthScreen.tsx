import { useState } from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { api, setSession, type User } from '../api/client';
import { Button, Field, ui } from '../components/Controls';

export default function AuthScreen({ onLogin, onBack }: { onLogin: (user: User) => void; onBack: () => void }) {
  const [mode, setMode] = useState<'login'|'register'|'forgot'>('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const title = mode === 'login' ? 'تسجيل الدخول' : mode === 'register' ? 'إنشاء حساب' : 'استعادة كلمة المرور';
  async function submit() {
    if (!email.trim() || (mode !== 'forgot' && (password.length < 8 || password.length > 128))) { setError('أدخل البريد وكلمة مرور بين 8 و128 محرفًا.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      if (mode === 'login') {
        const result = await api<{token: string; user: User}>('/auth/login', 'POST', {email: email.trim(), password});
        await setSession(result.token); setPassword(''); onLogin(result.user);
      } else {
        await api(mode === 'register' ? '/auth/register' : '/auth/forgot-password', 'POST', {email: email.trim(), password});
        setPassword(''); setNotice('إذا كان البريد مؤهلًا، ستصلك رسالة لإكمال العملية. افتح رابط الرسالة ثم عُد لتسجيل الدخول.');
      }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <SafeAreaView style={ui.root}><ScrollView contentContainerStyle={ui.page} keyboardShouldPersistTaps="handled">
    <Button title="الرئيسية" secondary onPress={onBack}/><Text style={ui.title}>{title}</Text><Text style={ui.text}>حساب واحد للموقع والجوال.</Text>
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}{!!notice && <Text accessibilityLiveRegion="polite" style={ui.text}>{notice}</Text>}
    <Field label="البريد الإلكتروني" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" maxLength={254}/>
    {mode !== 'forgot' && <Field label="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} maxLength={128}/>}
    <Button title={busy ? 'جارٍ إكمال العملية…' : title} disabled={busy} onPress={submit}/>
    <View style={ui.row}>{(['login','register','forgot'] as const).filter(m=>m!==mode).map(m=><Button key={m} secondary disabled={busy} title={m==='login'?'تسجيل الدخول':m==='register'?'إنشاء حساب':'نسيت كلمة المرور'} onPress={()=>{setMode(m);setError('');setNotice('');}}/>)}</View>
    <Button title="إعادة إرسال رسالة التحقق" secondary disabled={busy||!email.trim()} onPress={async()=>{setBusy(true);try{await api('/auth/resend-verification','POST',{email});setNotice('إذا كان البريد مؤهلًا، ستصلك رسالة تحقق.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}/>
  </ScrollView></SafeAreaView>;
}
