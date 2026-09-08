import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import { api, apiUrl, authHeaders, readResponse, type Chapter } from '../api/client';
import { Button, ui } from '../components/Controls';

type Source={status:string;errorCode:string|null;pageCount:number;chapterVersion:number};
type Limits={maxPdfBytes:number;maxPdfPages:number;generationAvailable:boolean};
const failures:Record<string,string>={pdf_protected:'الملف محمي.',pdf_corrupt:'الملف تالف أو تعذّر قراءته.',pdf_page_limit:'عدد الصفحات يتجاوز الحد.',pdf_no_text:'لا يحتوي الملف على نص قابل للاستخراج.',pdf_ocr_required:'الملف مصوّر ويحتاج OCR غير المدعوم حاليًا.'};
export default function PdfPanel({chapter,onChanged}:{chapter:Chapter;onChanged:()=>Promise<void>}){
  const [source,setSource]=useState<Source|null>();const [limits,setLimits]=useState<Limits>();const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [pages,setPages]=useState<{number:number;text:string}[]>();
  const path=`/study/chapters/${chapter.id}/source`;
  useEffect(()=>{let active=true;let timer:ReturnType<typeof setTimeout>;
    async function poll(){try{const next=await api<Source|null>(path);if(!active)return;setSource(next);if(next&&next.chapterVersion!==chapter.version)await onChanged();if(next&&['queued','processing'].includes(next.status))timer=setTimeout(poll,2000);}catch(e){if(active)setError((e as Error).message);}}
    poll();api<Limits>('/study/upload-limits').then(v=>{if(active)setLimits(v);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;clearTimeout(timer);};
  },[path,chapter.version,onChanged]);
  async function upload(){
    setBusy(true);setError('');let cached:File|undefined;
    try{const picked=await DocumentPicker.getDocumentAsync({type:'application/pdf',multiple:false,copyToCacheDirectory:true});if(picked.canceled)return;
      cached=new File(picked.assets[0].uri);if(!limits||cached.size>limits.maxPdfBytes)throw new Error('حجم الملف يتجاوز الحد المسموح.');
      const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),120000);
      try{await readResponse(await expoFetch(apiUrl(path+`?version=${chapter.version}`),{method:'POST',headers:{...authHeaders(),'Content-Type':'application/pdf'},body:cached,signal:controller.signal}) as unknown as Response);}
      finally{clearTimeout(timeout);}
      await onChanged();setSource(await api<Source>(path));
    }catch(e){setError((e as Error).message);await onChanged().catch(()=>{});}finally{
      if(cached&&cached.uri.startsWith(Paths.cache.uri)&&cached.exists){try{cached.delete();}catch{/* OS may already have removed its cache. */}}
      setBusy(false);
    }
  }
  return <View style={{gap:12}}>
    {!!error&&<Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    {limits&&!limits.generationAvailable&&<Text style={ui.text}>التوليد غير مفعّل حاليًا. يمكنك رفع الملف وقراءة نصه.</Text>}
    {source===undefined&&<Text style={ui.text}>جارٍ تحميل حالة الملف…</Text>}
    {source===null&&<><Text style={ui.text}>PDF نصي عربي أو إنجليزي، حتى {limits?limits.maxPdfBytes/1000000:'—'} MB و{limits?.maxPdfPages??'—'} صفحة. لا يمكن استبداله بعد الرفع.</Text><Button title={busy?'جارٍ الرفع…':'اختيار ورفع PDF'} disabled={busy||!limits} onPress={upload}/></>}
    {source&&['queued','processing'].includes(source.status)&&<Text accessibilityLiveRegion="polite" style={ui.text}>جارٍ استخراج النص… يمكنك العودة لاحقًا.</Text>}
    {source?.status==='failed'&&<Text style={ui.error}>{failures[source.errorCode??'']??'تعذّرت المعالجة.'}</Text>}
    {source?.status==='ready'&&<><Text style={ui.text}>النص جاهز · {source.pageCount} صفحة</Text><Button title={pages?'إخفاء النص':'عرض النص'} secondary onPress={async()=>{try{setPages(pages?undefined:await api(path+'/pages'));}catch(e){setError((e as Error).message);}}}/></>}
    {pages?.map(p=><View key={p.number}><Text style={ui.heading}>صفحة {p.number}</Text><Text selectable style={ui.text}>{p.text||'صفحة فارغة'}</Text></View>)}
  </View>;
}
