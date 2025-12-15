import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { ProductItem } from "../types";

// Configurarea Firebase pentru proiectul 'Inventar-Piese'
const firebaseConfig = {
  apiKey: "AIzaSyDRxDwjvy_I5cL0OqzI2nrzzXk-Xs9fmrE",
  authDomain: "inventar-piese.firebaseapp.com",
  projectId: "inventar-piese",
  storageBucket: "inventar-piese.firebasestorage.app",
  messagingSenderId: "1042798421058",
  appId: "1:1042798421058:web:e6134aae0b7a11d48139db"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export interface InventorySession {
  sessionId: string;
  createdAt: number;
  fileName: string;
  products: ProductItem[];
  originalHeaders: any[];
  columnMapping: any;
}

// 1. Desktop: Creează o sesiune nouă
export const createSession = async (
  sessionId: string, 
  products: ProductItem[], 
  fileName: string,
  originalHeaders: any[],
  columnMapping: any
) => {
  try {
    await setDoc(doc(db, "sessions", sessionId), {
      sessionId,
      createdAt: Date.now(),
      fileName,
      products,
      originalHeaders,
      columnMapping
    });
    return true;
  } catch (e) {
    console.error("Error adding document: ", e);
    throw e;
  }
};

// 2. Zebra: Verifică dacă sesiunea există
export const checkSessionExists = async (sessionId: string): Promise<boolean> => {
    const docRef = doc(db, "sessions", sessionId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
};

// 3. Ambele: Ascultă schimbările în timp real
export const subscribeToSession = (sessionId: string, callback: (data: InventorySession) => void) => {
    return onSnapshot(doc(db, "sessions", sessionId), (doc) => {
        if (doc.exists()) {
            callback(doc.data() as InventorySession);
        }
    });
};

// 4. Zebra/Desktop: Actualizează un produs (sau toată lista)
export const updateSessionProducts = async (sessionId: string, products: ProductItem[]) => {
    const sessionRef = doc(db, "sessions", sessionId);
    await updateDoc(sessionRef, {
        products: products
    });
};