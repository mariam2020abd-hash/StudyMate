import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useDashboard } from '../../hooks/useDashboard';
import { styles as s } from './DashboardScreen.styles';

export default function DashboardScreen({ onBack }: { onBack: () => void }) {
  const compact = useWindowDimensions().width < 760;
  const { courses, setCourses, selected, setSelected, adding, setAdding, name, setName, chapterName, setChapterName, error, setError, completed, progress, course, nextCourse, nextChapter, addCourse } = useDashboard();

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.nav}>
          <Text style={s.brand}>StudyMate <Text style={s.brandDot}>●</Text></Text>
          <Pressable accessibilityRole="button" onPress={onBack} style={s.secondary}><Text style={s.secondaryText}>الصفحة الرئيسية ←</Text></Pressable>
        </View>
        <View style={s.notice}><Text style={s.small}>مساحة تجريبية • البيانات للتجربة، والتغييرات متاحة حتى مغادرة اللوحة أو إعادة تحميل التطبيق.</Text></View>
        <Text style={s.kicker}>مساحتك الدراسية</Text>
        <Text style={s.title}>كل خطوة تقرّبك.</Text>
        <Text style={s.subtitle}>رتّب مقرراتك، واختر شابترًا واحدًا تبدأ به اليوم.</Text>

        <View style={[s.row, compact && s.column]}>
          {[['المقررات', courses.length], ['شابترات تمت مراجعتها', completed], ['التقدم العام', `${progress}%`]].map(([label, value]) => (
            <View style={s.stat} key={label}><Text style={s.value}>{value}</Text><Text style={s.small}>{label}</Text></View>
          ))}
        </View>

        <View style={[s.focus, compact && s.column]}>
          <View style={s.flex}>
            <Text style={s.focusLabel}>خطوتك التالية</Text>
            <Text style={s.focusTitle}>{nextChapter?.title ?? 'أنجزت كل الشابترات المضافة!'}</Text>
            <Text style={s.focusDescription}>{nextCourse?.name ?? 'أضف شابترًا جديدًا لتكمل رحلتك.'}</Text>
          </View>
          {nextCourse && <Pressable accessibilityRole="button" style={s.primary} onPress={() => setSelected(nextCourse.id)}><Text style={s.primaryText}>ابدأ المراجعة ←</Text></Pressable>}
        </View>

        <View style={s.sectionHead}>
          <Text style={s.heading}>مقرراتي</Text>
          <Pressable accessibilityRole="button" style={s.secondary} onPress={() => { setAdding(!adding); setError(''); }}><Text style={s.secondaryText}>{adding ? 'إلغاء' : '+ إضافة مقرر'}</Text></Pressable>
        </View>
        {adding && <View style={s.card}>
          <Text style={s.label}>اسم المقرر</Text>
          <TextInput accessibilityLabel="اسم المقرر" value={name} onChangeText={setName} placeholder="مثل: قواعد البيانات" placeholderTextColor="#81798B" style={s.input} maxLength={80} onSubmitEditing={addCourse} />
          {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
          <Pressable accessibilityRole="button" style={s.primary} onPress={addCourse}><Text style={s.primaryText}>حفظ المقرر</Text></Pressable>
        </View>}
        <View style={[s.row, compact && s.column]}>
          {courses.map(item => {
            const done = item.chapters.filter(chapter => chapter.done).length;
            const percent = item.chapters.length ? Math.round(done / item.chapters.length * 100) : 0;
            return <Pressable accessibilityRole="button" accessibilityState={{ selected: selected === item.id }} accessibilityLabel={`فتح ${item.name}`} key={item.id} style={[s.course, selected === item.id && s.active]} onPress={() => { setSelected(item.id); setChapterName(''); }}>
              <Text style={s.courseIcon}>▤</Text><Text style={s.courseTitle}>{item.name}</Text>
              <Text style={s.small}>{done} من {item.chapters.length} شابترات مكتملة</Text>
              <View style={s.track}><View style={[s.fill, { width: `${percent}%` }]} /></View>
              <Text style={s.link}>عرض الشابترات ←</Text>
            </Pressable>;
          })}
        </View>

        {course && <View style={s.card}>
          <View style={s.sectionHead}><Text style={s.heading}>{course.name}</Text><Pressable accessibilityRole="button" onPress={() => setSelected(null)}><Text style={s.link}>إغلاق</Text></Pressable></View>
          <Text style={s.small}>حدّد الشابترات التي راجعتها لتحديث تقدمك.</Text>
          {!course.chapters.length && <Text style={s.empty}>لا توجد شابترات بعد. أضف أول شابتر أدناه.</Text>}
          {course.chapters.map((chapter, index) => <Pressable key={index} accessibilityRole="checkbox" accessibilityState={{ checked: chapter.done }} style={s.chapter} onPress={() => setCourses(items => items.map(item => item.id === course.id ? { ...item, chapters: item.chapters.map((entry, i) => i === index ? { ...entry, done: !entry.done } : entry) } : item))}>
            <Text style={[s.checkbox, chapter.done && s.checked]}>{chapter.done ? '✓' : '○'}</Text>
            <Text style={s.chapterTitle}>{chapter.title}</Text><Text style={s.small}>{chapter.done ? 'تمت المراجعة' : 'للمراجعة'}</Text>
          </Pressable>)}
          <Text style={s.label}>شابتر جديد</Text>
          <TextInput accessibilityLabel="عنوان الشابتر" value={chapterName} onChangeText={setChapterName} placeholder="اكتب عنوان الشابتر" placeholderTextColor="#81798B" style={s.input} maxLength={100} />
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !chapterName.trim() }} disabled={!chapterName.trim()} style={[s.primary, !chapterName.trim() && s.disabled]} onPress={() => { setCourses(items => items.map(item => item.id === course.id ? { ...item, chapters: [...item.chapters, { title: chapterName.trim(), done: false }] } : item)); setChapterName(''); }}><Text style={s.primaryText}>إضافة الشابتر</Text></Pressable>
        </View>}
        <Text style={s.footer}>خطوة صغيرة اليوم، فهم أوضح غدًا.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
