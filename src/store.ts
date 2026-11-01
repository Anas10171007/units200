import AsyncStorage from '@react-native-async-storage/async-storage';
import { Cycle } from './forecast';

export type Data = { cycle: Cycle | null; history: Cycle[] };
const KEY = 'units200:v1';
export const empty: Data = { cycle: null, history: [] };

export async function load(): Promise<Data> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...empty, ...JSON.parse(raw) } : empty;
  } catch { return empty; }
}
export async function save(d: Data) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(d)); } catch { /* keep in-memory state */ }
}
