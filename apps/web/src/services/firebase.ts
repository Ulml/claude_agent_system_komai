/**
 * Firebase backend adapter (Google Cloud hosting of the AI OS).
 *
 * Template_LM is designed for Firebase: Hosting (this SPA), Auth (single
 * sign-on) and Firestore (projects, tasks, agent memory). The security rules
 * live in `firebase/firestore.rules` and enforce the same perimeter model as
 * the UI (a member only reads tasks inside their perimeter).
 *
 * The SDK is imported DYNAMICALLY and only when a real Firebase project is
 * configured via Vite env vars (see .env.example): the demo build ships no
 * Firebase bytes and every call degrades to localStorage persistence,
 * keeping a single code path for the UI.
 */
import type { Project, TaskNode } from '@/core/types';

interface FirebaseHandles {
  auth: import('firebase/auth').Auth;
  db: import('firebase/firestore').Firestore;
}

let handlesPromise: Promise<FirebaseHandles> | null = null;

/** True when a real Firebase project is configured via .env. */
export function isFirebaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID);
}

function getHandles(): Promise<FirebaseHandles> | null {
  if (!isFirebaseConfigured()) return null;
  if (!handlesPromise) {
    handlesPromise = (async () => {
      const [{ initializeApp }, { getAuth }, { getFirestore }] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ]);
      const app = initializeApp({
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      });
      return { auth: getAuth(app), db: getFirestore(app) };
    })();
  }
  return handlesPromise;
}

/** Single sign-on with Google (no-op in local demo mode). */
export async function signInWithGoogle(): Promise<string | null> {
  const pending = getHandles();
  if (!pending) return null;
  const { auth } = await pending;
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
  const cred = await signInWithPopup(auth, new GoogleAuthProvider());
  return cred.user.displayName ?? cred.user.email;
}

export async function firebaseSignOut(): Promise<void> {
  const pending = getHandles();
  if (!pending) return;
  const { auth } = await pending;
  const { signOut } = await import('firebase/auth');
  await signOut(auth);
}

/**
 * Persist a project and its tasks. Firestore when configured,
 * localStorage otherwise — the caller never needs to know which.
 */
export async function persistProject(project: Project, tasks: TaskNode[]): Promise<void> {
  const pending = getHandles();
  if (pending) {
    const { db } = await pending;
    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'projects', project.id), project as never);
    await Promise.all(
      tasks.map((t) => setDoc(doc(db, 'projects', project.id, 'tasks', t.id), t as never))
    );
    return;
  }
  // Local demo mode: tasks reference agents by id only, so JSON is safe.
  localStorage.setItem(`template_lm_project_${project.id}`, JSON.stringify({ project, tasks }));
}
