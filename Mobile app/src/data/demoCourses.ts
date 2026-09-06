import type { Course } from '../types/course';

export const initialCourses: Course[] = [
  { id: 1, name: 'مبادئ البرمجة', chapters: [{ title: 'المتغيرات وأنواع البيانات', done: true }, { title: 'الجمل الشرطية', done: true }, { title: 'الحلقات التكرارية', done: false }] },
  { id: 2, name: 'الرياضيات المتقطعة', chapters: [{ title: 'المنطق الرياضي', done: true }, { title: 'المجموعات', done: false }] },
  { id: 3, name: 'اللغة الإنجليزية', chapters: [{ title: 'Academic Reading', done: false }] },
];
