// Firebase web config template.
//
// Copy this file to `src/firebase.config.js` and replace the values with the
// ones from your own Firebase project:
//   https://console.firebase.google.com/ -> Project settings -> Your apps
//
// `src/firebase.config.js` is git-ignored so your keys are never committed.
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  databaseURL: 'https://YOUR_PROJECT.firebaseio.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);
export const authprovider = new GoogleAuthProvider();
// Always let the user pick which Google account to sign in with (needed to
// play as a second account on the same browser).
authprovider.setCustomParameters({ prompt: 'select_account' });
