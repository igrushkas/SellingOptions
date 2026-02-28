import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

const TRADES_COLLECTION = 'trades';

/**
 * Subscribe to real-time trade updates from Firestore.
 * Returns an unsubscribe function.
 */
export function subscribeTrades(callback) {
  const q = query(
    collection(db, TRADES_COLLECTION),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const trades = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    callback(trades);
  });
}

/**
 * Add a new trade to Firestore.
 */
export async function addTrade(trade) {
  const { id, ...data } = trade; // strip client-generated id
  const docRef = await addDoc(collection(db, TRADES_COLLECTION), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Update an existing trade (e.g. close position).
 */
export async function updateTrade(tradeId, updates) {
  const ref = doc(db, TRADES_COLLECTION, tradeId);
  await updateDoc(ref, updates);
}

/**
 * Delete a trade.
 */
export async function deleteTrade(tradeId) {
  const ref = doc(db, TRADES_COLLECTION, tradeId);
  await deleteDoc(ref);
}
