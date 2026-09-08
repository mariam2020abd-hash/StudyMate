import { useEffect, useState } from 'react';
import { loadCourses, saveCourses } from '../data/courseStorage';
import type { Course } from '../types/course';

export function useDashboard() {
  const [initial] = useState(() => {
    try { return { courses: loadCourses(window.localStorage), error: '' }; }
    catch { return { courses: [] as Course[], error: 'تعذّر قراءة البيانات المحفوظة. لن نستبدلها. تحقّق من إعدادات المتصفح ثم أعد تحميل الصفحة.' }; }
  });
  const [courses, setCourses] = useState(initial.courses);
  const [storageError, setStorageError] = useState(initial.error);
  useEffect(() => {
    if (initial.error) return;
    try { saveCourses(window.localStorage, courses); setStorageError(''); }
    catch { setStorageError('تعذّر حفظ التغييرات. قد تكون مساحة المتصفح ممتلئة أو التخزين محظورًا؛ اترك الصفحة مفتوحة حتى تتمكن من الحفظ.'); }
  }, [courses, initial.error]);
  const [selected, setSelected] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [chapterName, setChapterName] = useState('');
  const [error, setError] = useState('');
  const chapters = courses.flatMap(course => course.chapters);
  const completed = chapters.filter(chapter => chapter.done).length;
  const progress = chapters.length ? Math.round(completed / chapters.length * 100) : 0;
  const course = courses.find(item => item.id === selected);
  const nextCourse = courses.find(item => item.chapters.some(chapter => !chapter.done));
  const nextChapter = nextCourse?.chapters.find(chapter => !chapter.done);

  function addCourse() {
    const trimmed = name.trim();
    if (!trimmed) return setError('اكتب اسم المقرر أولًا.');
    if (courses.some(item => item.name === trimmed)) return setError('هذا المقرر موجود بالفعل.');
    const id = Math.max(Date.now(), ...courses.map(item => item.id + 1));
    setCourses(items => [...items, { id, name: trimmed, chapters: [] }]);
    setName(''); setError(''); setAdding(false); setSelected(id);
  }

  return { courses, setCourses, selected, setSelected, adding, setAdding, name, setName, chapterName, setChapterName, error, setError, storageError, completed, progress, course, nextCourse, nextChapter, addCourse };
}
