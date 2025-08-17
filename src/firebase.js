// src/firebase.js
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
  signOut,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ⬇️ paste YOUR exact config values from Firebase console
const firebaseConfig = {
    apiKey: "AIzaSyAtnE998-yDwyTh4_MXmYjmeV9bvtJSUkU",
    authDomain: "to-do-f2c2d.firebaseapp.com",
    projectId: "to-do-f2c2d",
    storageBucket: "to-do-f2c2d.firebasestorage.app",
    messagingSenderId: "48445260636",
    appId: "1:48445260636:web:545b74588ce16abb94b799",
    measurementId: "G-DYJ3HG52XZ"
  };

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

// Use persistent storage (fallback if Safari blocks it)
setPersistence(auth, browserLocalPersistence).catch(() =>
  setPersistence(auth, inMemoryPersistence)
);

// Detect Safari / iOS
function isAppleWebKit() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /AppleWebKit/.test(ua) && !/Chrome|Edg|OPR/.test(ua);
}

export async function loginWithGoogle() {
    console.log("loginWithGoogle clicked");   // 👈 add log
  
    try {
      if (isAppleWebKit()) {
        console.log("Using redirect for Safari/iOS");
        await signInWithRedirect(auth, provider);
        return;
      }
      console.log("Trying popup sign-in");
      await signInWithPopup(auth, provider);
      console.log("Popup success");
    } catch (e) {
      console.error("Sign-in error:", e);
      if (e && e.code === "auth/popup-blocked") {
        console.log("Popup blocked → fallback to redirect");
        await signInWithRedirect(auth, provider);
        return;
      }
      alert(`Google sign-in failed: ${e?.message || e}`);
    }
  }

// Complete redirect (useful on Safari/iOS)
getRedirectResult(auth)
  .then((res) => {
    if (res && res.user) {
      console.log("Signed in via redirect:", res.user.email);
    }
  })
  .catch((e) => {
    console.warn("Redirect sign-in error:", e);
  });

export function logout() {
  return signOut(auth);
}