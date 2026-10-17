import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { firebaseConfigError, publicEnv } from "@/lib/env";

export function getFirebaseApp(): FirebaseApp {
  const problem = firebaseConfigError(publicEnv.firebase);
  if (problem) throw new Error(problem);
  return getApps().length > 0 ? getApp() : initializeApp(publicEnv.firebase);
}

export function getFirebaseStorage(): FirebaseStorage {
  return getStorage(getFirebaseApp());
}
