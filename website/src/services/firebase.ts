import { initializeApp } from 'firebase/app';
import { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

// Public web-app identifiers, supplied by the project owner.
// Service-account credentials and Gemini API secrets must never go here.
export const firebaseApp = initializeApp({
  apiKey: 'AIzaSyA0GpM9Tbp80vP8w5Fg0sHENBn1NCG1PA8',
  authDomain: 'studymate-dev-a2766.firebaseapp.com',
  projectId: 'studymate-dev-a2766',
  storageBucket: 'studymate-dev-a2766.firebasestorage.app',
  messagingSenderId: '196136170454',
  appId: '1:196136170454:web:28e1b7b06ecc1e88882a77',
});

const localDevelopment = import.meta.env.DEV
  && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

if (localDevelopment) {
  // Firebase generates a browser-specific debug token. Register it privately
  // in App Check; never copy its value into source or a production build.
  (self as typeof self & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean })
    .FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

export const appCheck = initializeAppCheck(firebaseApp, {
  provider: new ReCaptchaEnterpriseProvider('6LcsDrEtAAAAANrRZHkODlhjTdDQ6EUgeoXp3lgX'),
  isTokenAutoRefreshEnabled: true,
});

if (localDevelopment) {
  // A token request makes the SDK print the registration token in the local
  // browser console. An unregistered token must fail, not bypass App Check.
  void getToken(appCheck).catch(() => {
    console.info('StudyMate: register this browser’s App Check debug token in Firebase, then reload.');
  });
}
