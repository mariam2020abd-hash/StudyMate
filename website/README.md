# StudyMate — الموقع

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
