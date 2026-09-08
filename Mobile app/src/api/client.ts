import * as SecureStore from 'expo-secure-store';

const base = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5287').replace(/\/$/, '');
const sessionKey = 'studymate.session';
let token: string | null = null;
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export async function restoreSession() { token = await SecureStore.getItemAsync(sessionKey); return !!token; }
export async function setSession(value: string | null) {
  if (value) await SecureStore.setItemAsync(sessionKey, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  else await SecureStore.deleteItemAsync(sessionKey);
  token = value;
}
export function apiUrl(path: string) {
  if (!__DEV__ && !base.startsWith('https://')) throw new ApiError(0, 'https_required', 'يلزم عنوان خادم آمن لتشغيل التطبيق.');
  return `${base}/api${path}`;
}
export function authHeaders(): Record<string,string> { return token ? { Authorization: `Bearer ${token}` } : {}; }
export async function readResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (response.ok && !text) return undefined as T;
  let data;
  try { data = JSON.parse(text); } catch { throw new ApiError(response.status, 'invalid_response', 'تعذّر قراءة استجابة الخادم.'); }
  if (!response.ok) throw new ApiError(response.status, data.error?.code ?? 'request_failed', data.error?.message ?? 'تعذّر إكمال العملية.');
  return data as T;
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    return await readResponse<T>(await fetch(apiUrl(path), { method, signal: controller.signal,
      headers: { ...authHeaders(), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) }));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, 'network', 'تعذّر الاتصال بالخادم. تحقق من الاتصال وحدّث البيانات قبل إعادة المحاولة.');
  } finally { clearTimeout(timeout); }
}
export type User = { id: string; email: string; role: 'student' | 'admin'; language: string };
export type Chapter = { id: string; title: string; reviewed: boolean; version: number; status: string };
export type Course = { id: string; name: string; version: number; chapters: Chapter[] };
export type Dashboard = { courses: Course[]; completed: number; progress: number; nextChapterId: string | null };
