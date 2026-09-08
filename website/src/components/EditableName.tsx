import { useState } from 'react';

type Props = { value: string; label: string; maxLength: number; onSave: (value: string) => string | void };

export default function EditableName({ value, label, maxLength, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState('');
  if (!editing) return <button className="secondary" onClick={() => { setDraft(value); setError(''); setEditing(true); }}>تعديل {label}</button>;
  return <form className="form rename-form" onSubmit={event => {
    event.preventDefault();
    if (!draft.trim()) return setError('لا يمكن ترك الاسم فارغًا.');
    const message = onSave(draft.trim());
    if (message) return setError(message);
    setEditing(false);
  }}>
    <label>{label}<input autoFocus value={draft} onChange={event => setDraft(event.target.value)} maxLength={maxLength} aria-invalid={!!error} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="actions"><button type="submit">حفظ التعديل</button><button type="button" className="secondary" onClick={() => setEditing(false)}>إلغاء التعديل</button></div>
  </form>;
}
