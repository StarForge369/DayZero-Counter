import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase web configuration is public by design. Firestore Rules and App Check,
// not this configuration, protect access to the project's data.
const firebaseConfig = {
  apiKey: 'AIzaSyAW2AGIAWv5ADfOccU9lxmeyjvKJQQcsjQ',
  authDomain: 'day-zero-counter.firebaseapp.com',
  projectId: 'day-zero-counter',
  storageBucket: 'day-zero-counter.firebasestorage.app',
  messagingSenderId: '225268557209',
  appId: '1:225268557209:web:fed3acb5b5d264494fdf08',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);
export const firestore = getFirestore(app);

let authenticationPromise: Promise<User> | null = null;

/** Authenticates silently so the existing sync-code workflow stays unchanged. */
export function ensureFirebaseAuthentication(): Promise<User> {
  if (firebaseAuth.currentUser) return Promise.resolve(firebaseAuth.currentUser);
  if (authenticationPromise) return authenticationPromise;

  authenticationPromise = new Promise<User>((resolve, reject) => {
    let unsubscribe = () => {};
    unsubscribe = onAuthStateChanged(
      firebaseAuth,
      (user) => {
        unsubscribe();
        if (user) {
          resolve(user);
          return;
        }

        signInAnonymously(firebaseAuth)
          .then((credential) => resolve(credential.user))
          .catch(reject);
      },
      (error) => {
        unsubscribe();
        reject(error);
      },
    );
  }).finally(() => {
    authenticationPromise = null;
  });

  return authenticationPromise;
}
