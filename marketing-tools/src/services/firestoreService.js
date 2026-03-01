import {
  collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, addDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

// --- API Keys (user-level) ---
export async function saveApiKeys(uid, keys) {
  await setDoc(doc(db, 'users', uid, 'profile', 'apiKeys'), keys, { merge: true });
}

export async function getApiKeys(uid) {
  const snap = await getDoc(doc(db, 'users', uid, 'profile', 'apiKeys'));
  return snap.exists() ? snap.data() : {};
}

// --- Businesses ---
export function subscribeBusinesses(uid, callback) {
  const q = query(collection(db, 'users', uid, 'businesses'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function addBusiness(uid, business) {
  const ref = await addDoc(collection(db, 'users', uid, 'businesses'), {
    ...business,
    completedSkills: [],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateBusiness(uid, bizId, updates) {
  await updateDoc(doc(db, 'users', uid, 'businesses', bizId), updates);
}

export async function deleteBusiness(uid, bizId) {
  await deleteDoc(doc(db, 'users', uid, 'businesses', bizId));
}

// --- Skill Outputs ---
export async function saveSkillOutput(uid, bizId, skillId, output) {
  await setDoc(doc(db, 'users', uid, 'businesses', bizId, 'skillOutputs', skillId), {
    output,
    createdAt: serverTimestamp(),
  });
}

export async function getSkillOutput(uid, bizId, skillId) {
  const snap = await getDoc(doc(db, 'users', uid, 'businesses', bizId, 'skillOutputs', skillId));
  return snap.exists() ? snap.data() : null;
}

export async function getAllSkillOutputs(uid, bizId) {
  const snap = await getDocs(collection(db, 'users', uid, 'businesses', bizId, 'skillOutputs'));
  const outputs = {};
  snap.forEach(d => { outputs[d.id] = d.data(); });
  return outputs;
}

// --- Competitors ---
export function subscribeCompetitors(uid, bizId, callback) {
  const q = query(collection(db, 'users', uid, 'businesses', bizId, 'competitors'), orderBy('name'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function addCompetitor(uid, bizId, competitor) {
  const ref = await addDoc(collection(db, 'users', uid, 'businesses', bizId, 'competitors'), {
    ...competitor,
    snapshots: [],
    lastUpdated: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCompetitor(uid, bizId, competitorId, updates) {
  await updateDoc(doc(db, 'users', uid, 'businesses', bizId, 'competitors', competitorId), {
    ...updates,
    lastUpdated: serverTimestamp(),
  });
}

export async function deleteCompetitor(uid, bizId, competitorId) {
  await deleteDoc(doc(db, 'users', uid, 'businesses', bizId, 'competitors', competitorId));
}
