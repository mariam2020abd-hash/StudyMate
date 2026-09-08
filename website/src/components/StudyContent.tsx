import { useEffect, useRef, useState } from 'react';
import { api, post, put } from '../api/client';

type Kind = 'explanation' | 'summary' | 'quiz';
type Citation = { page: number; quote: string };
type Question = { id: number; kind: string; prompt: string; choices: string[] };
type Job = { id: string; kind: Kind; language: string; status: string; errorCode: string | null; createdAt: string;
  result?: { sections?: { title: string; body: string; citations: Citation[] }[]; questions?: Question[] } | null };
type Quota = { remaining: number; used: number; reserved: number; limit: number; resetsAt: string; generationAvailable: boolean };
type Attempt = { id: string; jobId: string; version: number; submittedAt: string | null; createdAt: string; correctCount: number | null; total: number;
  answers: Record<string, number | null>; questions: Question[]; review: { id: number; correctIndex: number; explanation: string; isCorrect: boolean; citations: Citation[] }[] | null };
const labels: Record<Kind, string> = { explanation: 'الشرح', summary: 'الملخص', quiz: 'الاختبار' };
const errors: Record<string, string> = { insufficient_content: 'محتوى الشابتر لا يكفي لإنتاج المطلوب. لم تُستهلك الحصة.',
  generation_timeout: 'انتهت مهلة التوليد. لم تُستهلك الحصة؛ يمكنك المحاولة مجددًا.', generation_refused: 'تعذّر توليد هذا المحتوى. لم تُستهلك الحصة.',
  invalid_generation: 'لم تجتز النتيجة فحص الجودة. يمكنك إعادة المحاولة.', invalid_citations: 'تعذّر التحقق من مراجع النتيجة. يمكنك إعادة المحاولة.',
  provider_busy: 'خدمة التوليد مشغولة. حاول مجددًا بعد قليل.' };

function Citations({ items }: { items: Citation[] }) {
  return <details><summary>مراجع الشابتر</summary>{items.map((c,i) => <blockquote key={i}><strong>صفحة {c.page}</strong><p dir="auto">{c.quote}</p></blockquote>)}</details>;
}

