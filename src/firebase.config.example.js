// Firebase web config template.
//
// Copy this file to `src/firebase.config.js` and replace the values with the
// ones from your own Firebase project:
//   https://console.firebase.google.com/ -> Project settings -> Your apps
//
// `src/firebase.config.js` is git-ignored so your keys are never committed.
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'YOUR-API-KEY',
  authDomain: 'YOUR-PROJECT.firebaseapp.com',
  databaseURL: 'https://YOUR-PROJECT.firebaseio.com',
  projectId: 'YOUR-PROJECT',
  storageBucket: 'YOUR-PROJECT.appspot.com',
  messagingSenderId: 'YOUR-MESSAGING-SENDER-ID',
  appId: 'YOUR-APP-ID',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);
export const authprovider = new GoogleAuthProvider();
// Always let the user pick which Google account to sign in with (needed to
// play as a second account on the same browser).
authprovider.setCustomParameters({ prompt: 'select_account' });

// Point the app at the local Firebase emulators during development.
// (`firebase emulators:start`; harmless in production since the host won't be
// localhost there.)
if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectDatabaseEmulator(database, '127.0.0.1', 9000);
}
