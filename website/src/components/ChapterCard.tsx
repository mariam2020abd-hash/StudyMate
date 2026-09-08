import { useState } from 'react';
import { put, remove, type Chapter } from '../api/client';
import NameEditor from './NameEditor';
import ChapterFile from './ChapterFile';
import StudyContent from './StudyContent';

type Panel = 'file' | 'explanation' | 'summary' | 'quiz';
const panels: { id: Panel; title: string; description: string; icon: string }[] = [
  { id: 'file', title: 'ملف الشابتر', description: 'رفع الملف وقراءة النص', icon: 'PDF' },
  { id: 'explanation', title: 'الشرح', description: 'فهم المفاهيم بالتفصيل', icon: '01' },
  { id: 'summary', title: 'الملخص', description: 'أهم النقاط للمراجعة', icon: '02' },
  { id: 'quiz', title: 'الاختبار', description: 'تدرّب وراجع إجاباتك', icon: '03' },
];

export default function ChapterCard({ chapter: ch, busy, action, onChanged }: {
  chapter: Chapter; busy: boolean; action: (work: () => Promise<unknown>) => Promise<boolean>; onChanged: () => Promise<void>;
}) {
  const [active, setActive] = useState<Panel>('file');
  const [visited, setVisited] = useState<Panel[]>(['file']);
  function select(panel: Panel) {
    setActive(panel); setVisited(previous => previous.includes(panel) ? previous : [...previous, panel]);
  }
  return <article className="chapter-card" aria-labelledby={`chapter-title-${ch.id}`}>
    <header className="chapter-card-header">
      <div className="chapter-heading"><span className="kicker">الشابتر</span><h3 id={`chapter-title-${ch.id}`} dir="auto">{ch.title}</h3>
        <label className="chapter-review"><input type="checkbox" disabled={busy} checked={ch.reviewed}
          onChange={() => action(() => put(`/study/chapters/${ch.id}`, { title: ch.title, reviewed: !ch.reviewed, version: ch.version }))} />تمت المراجعة</label>
      </div>
      <details className="chapter-options"><summary aria-label={`خيارات الشابتر ${ch.title}`}>خيارات <span aria-hidden="true">⋯</span></summary>
        <div className="chapter-options-content">
          <NameEditor label="عنوان الشابتر" value={ch.title} maximum={100} disabled={busy}
            onSave={title => action(() => put(`/study/chapters/${ch.id}`, { title, reviewed: ch.reviewed, version: ch.version }))} />
          <button className="danger" disabled={busy} onClick={() => { if (confirm('حذف الشابتر وملفه ومخرجاته ومحاولاته؟')) action(() => remove(`/study/chapters/${ch.id}?version=${ch.version}&confirm=true`)); }}>حذف الشابتر</button>
        </div>
      </details>
    </header>
    <div className="chapter-tools" role="group" aria-label={`محتوى ${ch.title}`}>
      {panels.map(panel => <button key={panel.id} className={`chapter-tool ${active === panel.id ? 'selected' : ''}`} aria-pressed={active === panel.id}
        aria-controls={`chapter-panel-${ch.id}-${panel.id}`} onClick={() => select(panel.id)}>
        <span className="chapter-tool-icon" aria-hidden="true">{panel.icon}</span><strong>{panel.title}</strong><span>{panel.description}</span>
      </button>)}
    </div>
    {panels.map(panel => <div key={panel.id} id={`chapter-panel-${ch.id}-${panel.id}`} className="chapter-panel" hidden={active !== panel.id}>
      {visited.includes(panel.id) && (panel.id === 'file'
        ? <ChapterFile chapterId={ch.id} version={ch.version} onChanged={onChanged} />
        : <StudyContent chapterId={ch.id} ready={ch.status === 'ready'} contentKind={panel.id} />)}
    </div>)}
  </article>;
}
