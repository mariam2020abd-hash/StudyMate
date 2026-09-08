import { useDashboard } from '../hooks/useDashboard';
import EditableName from '../components/EditableName';
import { useState } from 'react';
import { searchChapters, searchCourses, type ReviewFilter } from '../utils/studySearch';

export default function DashboardPage({ onBack }: { onBack: () => void }) {
  const { courses, setCourses, selected, setSelected, adding, setAdding, name, setName, chapterName, setChapterName, error, setError, storageError, completed, progress, course, nextCourse, nextChapter, addCourse } = useDashboard();
  const [courseQuery, setCourseQuery] = useState('');
  const [chapterQuery, setChapterQuery] = useState('');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const visibleCourses = searchCourses(courses, courseQuery);
  const visibleChapters = searchChapters(course?.chapters ?? [], chapterQuery, reviewFilter);
  function openCourse(id: number) {
    setSelected(id); setChapterName(''); setChapterQuery(''); setReviewFilter('all');
  }
  return <main className="page dashboard">
    <header className="navbar"><strong className="brand">StudyMate <span>●</span></strong><button className="secondary" onClick={onBack}>الصفحة الرئيسية ←</button></header>
    <p className="notice">تُحفظ مقرراتك تلقائيًا في هذا المتصفح. لا تتزامن مع أجهزة أخرى، وحذف بيانات الموقع يمسحها.</p>
    {storageError && <p className="error notice" role="alert">{storageError}</p>}
    <p className="kicker">مساحتك الدراسية</p><h1>كل خطوة تقرّبك.</h1><p className="intro">رتّب مقرراتك، واختر شابترًا واحدًا تبدأ به اليوم.</p>
    <section className="stats" aria-label="إحصاءات الدراسة">
      {[['المقررات', courses.length], ['شابترات تمت مراجعتها', completed], ['التقدم العام', `${progress}%`]].map(([label, value]) => <div className="card" key={label}><strong>{value}</strong><span>{label}</span></div>)}
    </section>
    <section className="focus"><div><small>خطوتك التالية</small><h2>{nextChapter?.title ?? (completed ? 'أنجزت كل الشابترات المضافة!' : 'ابدأ رحلتك الدراسية')}</h2><p>{nextCourse?.name ?? 'أضف مقررًا وشابترًا لتبدأ متابعة تقدمك.'}</p></div>{nextCourse && <button onClick={() => openCourse(nextCourse.id)}>ابدأ المراجعة ←</button>}</section>
    <section aria-labelledby="courses-title">
      <div className="section-head"><h2 id="courses-title">مقرراتي</h2><button className="secondary" onClick={() => { setAdding(!adding); setError(''); }}>{adding ? 'إلغاء' : '+ إضافة مقرر'}</button></div>
      {adding && <form className="card form" onSubmit={event => { event.preventDefault(); addCourse(); setCourseQuery(''); setChapterQuery(''); setReviewFilter('all'); }}>
        <label htmlFor="course-name">اسم المقرر</label><input id="course-name" autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="مثل: قواعد البيانات" maxLength={80} aria-describedby={error ? 'course-error' : undefined} aria-invalid={!!error} />
        {error && <p className="error" id="course-error" role="alert">{error}</p>}<button type="submit">حفظ المقرر</button>
      </form>}
      {!courses.length && <p className="card">لا توجد مقررات بعد. اضغط «إضافة مقرر» لإنشاء أول مقرر لك.</p>}
      {!!courses.length && <div className="search-panel">
        <label htmlFor="course-search">البحث في المقررات والشابترات</label>
        <input id="course-search" type="search" value={courseQuery} onChange={event => setCourseQuery(event.target.value)} placeholder="اسم المقرر أو عنوان شابتر…" />
        <p className="muted" role="status">عرض {visibleCourses.length} من {courses.length} مقررات</p>
      </div>}
      {!!courses.length && !visibleCourses.length && <div className="card"><p>لا توجد مقررات تطابق بحثك.</p><button className="secondary" onClick={() => setCourseQuery('')}>مسح البحث</button></div>}
      <div className="grid">{visibleCourses.map(item => {
        const done = item.chapters.filter(chapter => chapter.done).length;
        return <button key={item.id} className={`card course ${selected === item.id ? 'active' : ''}`} aria-pressed={selected === item.id} onClick={() => openCourse(item.id)}>
          <span className="course-icon" aria-hidden="true">▤</span><h3>{item.name}</h3><p>{done} من {item.chapters.length} شابترات مكتملة</p>
          <progress aria-label={`تقدم ${item.name}`} value={done} max={item.chapters.length || 1} /><span className="purple">عرض الشابترات ←</span>
        </button>;
      })}</div>
    </section>
    {course && <section key={course.id} className="card details" aria-label={`شابترات ${course.name}`}>
      <div className="section-head"><h2>{course.name}</h2><button className="secondary" onClick={() => setSelected(null)}>إغلاق</button></div><p>حدّد الشابترات التي راجعتها لتحديث تقدمك.</p>
      <div className="actions manage-actions">
        <EditableName value={course.name} label="اسم المقرر" maxLength={80} onSave={value => {
          if (courses.some(item => item.id !== course.id && item.name === value)) return 'هذا المقرر موجود بالفعل.';
          setCourses(items => items.map(item => item.id === course.id ? { ...item, name: value } : item));
        }} />
        <button className="danger" onClick={() => {
          if (!window.confirm(`حذف مقرر «${course.name}» وجميع شابتراته؟ لا يمكن التراجع عن الحذف.`)) return;
          setCourses(items => items.filter(item => item.id !== course.id)); setSelected(null); setChapterName('');
        }}>حذف المقرر</button>
      </div>
      {!course.chapters.length && <p>لا توجد شابترات بعد. أضف أول شابتر أدناه.</p>}
      {!!course.chapters.length && <div className="search-panel">
        <label htmlFor="chapter-search">البحث داخل هذا المقرر</label>
        <input id="chapter-search" type="search" value={chapterQuery} onChange={event => setChapterQuery(event.target.value)} placeholder="عنوان الشابتر…" />
        <div className="filter-buttons" role="group" aria-label="حالة المراجعة">
          {([['all', 'الكل'], ['pending', 'للمراجعة'], ['done', 'تمت المراجعة']] as const).map(([value, label]) => <button key={value} className={reviewFilter === value ? '' : 'secondary'} aria-pressed={reviewFilter === value} onClick={() => setReviewFilter(value)}>{label} ({course.chapters.filter(entry => value === 'all' || entry.done === (value === 'done')).length})</button>)}
        </div>
        <p className="muted" role="status">عرض {visibleChapters.length} من {course.chapters.length} شابترات</p>
        {!visibleChapters.length && <div><p>لا توجد شابترات تطابق البحث والتصفية.</p><button className="secondary" onClick={() => { setChapterQuery(''); setReviewFilter('all'); }}>عرض جميع الشابترات</button></div>}
      </div>}
      {visibleChapters.map(({ chapter, index }) => <div className="chapter-row" key={`${index}:${chapter.title}`}><label className="chapter">
        <input type="checkbox" checked={chapter.done} onChange={() => setCourses(items => items.map(item => item.id === course.id ? { ...item, chapters: item.chapters.map((entry, i) => i === index ? { ...entry, done: !entry.done } : entry) } : item))} />
        <span>{chapter.title}</span><small>{chapter.done ? 'تمت المراجعة' : 'للمراجعة'}</small>
      </label><div className="actions manage-actions">
        <EditableName value={chapter.title} label="عنوان الشابتر" maxLength={100} onSave={value => {
          setCourses(items => items.map(item => item.id === course.id ? { ...item, chapters: item.chapters.map((entry, i) => i === index ? { ...entry, title: value } : entry) } : item));
        }} />
        <button className="danger" aria-label={`حذف شابتر ${chapter.title}`} onClick={() => {
          if (!window.confirm(`حذف شابتر «${chapter.title}»؟ لا يمكن التراجع عن الحذف.`)) return;
          setCourses(items => items.map(item => item.id === course.id ? { ...item, chapters: item.chapters.filter((_, i) => i !== index) } : item));
        }}>حذف الشابتر</button>
      </div></div>)}
      <form className="form" onSubmit={event => { event.preventDefault(); if (!chapterName.trim()) return; setCourses(items => items.map(item => item.id === course.id ? { ...item, chapters: [...item.chapters, { title: chapterName.trim(), done: false }] } : item)); setChapterName(''); }}>
        <label htmlFor="chapter-name">شابتر جديد</label><input id="chapter-name" value={chapterName} onChange={event => setChapterName(event.target.value)} placeholder="اكتب عنوان الشابتر" maxLength={100} /><button disabled={!chapterName.trim()}>إضافة الشابتر</button>
      </form>
    </section>}
    <footer>خطوة صغيرة اليوم، فهم أوضح غدًا.</footer>
  </main>;
}
