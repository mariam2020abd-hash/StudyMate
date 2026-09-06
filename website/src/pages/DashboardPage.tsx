import { useDashboard } from '../hooks/useDashboard';

export default function DashboardPage({ onBack }: { onBack: () => void }) {
  const { courses, setCourses, selected, setSelected, adding, setAdding, name, setName, chapterName, setChapterName, error, setError, completed, progress, course, nextCourse, nextChapter, addCourse } = useDashboard();
  return <main className="page dashboard">
    <header className="navbar"><strong className="brand">StudyMate <span>●</span></strong><button className="secondary" onClick={onBack}>الصفحة الرئيسية ←</button></header>
    <p className="notice">مساحة تجريبية • البيانات للتجربة، والتغييرات متاحة حتى مغادرة اللوحة أو إعادة تحميل الموقع.</p>
    <p className="kicker">مساحتك الدراسية</p><h1>كل خطوة تقرّبك.</h1><p className="intro">رتّب مقرراتك، واختر شابترًا واحدًا تبدأ به اليوم.</p>
    <section className="stats" aria-label="إحصاءات الدراسة">
      {[['المقررات', courses.length], ['شابترات تمت مراجعتها', completed], ['التقدم العام', `${progress}%`]].map(([label, value]) => <div className="card" key={label}><strong>{value}</strong><span>{label}</span></div>)}
    </section>
    <section className="focus"><div><small>خطوتك التالية</small><h2>{nextChapter?.title ?? 'أنجزت كل الشابترات المضافة!'}</h2><p>{nextCourse?.name ?? 'أضف شابترًا جديدًا لتكمل رحلتك.'}</p></div>{nextCourse && <button onClick={() => { setSelected(nextCourse.id); setChapterName(''); }}>ابدأ المراجعة ←</button>}</section>
    <section aria-labelledby="courses-title">
      <div className="section-head"><h2 id="courses-title">مقرراتي</h2><button className="secondary" onClick={() => { setAdding(!adding); setError(''); }}>{adding ? 'إلغاء' : '+ إضافة مقرر'}</button></div>
      {adding && <form className="card form" onSubmit={event => { event.preventDefault(); addCourse(); }}>
        <label htmlFor="course-name">اسم المقرر</label><input id="course-name" autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="مثل: قواعد البيانات" maxLength={80} aria-describedby={error ? 'course-error' : undefined} aria-invalid={!!error} />
        {error && <p className="error" id="course-error" role="alert">{error}</p>}<button type="submit">حفظ المقرر</button>
      </form>}
      <div className="grid">{courses.map(item => {
        const done = item.chapters.filter(chapter => chapter.done).length;
        return <button key={item.id} className={`card course ${selected === item.id ? 'active' : ''}`} aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); setChapterName(''); }}>
          <span className="course-icon" aria-hidden="true">▤</span><h3>{item.name}</h3><p>{done} من {item.chapters.length} شابترات مكتملة</p>
          <progress aria-label={`تقدم ${item.name}`} value={done} max={item.chapters.length || 1} /><span className="purple">عرض الشابترات ←</span>
        </button>;
      })}</div>
    </section>
    {course && <section className="card details" aria-label={`شابترات ${course.name}`}>
      <div className="section-head"><h2>{course.name}</h2><button className="secondary" onClick={() => setSelected(null)}>إغلاق</button></div><p>حدّد الشابترات التي راجعتها لتحديث تقدمك.</p>
      {!course.chapters.length && <p>لا توجد شابترات بعد. أضف أول شابتر أدناه.</p>}
      {course.chapters.map((chapter, index) => <label className="chapter" key={index}>
        <input type="checkbox" checked={chapter.done} onChange={() => setCourses(items => items.map(item => item.id === course.id ? { ...item, chapters: item.chapters.map((entry, i) => i === index ? { ...entry, done: !entry.done } : entry) } : item))} />
        <span>{chapter.title}</span><small>{chapter.done ? 'تمت المراجعة' : 'للمراجعة'}</small>
      </label>)}
      <form className="form" onSubmit={event => { event.preventDefault(); if (!chapterName.trim()) return; setCourses(items => items.map(item => item.id === course.id ? { ...item, chapters: [...item.chapters, { title: chapterName.trim(), done: false }] } : item)); setChapterName(''); }}>
        <label htmlFor="chapter-name">شابتر جديد</label><input id="chapter-name" value={chapterName} onChange={event => setChapterName(event.target.value)} placeholder="اكتب عنوان الشابتر" maxLength={100} /><button disabled={!chapterName.trim()}>إضافة الشابتر</button>
      </form>
    </section>}
    <footer>خطوة صغيرة اليوم، فهم أوضح غدًا.</footer>
  </main>;
}