export default function StudyContent({ chapterId, ready, contentKind: kind }: { chapterId: string; ready: boolean; contentKind: Kind }) {
  const [language,setLanguage]=useState('ar');
  const [jobs,setJobs]=useState<Job[]>([]); const [job,setJob]=useState<Job>(); const [quota,setQuota]=useState<Quota>();
  const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  const root=`/study/chapters/${chapterId}/generations`;
  useEffect(()=>{
    let active=true; setJob(undefined); setError('');
    Promise.all([api<Job[]>(root),api<Quota>('/study/quota')]).then(async ([list,q])=>{
      if(!active)return; setJobs(list);setQuota(q);
      const latest=list.find(j=>j.kind===kind&&j.language===language);
      if(latest){const detail=await api<Job>(`/study/generations/${latest.id}`);if(active)setJob(detail);}
    }).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[root,kind,language]);
  useEffect(()=>{
    if(!job||!['queued','running'].includes(job.status))return;
    let active=true; const id=job.id;
    const timer=setInterval(async()=>{
      try{
        const next=await api<Job>(`/study/generations/${id}`);if(!active)return;setJob(next);
        if(!['queued','running'].includes(next.status)){
          const [list,q]=await Promise.all([api<Job[]>(root),api<Quota>('/study/quota')]);if(active){setJobs(list);setQuota(q);}
        }
      }catch(e){if(active)setError((e as Error).message);}
    },2000);
    return()=>{active=false;clearInterval(timer);};
  },[job?.id,job?.status,root]);
  async function generate(){
    setBusy(true);setError('');
    const storageKey=`studymate.request.${chapterId}.${kind}.${language}`;
    const requestKey=sessionStorage.getItem(storageKey)??crypto.randomUUID();sessionStorage.setItem(storageKey,requestKey);
    try{
      const next=await post<Job>(root,{kind,language,requestKey}); sessionStorage.removeItem(storageKey);setJob(next);
      setJobs(await api<Job[]>(root));setQuota(await api<Quota>('/study/quota'));
    }catch(e){setError((e as Error).message);}
    finally{setBusy(false);}
  }
  return <section className="study-content" aria-label="المساعدة الدراسية">
    <h4>{labels[kind]}</h4>
    <label>لغة المحتوى<select value={language} onChange={e=>setLanguage(e.target.value)}><option value="ar">العربية</option><option value="en">English</option></select></label>
    {quota&&<p>متبقي {quota.remaining} من {quota.limit} طلبات اليوم · {quota.reserved} قيد المعالجة. تتجدد الحصة عند منتصف الليل بتوقيت الرياض.</p>}
    <p>يمكنك التنقل وقراءة المخرجات السابقة وإعادة الاختبار دون استهلاك حصة جديدة.</p>
    {!ready&&<p>ارفع ملف الشابتر وانتظر جاهزية النص أولًا.</p>}
    {quota?.generationAvailable===false&&<p role="status">خدمة التوليد غير مفعّلة حاليًا. ستتاح طلبات جديدة بعد تفعيل الخدمة، وتبقى المخرجات السابقة متاحة.</p>}
    <button disabled={!ready||busy||!quota?.generationAvailable||quota.remaining===0||!!job&&['queued','running'].includes(job.status)} onClick={generate}>{busy?'جارٍ إرسال الطلب…':`توليد ${labels[kind]}${job?' جديد':''}`}</button>
    {error&&<p className="error" role="alert">{error}</p>}
    {jobs.some(j=>j.kind===kind&&j.language===language)&&<label>المخرجات السابقة<select value={job?.id??''} onChange={async e=>{try{setJob(await api<Job>(`/study/generations/${e.target.value}`));}catch(err){setError((err as Error).message);}}}><option value="" disabled>اختر نتيجة</option>{jobs.filter(j=>j.kind===kind&&j.language===language).map(j=><option key={j.id} value={j.id}>{new Date(j.createdAt).toLocaleString('ar-SA')} · {j.status==='completed'?'مكتمل':j.status==='failed'?'تعذّر التوليد':'قيد المعالجة'}</option>)}</select></label>}
    {job&&['queued','running'].includes(job.status)&&<p role="status">جارٍ التوليد… سيُحفظ الطلب في حسابك ويمكنك العودة إليه لاحقًا.</p>}
    {job?.status==='failed'&&<p role="alert">{errors[job.errorCode??'']??'تعذّر التوليد. لم تُستهلك الحصة؛ يمكنك إعادة المحاولة.'}</p>}
    {job?.status==='completed'&&job.result?.sections?.map((section,i)=><article key={`${job.id}.${i}`} dir={language==='ar'?'rtl':'ltr'}><h4>{section.title}</h4><p style={{whiteSpace:'pre-wrap'}}>{section.body}</p><Citations items={section.citations}/></article>)}
    {job?.status==='completed'&&job.kind==='quiz'&&<QuizPanel key={job.id} jobId={job.id}/>}
  </section>;
}

function QuizPanel({jobId}:{jobId:string}){
  const [attempt,setAttempt]=useState<Attempt>(); const [history,setHistory]=useState<Attempt[]>([]);
  const [answers,setAnswers]=useState<Record<string,number|null>>({}); const [error,setError]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);
  const createKey=useRef<string|undefined>(undefined);const submitKey=useRef<string|undefined>(undefined);
  const root=`/study/generations/${jobId}/attempts`;
  useEffect(()=>{api<Attempt[]>(root).then(setHistory).catch(e=>setError(e.message));},[root]);
  function show(a:Attempt){setAttempt(a);setAnswers(a.answers);setNotice('');}
  async function start(){
    setBusy(true);setError('');createKey.current??=crypto.randomUUID();
    try{show(await post<Attempt>(root,{requestKey:createKey.current}));createKey.current=undefined;submitKey.current=undefined;setHistory(await api<Attempt[]>(root));}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function save():Promise<Attempt>{
    const next=await put<Attempt>(`/study/attempts/${attempt!.id}/answers`,{answers,version:attempt!.version});show(next);return next;
  }
  async function submit(){
    if(!attempt)return;
    const missing=attempt.questions.some(q=>answers[q.id]===undefined||answers[q.id]===null);
    if(missing&&!confirm('توجد أسئلة دون إجابة. تسليم المحاولة واحتسابها بإجابات خاطئة؟'))return;
    setBusy(true);setError('');
    try{
      let latest=await api<Attempt>(`/study/attempts/${attempt.id}`);
      if(latest.submittedAt){show(latest);return;}
      latest=await save(); submitKey.current??=crypto.randomUUID();
      show(await post<Attempt>(`/study/attempts/${attempt.id}/submit`,{requestKey:submitKey.current,version:latest.version,confirmUnanswered:missing}));
      setHistory(await api<Attempt[]>(root));
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <section aria-label="محاولات الاختبار"><h4>التدريب</h4><button disabled={busy} onClick={start}>{history.length?'بدء محاولة جديدة':'بدء الاختبار'}</button>
    {history.length>0&&<label>المحاولات المحفوظة<select disabled={busy} value={attempt?.id??''} onChange={async e=>{try{show(await api<Attempt>(`/study/attempts/${e.target.value}`));submitKey.current=undefined;}catch(err){setError((err as Error).message);}}}><option value="" disabled>اختر محاولة</option>{history.map(a=><option key={a.id} value={a.id}>{new Date(a.createdAt).toLocaleString('ar-SA')} · {a.submittedAt?`${a.correctCount}/${a.total}`:'لم تُسلّم'}</option>)}</select></label>}
    {error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {attempt&&<>
      {attempt.submittedAt&&<p role="status">النتيجة: {attempt.correctCount} من {attempt.total}. درجات الاختبار مستقلة عن تقدم المراجعة.</p>}
      {attempt.questions.map(q=>{const review=attempt.review?.find(r=>r.id===q.id);return <fieldset key={q.id} disabled={busy||!!attempt.submittedAt}><legend dir="auto">{q.id+1}. {q.prompt}</legend>{q.choices.map((choice,i)=><label className="quiz-choice" key={i}><input type="radio" name={`${attempt.id}.${q.id}`} checked={answers[q.id]===i} onChange={()=>setAnswers(previous=>({...previous,[q.id]:i}))}/><span dir="auto">{choice}</span></label>)}{review&&<div><strong>{review.isCorrect?'إجابة صحيحة':`الإجابة الصحيحة: ${q.choices[review.correctIndex]}`}</strong><p dir="auto">{review.explanation}</p><Citations items={review.citations}/></div>}</fieldset>;})}
      {!attempt.submittedAt&&<div className="actions"><button className="secondary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await save();setNotice('تم حفظ الإجابات. يمكنك إكمال المحاولة لاحقًا.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>حفظ الإجابات</button><button disabled={busy} onClick={submit}>تسليم وتصحيح الاختبار</button></div>}
    </>}
  </section>;
}
