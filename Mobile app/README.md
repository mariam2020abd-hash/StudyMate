# StudyMate — تطبيق الجوال

مشروع React Native + Expo مستقل لنظامي Android وiOS. لا يعتمد على أي ملفات من الموقع.

من هذا المجلد، باستخدام Node.js 22.13 أو أحدث:

```sh
npm ci
npm start
```

- `npm run android`: فتح التطبيق على جهاز Android أو محاكي جاهز.
- `npm run ios`: فتح محاكي iOS على macOS.
- `npm run typecheck`: فحص TypeScript.
- `npm run export`: تصدير حزم JavaScript/Hermes للمنصتين داخل `dist`، وليس APK أو IPA.

نقطة الدخول `index.ts`، والتنقل داخل `App.tsx`، والشاشات داخل `src/screens`. البيانات والأنواع والألوان وحالة اللوحة تخص التطبيق وحده. البيانات تجريبية وتُعاد عند مغادرة اللوحة أو إعادة التحميل.
