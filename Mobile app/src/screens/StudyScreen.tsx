import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, RefreshControl, SafeAreaView, ScrollView, Switch, Text, View } from 'react-native';
import { api, ApiError, type Chapter, type Dashboard, type User } from '../api/client';
import { Button, Card, Field, ui } from '../components/Controls';
import PdfPanel from './PdfPanel';

const normalize = (text:string) => text.normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').toLocaleLowerCase().trim();
type Action = (work:()=>Promise<unknown>)=>Promise<boolean>;

export default function StudyScreen({user,onLogout,onExpired}:{user:User;onLogout:()=>Promise<void>;onExpired:()=>Promise<void>}){
  const [data,setData]=useState<Dashboard>(); const [selected,setSelected]=useState<string>();
  const [query,setQuery]=useState(''); const [chapterQuery,setChapterQuery]=useState('');const [filter,setFilter]=useState<'all'|'pending'|'done'>('all');
  const [courseName,setCourseName]=useState(''); const [chapterName,setChapterName]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const load=useCallback(async()=>{try{setData(await api<Dashboard>('/study/dashboard'));}catch(e){if(e instanceof ApiError&&e.status===401)await onExpired();throw e;}},[onExpired]);
  useEffect(()=>{load().catch(e=>setError(e.message));const subscription=AppState.addEventListener('change',state=>{if(state==='active')load().catch(e=>setError(e.message));});return()=>subscription.remove();},[load]);
  async function action(work:()=>Promise<unknown>){setBusy(true);setError('');try{await work();await load();return true;}catch(e){setError((e as Error).message);if(e instanceof ApiError&&e.status===409)await load().catch(()=>{});return false;}finally{setBusy(false);}}
  const course=data?.courses.find(c=>c.id===selected);
  const visible=data?.courses.filter(c=>normalize(c.name).includes(normalize(query))||c.chapters.some(ch=>normalize(ch.title).includes(normalize(query))))??[];
  const next=data?.courses.flatMap(c=>c.chapters.map(ch=>({chapter:ch,course:c}))).find(x=>x.chapter.id===data.nextChapterId);
  return <SafeAreaView style={ui.root}><ScrollView contentContainerStyle={ui.page} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={busy} onRefresh={()=>action(load)}/>}>
    <Text style={ui.title}>مساحتك الدراسية</Text><Text style={ui.text}>{user.email}</Text><Button title="تسجيل الخروج" secondary onPress={()=>onLogout().catch(e=>setError(e.message))}/>
    {!!error&&<Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    {!data&&!error&&<Text accessibilityLiveRegion="polite" style={ui.text}>جارٍ تحميل حسابك…</Text>}
    {data&&<>
      <Card><Text style={ui.heading}>{data.progress}% تقدم المراجعة</Text><Text style={ui.text}>{data.courses.length} مقررات · {data.completed} شابترات تمت مراجعتها</Text><Text style={ui.text}>درجات الاختبارات مستقلة عن تقدم المراجعة.</Text></Card>
      {next&&<Card><Text style={ui.heading}>خطوتك التالية</Text><Text style={ui.text}>{next.chapter.title} · {next.course.name}</Text><Button title="فتح المقرر" onPress={()=>setSelected(next.course.id)}/></Card>}
      <Card><Field label="مقرر جديد" value={courseName} onChangeText={setCourseName} maxLength={80}/><Button title="إضافة المقرر" disabled={busy||!courseName.trim()} onPress={async()=>{if(await action(()=>api('/study/courses','POST',{name:courseName})))setCourseName('');}}/></Card>
      <Field label="البحث بالمقرر أو الشابتر" value={query} onChangeText={setQuery}/>
      {visible.map(c=><Button secondary={selected!==c.id} key={c.id} title={`${c.name} · ${c.chapters.length} شابترات`} onPress={()=>{setSelected(c.id);setChapterQuery('');setFilter('all');}}/>)}
      {visible.length===0&&<Text style={ui.text}>لا توجد مقررات مطابقة.</Text>}
      {course&&<>
        <Text style={ui.title}>{course.name}</Text><Rename key={course.id} value={course.name} label="اسم المقرر" maximum={80} busy={busy} save={name=>action(()=>api(`/study/courses/${course.id}`,'PUT',{name,version:course.version}))}/>
        <Button title="حذف المقرر" secondary disabled={busy} onPress={()=>Alert.alert('حذف المقرر','سيُحذف المقرر وشابتراته وملفاته ومخرجاته ومحاولاته. تبقى الأهداف والمهام مستقلة.',[{text:'إلغاء',style:'cancel'},{text:'حذف',style:'destructive',onPress:()=>action(()=>api(`/study/courses/${course.id}?version=${course.version}&confirm=true`,'DELETE'))}])}/>
        <Field label="البحث في الشابترات" value={chapterQuery} onChangeText={setChapterQuery}/><View style={ui.row}>{(['all','pending','done']as const).map(f=><Button key={f} secondary={filter!==f} title={f==='all'?'الكل':f==='done'?'تمت المراجعة':'للمراجعة'} onPress={()=>setFilter(f)}/>)}</View>
        {course.chapters.filter(ch=>normalize(ch.title).includes(normalize(chapterQuery))&&(filter==='all'||ch.reviewed===(filter==='done'))).map(ch=><ChapterCard key={ch.id} chapter={ch} busy={busy} action={action} refresh={load}/>)}
        <Card><Field label="شابتر جديد" value={chapterName} onChangeText={setChapterName} maxLength={100}/><Button title="إضافة الشابتر" disabled={busy||!chapterName.trim()} onPress={async()=>{if(await action(()=>api(`/study/courses/${course.id}/chapters`,'POST',{title:chapterName})))setChapterName('');}}/></Card>
      </>}
    </>}
  </ScrollView></SafeAreaView>;
}
function Rename({value,label,maximum,busy,save}:{value:string;label:string;maximum:number;busy:boolean;save:(value:string)=>Promise<boolean>}){
  const [editing,setEditing]=useState(false);const [draft,setDraft]=useState(value);
  if(!editing)return <Button title={`تعديل ${label}`} secondary disabled={busy} onPress={()=>{setDraft(value);setEditing(true);}}/>;
  return <View style={{gap:10}}><Field label={label} value={draft} onChangeText={setDraft} maxLength={maximum}/><View style={ui.row}><Button title="حفظ" disabled={busy||!draft.trim()} onPress={async()=>{if(await save(draft))setEditing(false);}}/><Button title="إلغاء" secondary disabled={busy} onPress={()=>setEditing(false)}/></View></View>;
}
function ChapterCard({chapter:ch,busy,action,refresh}:{chapter:Chapter;busy:boolean;action:Action;refresh:()=>Promise<void>}){
  const [options,setOptions]=useState(false);const [file,setFile]=useState(false);
  return <Card><Text style={ui.heading}>{ch.title}</Text><View style={ui.row}><Switch accessibilityLabel={`تمت مراجعة ${ch.title}`} value={ch.reviewed} disabled={busy} onValueChange={reviewed=>void action(()=>api(`/study/chapters/${ch.id}`,'PUT',{title:ch.title,reviewed,version:ch.version}))}/><Text style={ui.text}>تمت المراجعة</Text></View>
    <Button title="خيارات الشابتر" secondary onPress={()=>setOptions(!options)}/>
    {options&&<><Rename value={ch.title} label="عنوان الشابتر" maximum={100} busy={busy} save={title=>action(()=>api(`/study/chapters/${ch.id}`,'PUT',{title,reviewed:ch.reviewed,version:ch.version}))}/><Button title="حذف الشابتر" secondary disabled={busy} onPress={()=>Alert.alert('حذف الشابتر','سيُحذف الملف والمخرجات والمحاولات المرتبطة به.',[{text:'إلغاء',style:'cancel'},{text:'حذف',style:'destructive',onPress:()=>action(()=>api(`/study/chapters/${ch.id}?version=${ch.version}&confirm=true`,'DELETE'))}])}/></>}
    <Button title="ملف الشابتر" secondary onPress={()=>setFile(!file)}/>{file&&<PdfPanel chapter={ch} onChanged={refresh}/>}
  </Card>;
}
