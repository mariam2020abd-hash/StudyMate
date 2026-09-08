import { auth, authReady } from '../services/auth';
const base = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
let token = sessionStorage.getItem('studymate.session');

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public field?: string) { super(message); }
}
export function hasSession() { return !!token; }
export function setSession(value: string | null) {
  token = value;
  if (value) sessionStorage.setItem('studymate.session', value);
  else sessionStorage.removeItem('studymate.session');
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  await authReady;
  const bearer = auth.currentUser ? await auth.currentUser.getIdToken() : token;
  let response: Response;
  try {
    response = await fetch(`${base}/api${path}`, {
      ...options,
      headers: { ...(options.body && !(options.body instanceof FormData) && !(options.body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}),
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...options.headers },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'network', 'تعذّر الاتصال بالخادم. لم نتأكد من حفظ التغييرات؛ تحقق من الاتصال ثم أعد المحاولة.');
  }
  if (response.status === 204) return undefined as T;
  const responseText = await response.text();
  if (!responseText && response.ok) return undefined as T;
  let data;
  try { data = JSON.parse(responseText); }
  catch { throw new ApiError(response.status, 'invalid_response', 'تعذّر قراءة استجابة الخدمة. تحقق من إعداد عنوان الخادم.'); }
  if (!response.ok) throw new ApiError(response.status, data.error?.code ?? 'request_failed', data.error?.message ?? 'تعذّر إكمال العملية.', data.error?.field);
  return data as T;
}
export const post = <T>(path: string, body: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const put = <T>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body: JSON.stringify(body) });
export const remove = (path: string) => api<void>(path, { method: 'DELETE' });

export type User = { id: string; email: string; role: 'student' | 'admin'; language: 'ar' | 'en' };
export type Chapter = { id: string; courseId: string; title: string; reviewed: boolean; status: string; version: number };
export type Course = { id: string; name: string; version: number; chapters: Chapter[] };
export type Goal = { id: string; title: string; courseId: string | null; dueDate: string | null; completed: boolean; progress: number; version: number };
export type Task = { id: string; title: string; goalId: string | null; courseId: string | null; dueDate: string | null; completed: boolean; version: number };
export type Dashboard = { courses: Course[]; goals: Goal[]; tasks: Task[]; completed: number; progress: number; nextChapterId: string | null; recentAchievements: Task[] };
export type GradeCourse = { id: string; termId: string; name: string; code: string; credits: number; grade: string; version: number };
export type Scale = { id: string; name: string; maximum: number; sourceUrl: string; points: Record<string, number> };
export type Term = { id: string; name: string; version: number; priorGpa: number | null; priorCredits: number | null; scale: Scale; courses: GradeCourse[]; result: { termGpa: number | null; cumulativeGpa: number | null; credits: number } };
