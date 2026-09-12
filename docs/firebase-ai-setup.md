# Firebase AI Logic — حالة الربط 2026-09-13

## تجربة الخادم وقيود مفتاح الويب (2026-09-13)

حُفظ اعتماد Google ADC محليًا وتحقق تجديده. نجح طلب OAuth من الخادم للقالب الفعلي، وأعاد `gemini-3.6-flash` و`STOP`. كان الطلب الأول مرفوضًا لغياب مشروع الحصة؛ أضيف `x-goog-user-project` بالمشروع نفسه إلى المحول واختُبر.

كشف اختبار بمفتاح المتصفح العام وحده أن القالب كان يقبل التوليد دون المرور بالخادم. فُعّلت API Keys API لإدارة القيود وأزيل فقط `firebasevertexai.googleapis.com` من خدمات مفتاح Browser key الوحيد في المشروع. بقيت خدمات Authentication وApp Check وبقية القائمة كما هي. أعاد الاختبار المباشر بعدها `403 API_KEY_SERVICE_BLOCKED`، بينما استمر طلب OAuth الخادمي بالنجاح. هذا منع على مستوى خدمة المفتاح وليس اعتمادًا على سرية القالب أو App Check. لم نستخدم جلسة طالب أو رمزه في هذا الاختبار. أي مفتاح عميل جديد يجب أن يستثني خدمة AI Logic أيضًا؛ إعادة السماح بها تعيد مسار التجاوز.

نجحت ست تجارب بالمحول .NET نفسه: شرح وملخص واختبار من ثلاثة أسئلة، بالعربية والإنجليزية، مع تحقق البنية واقتباسات الصفحات. فُعّل التوليد في appsettings.Development.json فقط، والإعداد الإنتاجي يظل معطلًا. هذه عينة تقنية صغيرة وليست قبولًا لجودة جميع الفصول؛ اعتماد المستخدم المحلي ليس هوية إنتاج.

اجتازت مجموعة اختبارات الخلفية 54/54 بعد تشغيلها بصلاحية SQL LocalDB (المحاولة المحصورة فشلت في فتح قاعدة الاختبارات). أُعيد تشغيل API وVite وأعاد `/health` عبر المنفذ 5173 حالة `ready`. لم تُنفذ في هذه الجولة تجربة رفع وتوليد من واجهة حساب المستخدم الفعلي.

## ما نُفّذ

المحول `FirebaseAiStudyGenerator` هو مزود التوليد المسجل الآن في ASP.NET Core. يستخدم حصراً عنوان Firebase AI Logic الرسمي `firebasevertexai.googleapis.com` وطلب `templateGenerateContent` بقالب `studymate-content-v1`. المحول السابق محفوظ للاختبارات والأرشيف وليس مسار رجوع. الواجهة الحالية تستخدم طابور الخادم والحصص والتصحيح كما هي؛ لا تستلم مفاتيح الإجابة قبل تسليم المحاولة.

قالب `firebase/templates/studymate-content-v1.prompt` مسودة قابلة للنشر بعد التحقق. يقبل kind وlanguage وquestionCount وsourcePages. يحدد JSON للشرح أو الملخص أو الاختبار، مع المراجع. حدّث النموذج إلى gemini-3.6-flash بعد رفض 2.5 للمستخدمين الجدد. أرسل المستخدم نتائج تجارب ناجحة للملخص والشرح واختبار من ثلاثة أسئلة عبر لوحة Firebase. أزيل مخطط المخرجات المختصر بسبب إسقاط تعريف المصفوفات في الطلب، وبقي JSON مع تحقق الخادم من البنية والمراجع. يضيف المحول هوية المزود والنموذج الفعلي الذي تعيده الخدمة والقالب إلى الناتج المحفوظ؛ لا يعيد تصنيف المخرجات القديمة.

## ما لم يُثبت بعد

أثبتت التجربة الحية قبول هوية الخادم ورفض المفتاح العام بعد تعديل قيوده. لم نختبر طلبًا بجلسة طالب فعلية؛ الدليل الحالي هو حظر خدمة AI Logic كاملة على مفتاح الويب. أسماء القوالب ليست أسرارًا، وtemplate-only mode وحده ليس ضمانًا لمنع تجاوز حصة StudyMate. راجع القيود عند إضافة أي تطبيق أو مفتاح جديد.

توجد نسخة gcloud محلية تحت tmp واعتماد ADC في موقع المستخدم الافتراضي. استخدمت أداة تسجيل الدخول مخزن شهادات Windows عبر truststore مع بقاء التحقق من TLS مفعّلًا. لا تكفي firebaseConfig أو Site key أو Firebase ID token لهذا المسار الخادمي. لا تنسخ رمز App Check الخاص بالمتصفح إلى الخادم ولا تعطل فرض App Check لمعالجة رفض طلب.

## إكمال التجربة

1. في Firebase Console للمشروع StudyMate-Dev، افتح AI Logic → Prompt templates. راجع/أنشئ القالب `studymate-content-v1` من الملف، مع Gemini Developer API. لا تفترض أن النشر قد تم من مجرد وجود الملف محليًا.
2. جهّز Application Default Credentials للخادم عبر Google Cloud CLI: `gcloud auth application-default login`، ثم `gcloud auth application-default set-quota-project studymate-dev-a2766` عند الحاجة. تسجيل الدخول تفاعلي ينفذه صاحب الحساب. لا تشارك ملفات الاعتماد أو رموز الوصول في المحادثة أو المستودع. الإنتاج يستخدم هوية خدمة مناسبة وصلاحيات محدودة.
3. جرّب REST الموثق `POST https://firebasevertexai.googleapis.com/v1beta/projects/studymate-dev-a2766/templates/studymate-content-v1:templateGenerateContent` باستخدام هوية الخادم ونص تجريبي غير خاص. صيغة الجسم `{ "inputs": { "kind": "summary", "language": "en", "questionCount": 10, "sourcePages": "[{\"number\":1,\"text\":\"Cells contain DNA.\"}]" } }`.
4. سجّل قبول طلب الخادم، ثم اختبر رفض الطلب نفسه بهوية طالب عادية وApp Check صالح دون صلاحيات الخادم. اختبر كذلك رفض الطلبات المباشرة التي تتجاوز القالب؛ إذا لم تُرفض، يبقى P0 عائق تصميم ولا يُفعّل التوليد.
5. بعد نجاح P0 فقط، اضبط `FirebaseAI:ServerRouteVerified=true` و`FirebaseAI:Enabled=true` في إعداد الخادم المحلي، ثم اختبر الأنواع الثلاثة بالعربية والإنجليزية. الإعداد الافتراضي false مقصود. لا تُفعّل بوابة التحقق لمجرد نجاح البناء.

Storage ما زال مؤجلًا؛ تؤخذ الصفحات من استخراج PDF المخزن حاليًا في SQL. لا تتطلب هذه التغييرات نقل الملفات أو تفعيل فوترة Storage.

## مصادر القرار

- https://firebase.google.com/docs/reference/ai-logic/rest/v1beta/projects.templates/templateGenerateContent
- https://firebase.google.com/docs/ai-logic/server-prompt-templates/syntax-and-examples
- https://firebase.google.com/docs/ai-logic/server-prompt-templates/template-only-mode

توثيق REST يذكر نطاق OAuth cloud-platform؛ هذا أساس المحول المرشح وليس إثباتًا أن المشروع يقبل المسار الخادمي أو يمنع العميل. عند تعذر الجمع بين Firebase AI Logic والقيود المتفق عليها، نناقش القرار قبل تبديل المسار.

