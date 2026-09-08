import type { Chapter, Course } from '../types/course';

export type ReviewFilter = 'all' | 'pending' | 'done';

function normalize(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').trim();
}

export function searchCourses(courses: Course[], query: string) {
  const term = normalize(query);
  return courses.filter(course => normalize(course.name).includes(term) || course.chapters.some(chapter => normalize(chapter.title).includes(term)));
}

export function searchChapters(chapters: Chapter[], query: string, filter: ReviewFilter) {
  const term = normalize(query);
  // Keep the original index so actions target the correct chapter after filtering.
  return chapters.map((chapter, index) => ({ chapter, index })).filter(({ chapter }) =>
    normalize(chapter.title).includes(term) && (filter === 'all' || chapter.done === (filter === 'done')),
  );
}
