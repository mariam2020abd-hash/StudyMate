# StudyMate — الموقع

## النشر على GitHub Pages

ينشر الملف `.github/workflows/deploy-website.yml` الموقع عند رفع تغييرات `website` إلى `main`، ويمكن تشغيله يدويًا من Actions. يجب اختيار **GitHub Actions** من إعدادات المستودع **Settings → Pages → Source**.

رابط النشر: https://mariam2020abd-hash.github.io/StudyMate/

يضبط `vite.config.ts` مسار ملفات البناء إلى `/StudyMate/`، بينما يبقى التشغيل المحلي على `/`. عند تغيير اسم المستودع أو استخدام نطاق مخصص يجب تحديث هذا المسار.

مشروع React + React DOM + Vite مستقل. لا يعتمد على أي ملفات من تطبيق الجوال.

من هذا المجلد، باستخدام Node.js 22.13 أو أحدث:

```sh
npm ci
npm run dev
```

- `npm run typecheck`: فحص TypeScript.
- `npm run build`: بناء الموقع داخل `dist`.
- `npm run preview`: معاينة البناء محليًا.

الصفحات داخل `src/pages`، والمكوّنات داخل `src/components`، وحالة لوحة الطالب داخل `src/hooks`. البيانات والأنواع والألوان تخص الموقع وحده. البيانات تجريبية وتُعاد عند مغادرة اللوحة أو إعادة التحميل.
