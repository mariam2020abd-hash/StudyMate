import type { Course } from '../types/course';

export const storageKey = 'studymate.courses.v1';
type Store = Pick<Storage, 'getItem' | 'setItem'>;

export function loadCourses(storage: Store): Course[] {
  const raw = storage.getItem(storageKey);
  if (raw === null) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data) || !data.every(course =>
    course && Number.isSafeInteger(course.id) && typeof course.name === 'string' &&
    course.name.trim().length > 0 && Array.isArray(course.chapters) &&
    course.chapters.every((chapter: unknown) => {
      if (!chapter || typeof chapter !== 'object') return false;
      const entry = chapter as Record<string, unknown>;
      return typeof entry.title === 'string' && entry.title.trim().length > 0 && typeof entry.done === 'boolean';
    })
  ) || new Set(data.map(course => course.id)).size !== data.length) {
    throw new Error('Invalid saved courses');
  }
  return data;
}

export function saveCourses(storage: Store, courses: Course[]) {
  storage.setItem(storageKey, JSON.stringify(courses));
}
