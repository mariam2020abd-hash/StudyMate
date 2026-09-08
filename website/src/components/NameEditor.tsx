import { useState } from 'react';

export default function NameEditor({ value, label, maximum, onSave, disabled }: { value: string; label: string; maximum: number; onSave: (value: string) => Promise<boolean>; disabled: boolean }) {
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(value);
  return editing ? <form className="form inline-editor" onSubmit={async e => { e.preventDefault(); if (await onSave(draft.trim())) setEditing(false); }}>
    <label>{label}<input autoFocus required maxLength={maximum} value={draft} onChange={e => setDraft(e.target.value)} /></label>
    <div className="actions"><button disabled={disabled || !draft.trim()}>حفظ</button><button type="button" className="secondary" onClick={() => setEditing(false)}>إلغاء</button></div>
  </form> : <button className="secondary" disabled={disabled} onClick={() => { setDraft(value); setEditing(true); }}>تعديل {label}</button>;
}
