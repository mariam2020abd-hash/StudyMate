import { useState } from 'react';
import { initialCourses } from '../data/demoCourses';

// Each screen owns a temporary session; no browser or native storage dependency.
export function useDashboard() {
  const [courses, setCourses] = useState(initialCourses);
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
    const id = Date.now();
    setCourses(items => [...items, { id, name: trimmed, chapters: [] }]);
    setName(''); setError(''); setAdding(false); setSelected(id);
  }

  return { courses, setCourses, selected, setSelected, adding, setAdding, name, setName, chapterName, setChapterName, error, setError, completed, progress, course, nextCourse, nextChapter, addCourse };
}
