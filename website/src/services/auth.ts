import { getAuth, browserSessionPersistence, setPersistence, signOut } from 'firebase/auth';
import { firebaseApp } from './firebase';

export const auth = getAuth(firebaseApp);
auth.languageCode = 'ar';
export const authReady = setPersistence(auth, browserSessionPersistence).then(() => auth.authStateReady());
export async function logoutFirebase() { await signOut(auth); }
export function authMessage(error: unknown): string {
  const code = (error as { code?: string }).code;
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'تعذّر تسجيل الدخول. تحقق من البريد وكلمة المرور.',
    'auth/user-not-found': 'تعذّر تسجيل الدخول. تحقق من البريد وكلمة المرور.',
    'auth/wrong-password': 'تعذّر تسجيل الدخول. تحقق من البريد وكلمة المرور.',
    'auth/email-already-in-use': 'هذا البريد مسجّل. سجّل الدخول أو استعد كلمة المرور.',
    'auth/weak-password': 'اختر كلمة مرور أقوى من 8 خانات على الأقل.',
    'auth/password-does-not-meet-requirements': 'كلمة المرور لا تستوفي متطلبات الأمان. جرّب كلمة أطول تشمل حروفًا وأرقامًا ورموزًا.',
    'auth/too-many-requests': 'محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.',
    'auth/network-request-failed': 'تعذّر الاتصال. تحقق من الإنترنت ثم أعد المحاولة.',
    'auth/user-disabled': 'هذا الحساب معطّل.',
    'auth/invalid-email': 'أدخل بريدًا إلكترونيًا صالحًا.',
  };
  return messages[code ?? ''] ?? (code?.startsWith('auth/') ? 'تعذّر إكمال العملية. أعد المحاولة.' : (error as Error).message);
}
