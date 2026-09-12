import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, post, put, remove, type Dashboard, type User, type Term } from '../api/client';
import NameEditor from '../components/NameEditor';
import ChapterCard from '../components/ChapterCard';
import { PlanningEditor, TermEditor, GradeEditor } from '../components/DetailEditors';
import { searchCourses, searchChapters } from '../utils/studySearch';

export default function StudyWorkspace({ user, onLogout }: { user: User; onLogout: () => Promise<void> }) {
  const [data, setData] = useState<Dashboard>(); const [terms, setTerms] = useState<Term[]>([]);
  const [tab, setTab] = useState<'courses' | 'goals' | 'gpa'>('courses');
  const [selected, setSelected] = useState<string>();
  const [expandedChapter, setExpandedChapter] = useState<string | null>();
  const [reviewTarget, setReviewTarget] = useState<string | null>(null);
  useEffect(() => {
    if (!reviewTarget) return;
    const target = document.getElementById(`chapter-card-${reviewTarget}`);
    if (target) {
      target.querySelector<HTMLButtonElement>('.chapter-toggle')?.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
      setReviewTarget(null);
    }
  }, [reviewTarget]);
  const [addingChapter, setAddingChapter] = useState(false);
  useEffect(() => { setAddingChapter(false); setChapterName(''); }, [selected]);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [courseName, setCourseName] = useState(''); const [chapterName, setChapterName] = useState('');
  const load = useCallback(async () => {
    const [dashboard, gradeTerms] = await Promise.all([api<Dashboard>('/study/dashboard'), api<Term[]>('/study/terms')]);
    setData(dashboard); setTerms(gradeTerms);
  }, []);
  useEffect(() => {
    load().catch(err => setError(err.message));
    const focus = () => load().catch(err => setError(err.message));
    window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus);
  }, [load]);
  async function action(work: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await work(); await load(); return true; }
    catch (err) { setError((err as Error).message); if (err instanceof ApiError && err.code === 'conflict') await load().catch(() => {}); return false; }
    finally { setBusy(false); }
  }
  const course = data?.courses.find(c => c.id === selected);
  const nextCourse = data?.courses.find(c => c.chapters.some(ch => ch.id === data.nextChapterId));
  const nextChapter = nextCourse?.chapters.find(ch => ch.id === data?.nextChapterId);
  // Reuse the tested normalizer while preserving stable server IDs for actions.
  const mappedCourses = data?.courses.map((c, index) => ({ id: index, name: c.name, chapters: c.chapters.map(ch => ({ title: ch.title, done: ch.reviewed })) })) ?? [];
  const visible = searchCourses(mappedCourses, query).map(c => data!.courses[c.id]);
  const chapterIndexes = searchChapters((course?.chapters ?? []).map(ch => ({ title: ch.title, done: ch.reviewed })), '', filter);
  return <main className="page dashboard">
    <header className="navbar"><strong className="brand">StudyMate</strong><span dir="ltr">{user.email}</span><button className="secondary" onClick={() => onLogout().catch(err => setError(err.message))}>تسجيل الخروج</button></header>
    <h1>مساحتك الدراسية</h1><p>تُحفظ دراستك في حسابك وتتاح على أجهزتك عند الاتصال.</p>
    <div className="filter-buttons" role="group" aria-label="أقسام الدراسة">{([['courses', 'مقرراتي'], ['goals', 'الأهداف والمهام'], ['gpa', 'حاسبة المعدل']] as const).map(([value, label]) => <button key={value} className={tab === value ? '' : 'secondary'} aria-pressed={tab === value} onClick={() => setTab(value)}>{label}</button>)}<button className="secondary" disabled={busy} onClick={() => action(load)}>تحديث البيانات</button></div>
    {error && <p className="error notice" role="alert">{error}</p>}
    {!data && !error && <p role="status">جارٍ تحميل حسابك…</p>}
    {data && <>
      <section className="stats" aria-label="تقدم الدراسة"><div className="card"><strong>{data.courses.length}</strong><span>المقررات</span></div><div className="card"><strong>{data.completed}</strong><span>شابترات تمت مراجعتها</span></div><div className="card"><strong>{data.progress}%</strong><span>التقدم العام</span></div></section>
      {nextCourse && nextChapter && <section className="focus"><div><small>خطوتك التالية</small><h2>{nextChapter.title}</h2><p>{nextCourse.name}</p></div><button onClick={() => { setTab('courses'); setSelected(nextCourse.id); setQuery(''); setFilter('pending'); setExpandedChapter(nextChapter.id); setReviewTarget(nextChapter.id); }}>فتح المراجعة</button></section>}
      {tab === 'courses' && <>
        <form className="card form" onSubmit={async e => { e.preventDefault(); if (await action(() => post('/study/courses', { name: courseName }))) setCourseName(''); }}><label>أضف مقرر<input required maxLength={80} value={courseName} onChange={e => setCourseName(e.target.value)} /></label><button disabled={busy || !courseName.trim()}>إضافة المقرر</button></form>
        {data.courses.length > 0 && <><div className="search-panel"><label htmlFor="course-search">البحث بالمقرر أو الشابتر</label><input id="course-search" type="search" value={query} onChange={e => setQuery(e.target.value)} /></div>
        <p role="status">عرض {visible.length} من {data.courses.length} مقررات</p></>}
        <section className="grid">{visible.map(c => <article className={`card course course-with-options ${selected === c.id ? 'active' : ''}`} key={c.id}>
          <button className="course-select" aria-pressed={selected === c.id} onClick={() => { setSelected(c.id); setFilter('all'); }}><h2>{c.name}</h2><p>{c.chapters.filter(ch => ch.reviewed).length} من {c.chapters.length} تمت مراجعتها</p></button>
          <details className="chapter-options"><summary aria-label={`خيارات المقرر ${c.name}`} title="خيارات المقرر"><span aria-hidden="true">⋯</span></summary><div className="chapter-options-content">
            <NameEditor value={c.name} label="اسم المقرر" maximum={80} disabled={busy} onSave={name => action(() => put(`/study/courses/${c.id}`, { name, version: c.version }))} />
            <button className="danger" disabled={busy} onClick={() => { if (confirm('حذف المقرر وكل شابتراته وملفاته ونتائجه؟ تبقى الأهداف والمهام مستقلة.')) action(() => remove(`/study/courses/${c.id}?version=${c.version}&confirm=true`)); }}>حذف المقرر</button>
          </div></details>
        </article>)}</section>
        {data.courses.length === 0 ? <p>أضف أول مقرر لتبدأ تنظيم شباترك.</p> : !visible.length && <p>لا توجد مقررات مطابقة. جرّب اسمًا آخر أو امسح البحث.</p>}
        {course && <section className="card details"><header className="course-details-header"><h2>{course.name}</h2></header>
          <div className="search-panel"><label>حالة المراجعة<select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}><option value="all">الكل</option><option value="pending">للمراجعة</option><option value="done">تمت المراجعة</option></select></label></div>
          {chapterIndexes.map(({ index }, position) => {
            const chapter = course.chapters[index];
            const expanded = expandedChapter === undefined ? position === 0 : expandedChapter === chapter.id;
            return <ChapterCard key={chapter.id} chapter={chapter} expanded={expanded} onToggle={() => setExpandedChapter(expanded ? null : chapter.id)} busy={busy} action={action} onChanged={load} />;
          })}
          {!addingChapter ? <button type="button" disabled={busy} onClick={() => setAddingChapter(true)}><span aria-hidden="true">＋</span> إضافة شابتر</button> : <form className="form" onSubmit={async e => {
            e.preventDefault();
            if (await action(async () => {
              const added = await post<{ id: string }>(`/study/courses/${course.id}/chapters`, { title: chapterName });
              setExpandedChapter(added.id); setFilter('all');
            })) { setChapterName(''); setAddingChapter(false); }
          }}><label><input autoFocus disabled={busy} aria-label="عنوان الشابتر الجديد" placeholder="اكتب عنوان الشابتر" required maxLength={100} value={chapterName} onChange={e => setChapterName(e.target.value)} /></label><div className="filter-buttons"><button disabled={busy || !chapterName.trim()}>حفظ الشابتر</button><button type="button" className="secondary" disabled={busy} onClick={() => { setAddingChapter(false); setChapterName(''); }}>إلغاء</button></div></form>}
        </section>}
      </>}
      {tab === 'goals' && <GoalPanel data={data} busy={busy} action={action} />}
      {tab === 'gpa' && <GpaPanel terms={terms} busy={busy} action={action} />}
    </>}
  </main>;
}

