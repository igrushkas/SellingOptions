import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyD3WXdL-IXCvxMCvmvqb9MCuvgogiy_ubg",
  authDomain: "sellingoptions-a8da4.firebaseapp.com",
  projectId: "sellingoptions-a8da4",
  storageBucket: "sellingoptions-a8da4.firebasestorage.app",
  messagingSenderId: "227077112084",
  appId: "1:227077112084:web:48d0f0fc9f9aaa803ec201",
  measurementId: "G-W6QZY82EPL",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
