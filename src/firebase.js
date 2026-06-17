import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// 設定は .env から読む（VITE_ プレフィックスが必須）。値は公開前提のクライアントキー。
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// 匿名認証で端末ごとに uid を発行（UIには何も出ない）。
// 回答ドキュメントはこの uid をキーにし、ルールで「自分の uid の行だけ書ける」を担保する。
let authPromise = null;
export function ensureAuth() {
  if (authPromise) return authPromise;
  authPromise = new Promise((resolve, reject) => {
    const off = onAuthStateChanged(auth, (u) => {
      if (u) {
        off();
        resolve(u.uid);
      }
    });
    signInAnonymously(auth).catch((e) => {
      off();
      authPromise = null; // 失敗時はリセットして次回リトライ可能にする
      reject(e);
    });
  });
  return authPromise;
}