type Action = (work: () => Promise<unknown>) => Promise<boolean>;
function GoalPanel({ data, busy, action }: { data: Dashboard; busy: boolean; action: Action }) {
  const [title, setTitle] = useState(''); const [dueDate, setDueDate] = useState(''); const [courseId, setCourseId] = useState('');
  const [taskTitle, setTaskTitle] = useState(''); const [goalId, setGoalId] = useState('');
  const [taskDate, setTaskDate] = useState(''); const [taskCourse, setTaskCourse] = useState('');
  return <section>
    <h2>الأهداف والمهام</h2><p>إنجاز مهام الهدف يحدد تقدمه، دون تغيير درجات الاختبارات أو مراجعة الشابترات.</p>
    <form className="card form" onSubmit={async e => { e.preventDefault(); if (await action(() => post('/study/goals', { title, dueDate: dueDate || null, courseId: courseId || null }))) setTitle(''); }}>
      <label>عنوان الهدف<input required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} /></label><label>الموعد الاختياري<input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>
      <label>ربط بمقرر<select value={courseId} onChange={e => setCourseId(e.target.value)}><option value="">بدون ربط</option>{data.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button disabled={busy}>إضافة هدف</button>
    </form>
    {data.goals.map(g => <article className="card goal-card" key={g.id}><h3>{g.title}</h3><p>{g.dueDate ? `الموعد: ${g.dueDate}` : 'بدون موعد'} · {g.progress}%</p><progress value={g.progress} max={100} aria-label={`تقدم ${g.title}`} /><div className="actions">
      <PlanningEditor item={g} data={data} busy={busy} action={action} />
      {!data.tasks.some(t => t.goalId === g.id) && <button className="secondary" disabled={busy} onClick={() => action(() => put(`/study/goals/${g.id}`, { ...g, completed: !g.completed }))}>{g.completed ? 'إلغاء الإنجاز' : 'تم إنجاز الهدف'}</button>}
      <button className="danger" disabled={busy} onClick={() => { if (confirm('حذف الهدف ومهامه؟')) action(() => remove(`/study/goals/${g.id}?version=${g.version}&confirm=true`)); }}>حذف الهدف</button>
    </div></article>)}
    <form className="card form" onSubmit={async e => { e.preventDefault(); if (await action(() => post('/study/tasks', { title: taskTitle, goalId: goalId || null, courseId: taskCourse || null, dueDate: taskDate || null }))) setTaskTitle(''); }}><label>مهمة جديدة<input required maxLength={200} value={taskTitle} onChange={e => setTaskTitle(e.target.value)} /></label><label>الهدف<select value={goalId} onChange={e => setGoalId(e.target.value)}><option value="">مهمة مستقلة</option>{data.goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label><label>موعد المهمة<input type="date" value={taskDate} onChange={e => setTaskDate(e.target.value)} /></label><label>مقرر المهمة<select value={taskCourse} onChange={e => setTaskCourse(e.target.value)}><option value="">بدون ربط</option>{data.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button disabled={busy}>إضافة المهمة</button></form>
    {data.tasks.map(t => <article className="card goal-card" key={t.id}><label className="chapter"><input type="checkbox" checked={t.completed} disabled={busy} onChange={() => action(() => put(`/study/tasks/${t.id}`, { ...t, completed: !t.completed }))} /><span>{t.title}</span></label><p>{t.dueDate ? `الموعد: ${t.dueDate}` : 'بدون موعد'} · {data.courses.find(c => c.id === t.courseId)?.name ?? 'بدون مقرر'} · {data.goals.find(g => g.id === t.goalId)?.title ?? 'مهمة مستقلة'}</p><div className="actions"><PlanningEditor item={t} data={data} task busy={busy} action={action} /><button className="danger" disabled={busy} onClick={() => { if (confirm('حذف المهمة؟')) action(() => remove(`/study/tasks/${t.id}?version=${t.version}`)); }}>حذف</button></div></article>)}
  </section>;
}

function GpaPanel({ terms, busy, action }: { terms: Term[]; busy: boolean; action: Action }) {
  const [name, setName] = useState(''); const [priorGpa, setPriorGpa] = useState(''); const [priorCredits, setPriorCredits] = useState('');
  return <section><h2>حاسبة المعدل</h2><p>تقدير استرشادي بسلم جامعة حائل من 4. حالات الإعادة والتقديرات الخاصة غير مدعومة.</p>
    <form className="card form" onSubmit={async e => { e.preventDefault(); if (await action(() => post('/study/terms', { name, priorGpa: priorGpa === '' ? null : Number(priorGpa), priorCredits: priorCredits === '' ? null : Number(priorCredits) }))) { setName(''); setPriorGpa(''); setPriorCredits(''); } }}>
      <label>اسم الفصل<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label><label>المعدل السابق الاختياري<input type="number" min="0" max="4" step="0.0001" value={priorGpa} onChange={e => setPriorGpa(e.target.value)} /></label><label>الساعات السابقة<input type="number" min="0.01" max="10000" step="0.01" value={priorCredits} onChange={e => setPriorCredits(e.target.value)} /></label><button disabled={busy}>إضافة فصل</button>
    </form>
    {terms.map(t => <TermPanel key={t.id} term={t} busy={busy} action={action} />)}
  </section>;
}
function TermPanel({ term: t, busy, action }: { term: Term; busy: boolean; action: Action }) {
  const [name, setName] = useState(''); const [code, setCode] = useState(''); const [credits, setCredits] = useState('3'); const [grade, setGrade] = useState('A');
  return <article className="card goal-card"><h3>{t.name}</h3><p>الفصلي: {t.result.termGpa?.toFixed(2) ?? '—'} · التراكمي المتوقع: {t.result.cumulativeGpa?.toFixed(2) ?? '—'} · الساعات: {t.result.credits}</p>
    <p><a href={t.scale.sourceUrl} target="_blank" rel="noreferrer">مصدر سلم {t.scale.name}</a> · من {t.scale.maximum}</p>
    <div className="actions"><TermEditor term={t} busy={busy} action={action} /><button className="danger" disabled={busy} onClick={() => { if (confirm('حذف الفصل وكل مواده؟')) action(() => remove(`/study/terms/${t.id}?version=${t.version}&confirm=true`)); }}>حذف الفصل</button></div>
    {t.courses.map(c => <div className="grade-row" key={c.id}><strong>{c.name} <bdi>{c.code}</bdi></strong><span>{c.credits} ساعات</span><GradeEditor course={c} term={t} busy={busy} action={action} /><label>التقدير<select aria-label={`تقدير ${c.name}`} value={c.grade} disabled={busy} onChange={e => action(() => put(`/study/grade-courses/${c.id}`, { ...c, grade: e.target.value }))}>{Object.keys(t.scale.points).map(g => <option key={g}>{g}</option>)}</select></label><button className="danger" disabled={busy} onClick={() => { if (confirm('حذف المادة من الحاسبة؟')) action(() => remove(`/study/grade-courses/${c.id}?version=${c.version}`)); }}>حذف</button></div>)}
    <form className="form" onSubmit={async e => { e.preventDefault(); if (await action(() => post(`/study/terms/${t.id}/courses`, { name, code, credits: Number(credits), grade }))) { setName(''); setCode(''); } }}>
      <label>اسم المادة<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label><label>رمز المادة<input required maxLength={30} value={code} onChange={e => setCode(e.target.value)} /></label><label>الساعات<input required type="number" min="0.01" max="100" step="0.01" value={credits} onChange={e => setCredits(e.target.value)} /></label><label>التقدير<select value={grade} onChange={e => setGrade(e.target.value)}>{Object.keys(t.scale.points).map(g => <option key={g}>{g}</option>)}</select></label><button disabled={busy}>إضافة المادة</button>
    </form>
  </article>;
}
