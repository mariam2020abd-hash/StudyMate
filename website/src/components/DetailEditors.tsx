import { useState } from 'react';
import { put, type Dashboard, type Goal, type Task, type Term, type GradeCourse } from '../api/client';
type Action = (work: () => Promise<unknown>) => Promise<boolean>;

export function PlanningEditor({ item, data, task, busy, action }: { item: Goal | Task; data: Dashboard; task?: boolean; busy: boolean; action: Action }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ title: item.title, dueDate: item.dueDate ?? '', courseId: item.courseId ?? '', goalId: 'goalId' in item ? item.goalId ?? '' : '', version: item.version });
  function edit() { setDraft({ title: item.title, dueDate: item.dueDate ?? '', courseId: item.courseId ?? '', goalId: 'goalId' in item ? item.goalId ?? '' : '', version: item.version }); setOpen(true); }
  if (!open) return <button className="secondary" disabled={busy} onClick={edit}>تعديل تفاصيل {task ? 'المهمة' : 'الهدف'}</button>;
  return <form className="form detail-editor" onSubmit={async e => { e.preventDefault(); if (await action(() => put(`/study/${task ? 'tasks' : 'goals'}/${item.id}`, { ...item, ...draft, dueDate: draft.dueDate || null, courseId: draft.courseId || null, ...(task ? { goalId: draft.goalId || null } : {}) }))) setOpen(false); }}>
    {draft.version !== item.version && <p role="alert">تغيرت البيانات أثناء التعديل. ألغِ التعديل وأعد فتحه لمراجعة أحدث نسخة.</p>}
    <label>العنوان<input required maxLength={200} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })}/></label>
    <label>الموعد الاختياري<input type="date" value={draft.dueDate} onChange={e => setDraft({ ...draft, dueDate: e.target.value })}/></label>
    <label>المقرر<select value={draft.courseId} onChange={e => setDraft({ ...draft, courseId: e.target.value })}><option value="">بدون ربط</option>{data.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    {task && <label>الهدف<select value={draft.goalId} onChange={e => setDraft({ ...draft, goalId: e.target.value })}><option value="">مهمة مستقلة</option>{data.goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>}
    <div className="actions"><button disabled={busy || draft.version !== item.version}>حفظ التفاصيل</button><button type="button" className="secondary" disabled={busy} onClick={() => setOpen(false)}>إلغاء</button></div>
  </form>;
}

export function TermEditor({ term, busy, action }: { term: Term; busy: boolean; action: Action }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: term.name, gpa: String(term.priorGpa ?? ''), credits: String(term.priorCredits ?? ''), version: term.version });
  if (!open) return <button className="secondary" disabled={busy} onClick={() => { setDraft({ name: term.name, gpa: String(term.priorGpa ?? ''), credits: String(term.priorCredits ?? ''), version: term.version }); setOpen(true); }}>تعديل بيانات الفصل والمعدل السابق</button>;
  return <form className="form detail-editor" onSubmit={async e => { e.preventDefault(); if (await action(() => put(`/study/terms/${term.id}`, { name: draft.name, priorGpa: draft.gpa === '' ? null : Number(draft.gpa), priorCredits: draft.credits === '' ? null : Number(draft.credits), version: draft.version }))) setOpen(false); }}>
    {draft.version !== term.version && <p role="alert">تغير الفصل أثناء التعديل. ألغِ التعديل وأعد فتحه.</p>}
    <label>اسم الفصل<input required maxLength={100} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}/></label>
    <label>المعدل السابق<input required={draft.credits !== ''} type="number" min="0" max={term.scale.maximum} step="0.0001" value={draft.gpa} onChange={e => setDraft({ ...draft, gpa: e.target.value })}/></label>
    <label>الساعات السابقة<input required={draft.gpa !== ''} type="number" min="0.01" max="10000" step="0.01" value={draft.credits} onChange={e => setDraft({ ...draft, credits: e.target.value })}/></label>
    <p>اترك الحقلين فارغين لحساب هذا الفصل فقط.</p><div className="actions"><button disabled={busy || draft.version !== term.version}>حفظ بيانات الفصل</button><button type="button" className="secondary" disabled={busy} onClick={() => setOpen(false)}>إلغاء</button></div>
  </form>;
}

export function GradeEditor({ course, term, busy, action }: { course: GradeCourse; term: Term; busy: boolean; action: Action }) {
  const [open, setOpen] = useState(false); const [draft, setDraft] = useState({ ...course, credits: String(course.credits) });
  if (!open) return <button className="secondary" disabled={busy} onClick={() => { setDraft({ ...course, credits: String(course.credits) }); setOpen(true); }}>تعديل المادة</button>;
  return <form className="form detail-editor" onSubmit={async e => { e.preventDefault(); if (await action(() => put(`/study/grade-courses/${course.id}`, { ...draft, credits: Number(draft.credits) }))) setOpen(false); }}>
    {draft.version !== course.version && <p role="alert">تغيرت المادة أثناء التعديل. ألغِ التعديل وأعد فتحه.</p>}
    <label>اسم المادة<input required maxLength={100} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}/></label>
    <label>رمز المادة<input required maxLength={30} value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })}/></label>
    <label>الساعات<input required type="number" min="0.01" max="100" step="0.01" value={draft.credits} onChange={e => setDraft({ ...draft, credits: e.target.value })}/></label>
    <label>التقدير<select value={draft.grade} onChange={e => setDraft({ ...draft, grade: e.target.value })}>{Object.keys(term.scale.points).map(g => <option key={g}>{g}</option>)}</select></label>
    <div className="actions"><button disabled={busy || draft.version !== course.version}>حفظ المادة</button><button type="button" className="secondary" disabled={busy} onClick={() => setOpen(false)}>إلغاء</button></div>
  </form>;
}
