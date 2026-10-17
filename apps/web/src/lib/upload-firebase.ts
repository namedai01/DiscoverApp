import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase";
import type { ImageUploader } from "./upload";

export const firebaseUploader: ImageUploader = async (uid, image) => {
  const object = ref(
    getFirebaseStorage(),
    `uploads/${uid}/${crypto.randomUUID()}.jpg`,
  );
  await uploadBytes(object, image, { contentType: "image/jpeg" });
  return getDownloadURL(object);
};
