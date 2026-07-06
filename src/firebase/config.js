// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAFFkb059QG1De0tbDhb0KnNJk8p_1EsDQ",
  authDomain: "speaksmartai-63d29.firebaseapp.com",
  projectId: "speaksmartai-63d29",
  storageBucket: "speaksmartai-63d29.firebasestorage.app",
  messagingSenderId: "1095438406787",
  appId: "1:1095438406787:web:191f5b1f89edea487577b6",
  measurementId: "G-X6MXPBSLDK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { app, analytics, auth, db, googleProvider };
