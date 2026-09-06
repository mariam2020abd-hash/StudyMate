import { Pressable, SafeAreaView, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import FeatureCard from '../../components/FeatureCard';
import { purple } from '../../theme/colors';
import { styles } from './LandingScreen.styles';

export default function LandingScreen({ onOpenDashboard }: { onOpenDashboard: () => void }) {
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
                <Pressable style={styles.primaryButton} accessibilityRole="button" onPress={onOpenDashboard}>
                  <Text style={styles.primaryButtonText}>افتح لوحة الطالب</Text>
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
            <Pressable style={styles.lightButton} accessibilityRole="button" onPress={onOpenDashboard}>
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
