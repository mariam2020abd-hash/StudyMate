import { Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

const purple = '#7C3AED';
const deepPurple = '#5B21B6';
const ink = '#141017';
const muted = '#6B6470';
const lavender = '#F1EAFE';

type FeatureProps = {
  number: string;
  title: string;
  description: string;
};

function FeatureCard({ number, title, description }: FeatureProps) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureNumber}>
        <Text style={styles.featureNumberText}>{number}</Text>
      </View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  const isCompact = width < 760;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.page}>
          <View style={styles.navbar}>
            <View style={styles.brand}>
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkText}>S</Text>
              </View>
              <Text style={styles.brandName}>StudyMate</Text>
            </View>
            {!isCompact && (
              <View style={styles.navLinks}>
                <Text style={styles.navLink}>المزايا</Text>
                <Text style={styles.navLink}>عن المنصة</Text>
                <Text style={styles.navLink}>خطة المشروع</Text>
              </View>
            )}
            <Pressable style={styles.outlineButton} accessibilityRole="button">
              <Text style={styles.outlineButtonText}>تعرّف أكثر</Text>
            </Pressable>
          </View>

          <View style={[styles.hero, isCompact && styles.heroCompact]}>
            <View style={[styles.heroCopy, isCompact && styles.heroCopyCompact]}>
              <View style={styles.eyebrow}>
                <View style={styles.eyebrowDot} />
                <Text style={styles.eyebrowText}>رفيقك الدراسي الهادئ</Text>
              </View>
              <Text style={styles.heroTitle}>افهم أكثر،{`\n`}وتقدّم بثقة.</Text>
              <Text style={styles.heroDescription}>
                منصة تساعد الطالب الجامعي على فهم الشابترات الإنجليزية، تنظيم تقدمه الدراسي، وحساب معدله في مكان واحد.
              </Text>
              <View style={[styles.heroActions, isCompact && styles.heroActionsCompact]}>
                <Pressable style={styles.primaryButton} accessibilityRole="button">
                  <Text style={styles.primaryButtonText}>استكشف المشروع</Text>
                  <Text style={styles.arrow}>←</Text>
                </Pressable>
                <Pressable style={styles.textButton} accessibilityRole="button">
                  <Text style={styles.textButtonText}>كيف يعمل؟</Text>
                </Pressable>
              </View>
              <View style={styles.trustRow}>
                <View style={styles.trustCheck}><Text style={styles.trustCheckText}>✓</Text></View>
                <Text style={styles.trustText}>تصميم عربي بسيط، على الويب والجوال</Text>
              </View>
            </View>

            <View style={styles.previewShell}>
              <View style={styles.previewTopbar}>
                <View style={styles.previewDots}>
                  <View style={[styles.dot, { backgroundColor: '#D8CCF7' }]} />
                  <View style={[styles.dot, { backgroundColor: '#BCA5F4' }]} />
                  <View style={[styles.dot, { backgroundColor: purple }]} />
                </View>
                <Text style={styles.previewTopbarText}>لوحة الطالب</Text>
              </View>
              <View style={styles.previewBody}>
                <Text style={styles.previewGreeting}>مرحبًا، مريم</Text>
                <Text style={styles.previewSubtitle}>لديك خطوة واحدة مهمة اليوم.</Text>
                <View style={styles.focusCard}>
                  <View>
                    <Text style={styles.focusLabel}>جلسة اليوم</Text>
                    <Text style={styles.focusTitle}>مراجعة Chapter 3</Text>
                    <Text style={styles.focusCourse}>مبادئ البرمجة</Text>
                  </View>
                  <View style={styles.playButton}><Text style={styles.playIcon}>▶</Text></View>
                </View>
                <View style={styles.previewStats}>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>72%</Text>
                    <Text style={styles.statLabel}>تقدمك</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>4</Text>
                    <Text style={styles.statLabel}>إنجازات</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>3.85</Text>
                    <Text style={styles.statLabel}>معدلك</Text>
                  </View>
                </View>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressText}>استعدادك للاختبار</Text>
                  <Text style={styles.progressPercent}>68%</Text>
                </View>
                <View style={styles.progressTrack}><View style={styles.progressFill} /></View>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionKicker}>كل ما تحتاجه في رحلة واحدة</Text>
            <Text style={styles.sectionTitle}>من الشابتر إلى الإنجاز</Text>
          </View>
          <View style={[styles.featureGrid, isCompact && styles.featureGridCompact]}>
            <FeatureCard number="01" title="افهم المحتوى" description="ارفع الشابتر، ثم احصل على شرح عربي مبسط وملخص لأهم النقاط." />
            <FeatureCard number="02" title="تدرّب بوضوح" description="اختبر فهمك بأسئلة مبنية على المحتوى، وراجع أخطاءك بهدوء." />
            <FeatureCard number="03" title="تابع تقدّمك" description="ضع أهدافك، سجل إنجازاتك، واعرف الخطوة الدراسية التالية." />
          </View>

          <View style={[styles.journey, isCompact && styles.journeyCompact]}>
            <View style={styles.journeyCopy}>
              <Text style={styles.sectionKicker}>رحلة الشابتر</Text>
              <Text style={[styles.sectionTitle, styles.journeyTitle]}>خطوات قصيرة، أثر واضح.</Text>
              <Text style={styles.journeyDescription}>تجربة منظمة تساعدك على تحويل أي Chapter إلى فهم ومراجعة وتدريب.</Text>
            </View>
            <View style={styles.steps}>
              {['ارفع ملف PDF', 'اقرأ الشرح والملخص', 'حل الـ Quiz', 'راجع النتيجة'].map((step, index) => (
                <View style={styles.step} key={step}>
                  <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View>
                  <Text style={styles.stepText}>{step}</Text>
                  {index < 3 && <View style={styles.stepLine} />}
                </View>
              ))}
            </View>
          </View>

          <View style={styles.cta}>
            <Text style={styles.ctaTitle}>دراستك، بصورة أبسط.</Text>
            <Text style={styles.ctaDescription}>StudyMate مشروع تعليمي قيد البناء لتقديم تجربة دراسة أكثر تركيزًا وهدوءًا.</Text>
            <Pressable style={styles.lightButton} accessibilityRole="button">
              <Text style={styles.lightButtonText}>ابدأ رحلة التعلّم</Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerBrand}>StudyMate</Text>
            <Text style={styles.footerText}>مشروع تعليمي لطلاب الجامعة</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { flexGrow: 1 },
  page: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 24, paddingBottom: 24 },
  navbar: { minHeight: 88, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 34, height: 34, borderRadius: 11, backgroundColor: ink, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#FFFFFF', fontWeight: '800', fontSize: 18 },
  brandName: { fontSize: 20, fontWeight: '800', color: ink, letterSpacing: -0.5 },
  navLinks: { flexDirection: 'row-reverse', gap: 28, alignItems: 'center' },
  navLink: { color: muted, fontSize: 14, fontWeight: '600' },
  outlineButton: { borderWidth: 1, borderColor: '#D9D3DE', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 10 },
  outlineButtonText: { color: ink, fontSize: 13, fontWeight: '700' },
  hero: { minHeight: 510, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 60, paddingVertical: 48 },
  heroCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 34, paddingVertical: 32 },
  heroCopy: { flex: 1, maxWidth: 550, alignItems: 'flex-end' },
  heroCopyCompact: { maxWidth: undefined },
  eyebrow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, backgroundColor: lavender, borderRadius: 30, paddingHorizontal: 11, paddingVertical: 7 },
  eyebrowDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: purple },
  eyebrowText: { color: deepPurple, fontSize: 12, fontWeight: '800' },
  heroTitle: { color: ink, fontSize: 55, lineHeight: 65, fontWeight: '900', letterSpacing: -2.5, textAlign: 'right', marginTop: 19, writingDirection: 'rtl' },
  heroDescription: { color: muted, fontSize: 17, lineHeight: 29, textAlign: 'right', marginTop: 16, writingDirection: 'rtl' },
  heroActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 20, marginTop: 27, width: '100%' },
  heroActionsCompact: { gap: 14 },
  primaryButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, backgroundColor: purple, paddingHorizontal: 19, paddingVertical: 15, borderRadius: 12 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  arrow: { color: '#FFFFFF', fontSize: 19, fontWeight: '700' },
  textButton: { paddingVertical: 12 },
  textButtonText: { color: ink, fontSize: 14, fontWeight: '800' },
  trustRow: { flexDirection: 'row-reverse', gap: 7, alignItems: 'center', marginTop: 24, alignSelf: 'flex-end' },
  trustCheck: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#E8DDFC', alignItems: 'center', justifyContent: 'center' },
  trustCheckText: { color: deepPurple, fontSize: 11, fontWeight: '900' },
  trustText: { color: muted, fontSize: 12, writingDirection: 'rtl' },
  previewShell: { flex: 1, minWidth: 300, maxWidth: 450, backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#E8E2EC', shadowColor: '#2A143C', shadowOffset: { width: 0, height: 17 }, shadowOpacity: 0.13, shadowRadius: 35, elevation: 8, overflow: 'hidden', transform: [{ rotate: Platform.OS === 'web' ? '-2deg' : '0deg' }] },
  previewTopbar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#F0ECF2' },
  previewDots: { flexDirection: 'row', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  previewTopbarText: { color: muted, fontSize: 12, fontWeight: '700', writingDirection: 'rtl' },
  previewBody: { padding: 23 },
  previewGreeting: { color: ink, fontSize: 21, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  previewSubtitle: { color: muted, fontSize: 12, textAlign: 'right', marginTop: 4, writingDirection: 'rtl' },
  focusCard: { marginTop: 20, backgroundColor: ink, borderRadius: 15, padding: 17, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  focusLabel: { color: '#CFC6D5', fontSize: 11, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  focusTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', marginTop: 6, textAlign: 'right', writingDirection: 'rtl' },
  focusCourse: { color: '#BEA3F6', fontSize: 11, marginTop: 3, textAlign: 'right', writingDirection: 'rtl' },
  playButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: purple, alignItems: 'center', justifyContent: 'center' },
  playIcon: { color: '#FFFFFF', fontSize: 13, marginLeft: 2 },
  previewStats: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 17, gap: 8 },
  statBox: { flex: 1, backgroundColor: '#FBF9FC', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  statValue: { color: ink, fontSize: 15, fontWeight: '900' },
  statLabel: { color: muted, fontSize: 10, marginTop: 3, writingDirection: 'rtl' },
  progressLabelRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 20 },
  progressText: { color: ink, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  progressPercent: { color: purple, fontSize: 11, fontWeight: '900' },
  progressTrack: { height: 7, borderRadius: 10, backgroundColor: '#EAE5EE', marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', width: '68%', borderRadius: 10, backgroundColor: purple },
  sectionHeader: { alignItems: 'flex-end', marginTop: 35 },
  sectionKicker: { color: purple, fontSize: 12, fontWeight: '900', letterSpacing: 0.3, textAlign: 'right', writingDirection: 'rtl' },
  sectionTitle: { color: ink, fontSize: 34, lineHeight: 42, fontWeight: '900', letterSpacing: -1.2, textAlign: 'right', marginTop: 7, writingDirection: 'rtl' },
  featureGrid: { flexDirection: 'row-reverse', gap: 15, marginTop: 27 },
  featureGridCompact: { flexDirection: 'column' },
  featureCard: { flex: 1, minHeight: 192, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9E3EC', borderRadius: 17, padding: 21, alignItems: 'flex-end' },
  featureNumber: { width: 30, height: 30, borderRadius: 10, backgroundColor: lavender, alignItems: 'center', justifyContent: 'center' },
  featureNumberText: { color: deepPurple, fontSize: 11, fontWeight: '900' },
  featureTitle: { color: ink, fontSize: 18, fontWeight: '900', marginTop: 17, textAlign: 'right', writingDirection: 'rtl' },
  featureDescription: { color: muted, fontSize: 13, lineHeight: 22, marginTop: 7, textAlign: 'right', writingDirection: 'rtl' },
  journey: { backgroundColor: lavender, borderRadius: 20, marginTop: 72, padding: 31, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 28 },
  journeyCompact: { flexDirection: 'column', alignItems: 'stretch' },
  journeyCopy: { flex: 0.9, alignItems: 'flex-end' },
  journeyTitle: { fontSize: 29, lineHeight: 36 },
  journeyDescription: { color: muted, fontSize: 14, lineHeight: 23, textAlign: 'right', marginTop: 9, writingDirection: 'rtl' },
  steps: { flex: 1.1, gap: 12 },
  step: { flexDirection: 'row-reverse', alignItems: 'center', gap: 11, minHeight: 32 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: purple, fontSize: 12, fontWeight: '900' },
  stepText: { color: ink, fontSize: 14, fontWeight: '800', writingDirection: 'rtl' },
  stepLine: { position: 'absolute', right: 13, top: 27, height: 17, borderRightWidth: 1, borderRightColor: '#CDBBF4' },
  cta: { marginTop: 72, backgroundColor: ink, borderRadius: 20, paddingVertical: 46, paddingHorizontal: 30, alignItems: 'center' },
  ctaTitle: { color: '#FFFFFF', fontSize: 34, fontWeight: '900', letterSpacing: -1.1, writingDirection: 'rtl' },
  ctaDescription: { color: '#CFC6D5', maxWidth: 520, fontSize: 14, lineHeight: 23, textAlign: 'center', marginTop: 10, writingDirection: 'rtl' },
  lightButton: { marginTop: 22, backgroundColor: '#FFFFFF', paddingHorizontal: 19, paddingVertical: 14, borderRadius: 11 },
  lightButtonText: { color: ink, fontSize: 14, fontWeight: '900', writingDirection: 'rtl' },
  footer: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 30 },
  footerBrand: { color: ink, fontSize: 15, fontWeight: '900' },
  footerText: { color: muted, fontSize: 12, writingDirection: 'rtl' },
});
