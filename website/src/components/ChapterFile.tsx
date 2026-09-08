import { useEffect, useState } from 'react';
import { api, post } from '../api/client';

type Source = { id: string; status: string; errorCode: string | null; pageCount: number; byteCount: number; chapterVersion: number };
type UploadLimits = { maxPdfBytes: number; maxPdfPages: number; generationAvailable: boolean };
const failures: Record<string, string> = {
  pdf_protected: 'الملف محمي. أضف شابترًا جديدًا بملف غير محمي.',
  pdf_page_limit: 'عدد صفحات الملف يتجاوز الحد المسموح.',
  pdf_corrupt: 'الملف تالف أو تعذّر قراءته.',
  pdf_no_text: 'لا يحتوي الملف على نص قابل للاستخراج.',
  pdf_ocr_required: 'يحتوي الملف على صفحات مصوّرة تحتاج OCR، وهي غير مدعومة حاليًا.',
  extraction_failed: 'تعذّر استخراج النص. يمكنك إعادة المحاولة.',
  extraction_timeout: 'انتهت مهلة المعالجة. يمكنك إعادة المحاولة.',
};

export default function ChapterFile({ chapterId, version, onChanged }: { chapterId: string; version: number; onChanged: () => Promise<void> }) {
  const [source, setSource] = useState<Source | null>();
  const [limits, setLimits] = useState<UploadLimits>();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [pages, setPages] = useState<{ number: number; text: string }[]>();
  const path = `/study/chapters/${chapterId}/source`;
  useEffect(() => {
    let disposed = false; let timer: ReturnType<typeof setTimeout>;
    let previousStatus: string | undefined;
    async function poll() {
      try {
        const next = await api<Source | null>(path);
        if (disposed) return;
        setSource(next);
        if ((previousStatus && previousStatus !== next?.status) || (next && next.chapterVersion !== version)) await onChanged();
        previousStatus = next?.status;
        if (next && ['queued', 'processing'].includes(next.status)) timer = setTimeout(poll, 2000);
      } catch (err) { if (!disposed) setError((err as Error).message); }
    }
    poll(); api<UploadLimits>('/study/upload-limits').then(v => { if (!disposed) setLimits(v); }).catch(err => { if (!disposed) setError(err.message); });
    return () => { disposed = true; clearTimeout(timer); };
  }, [path, version, onChanged]);
  async function upload() {
    if (!file || !limits) return;
    if (file.size > limits.maxPdfBytes) { setError('حجم الملف يتجاوز الحد المسموح.'); return; }
    setBusy(true); setError('');
    try {
      await api(path + `?version=${version}`, { method: 'POST', body: file, headers: { 'Content-Type': 'application/pdf' } });
      setFile(null); await onChanged(); setSource(await api<Source>(path));
    } catch (err) { setError((err as Error).message); await onChanged().catch(() => {}); }
    finally { setBusy(false); }
  }
  return <section className="chapter-file" aria-label="ملف الشابتر">
    {limits?.generationAvailable === false && <p role="status">خدمة توليد الشرح والملخص والاختبار غير مفعّلة حاليًا. يمكنك رفع الملف وقراءة نصه، ولن تُستهلك حصة توليد.</p>}
    {source?.status === 'ready' && limits?.generationAvailable && <p>اكتمل استخراج النص. اختر بطاقة الشرح أو الملخص أو الاختبار أعلاه، ثم اضغط «توليد».</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {source === undefined && <p role="status">جارٍ التحقق من ملف الشابتر…</p>}
    {source === null && <form className="form" onSubmit={e => { e.preventDefault(); upload(); }}>
      <label>ملف PDF نصي عربي أو إنجليزي<input type="file" accept="application/pdf,.pdf" required disabled={busy} onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      {limits && <p>حتى {limits.maxPdfBytes / 1_000_000} MB و{limits.maxPdfPages} صفحة. لا يمكن استبدال ملف الشابتر بعد رفعه.</p>}
      <button disabled={busy || !file || !limits}>{busy ? 'جارٍ الرفع…' : 'رفع الملف'}</button>
    </form>}
    {source && <>
      {['queued', 'processing'].includes(source.status) && <p role="status">جارٍ استخراج نص الشابتر… يمكنك العودة لاحقًا.</p>}
      {source.status === 'failed' && <p role="alert">{failures[source.errorCode ?? ''] ?? 'تعذّرت معالجة الملف.'}</p>}
      {source.status === 'failed' && ['extraction_failed', 'extraction_timeout'].includes(source.errorCode ?? '') && <button disabled={busy} onClick={async () => { setBusy(true); try { await post(path + '/retry', {}); await onChanged(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }}>إعادة المعالجة</button>}
      {source.status === 'ready' && <><p>النص جاهز · {source.pageCount} صفحة · {(source.byteCount / 1_000_000).toFixed(2)} MB</p><button className="secondary" onClick={async () => { try { setPages(pages ? undefined : await api(path + '/pages')); } catch (err) { setError((err as Error).message); } }}>{pages ? 'إخفاء النص' : 'عرض النص المستخرج'}</button></>}
      {pages && <div className="source-pages">{pages.map(p => <article key={p.number}><h4>صفحة {p.number}</h4><p dir="auto" style={{ whiteSpace: 'pre-wrap' }}>{p.text || 'صفحة فارغة'}</p></article>)}</div>}
    </>}
  </section>;
}
