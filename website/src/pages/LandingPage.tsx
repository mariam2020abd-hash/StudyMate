import FeatureCard from '../components/FeatureCard';

export default function LandingPage({ onOpenDashboard }: { onOpenDashboard: () => void }) {
  return <main className="page landing">
    <header className="navbar">
      <a className="brand" href="#">StudyMate <span>●</span></a>
      <nav aria-label="القائمة الرئيسية"><a href="#features">المزايا</a><a href="#about">عن المنصة</a><a href="#journey">خطة المشروع</a></nav>
      <a className="button secondary" href="#about">تعرّف أكثر</a>
    </header>
    <section className="hero">
      <div>
        <span className="eyebrow">● رفيقك الدراسي الهادئ</span>
        <h1>افهم أكثر،<br />وتقدّم بثقة.</h1>
        <p className="intro">منصة تساعد الطالب الجامعي على فهم الشباتر، تنظيم تقدمه الدراسي، وحساب معدله في مكان واحد.</p>
        <div className="actions"><button onClick={onOpenDashboard}>افتح لوحة الطالب ←</button><a href="#journey">كيف يعمل؟</a></div>
      </div>
      <aside className="card preview" aria-label="مثال توضيحي للوحة الطالب">
        <div className="section-head"><span>لوحة الطالب · مثال توضيحي</span><span className="purple">● ● ●</span></div>
        <h2>مرحبًا، مريم</h2><p>لديك خطوة واحدة مهمة اليوم.</p>
        <div className="focus"><div><small>جلسة اليوم</small><h3>مراجعة Chapter 3</h3><span>مبادئ البرمجة</span></div><span aria-hidden="true">▶</span></div>
        <div className="stats preview-stats">{[['72%', 'تقدمك'], ['4', 'إنجازات'], ['3.85', 'معدلك']].map(([value, label]) => <div key={label}><strong>{value}</strong><small>{label}</small></div>)}</div>
        <label>استعدادك للاختبار <progress value={68} max={100}>68%</progress></label>
      </aside>
    </section>
    <section id="features">
      <p className="kicker">كل ما تحتاجه في رحلة واحدة</p><h2>من الشابتر إلى الإنجاز</h2>
      <div className="grid">
        <FeatureCard number="01" title="افهم المحتوى" description="ارفع الشابتر، ثم احصل على شرح عربي مبسط وملخص لأهم النقاط." />
        <FeatureCard number="02" title="تدرّب بوضوح" description="اختبر فهمك بأسئلة مبنية على المحتوى، وراجع أخطاءك بهدوء." />
        <FeatureCard number="03" title="تابع تقدّمك" description="ضع أهدافك، سجل إنجازاتك، واعرف الخطوة الدراسية التالية." />
      </div>
    </section>
    <section className="journey" id="journey">
      <div><p className="kicker">رحلة الشابتر</p><h2>خطوات قصيرة، أثر واضح.</h2><p>تجربة منظمة تساعدك على تحويل أي Chapter إلى فهم ومراجعة وتدريب.</p></div>
      <ol>{['ارفع ملف PDF', 'اقرأ الشرح والملخص', 'حل الـ Quiz', 'راجع النتيجة'].map(step => <li key={step}>{step}</li>)}</ol>
    </section>
    <section className="cta" id="about"><h2>دراستك، بصورة أبسط.</h2><p>StudyMate مشروع تعليمي قيد البناء لتقديم تجربة دراسة أكثر تركيزًا وهدوءًا.</p><button className="light" onClick={onOpenDashboard}>ابدأ رحلة التعلّم</button></section>
    <footer><strong>StudyMate</strong><span>مشروع تعليمي لطلاب الجامعة</span></footer>
  </main>;
}
