import { useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY_NOTICES = "aconvi_read_notice_ids";
const STORAGE_KEY_DOCS = "aconvi_seen_doc_ids";
const STORAGE_KEY_FEES = "aconvi_last_seen_fees_ts";

// Simple event listener pattern so screens update in real-time
type Listener = () => void;
const listeners = new Set<Listener>();
function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export async function getReadNoticeIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_NOTICES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function markNoticeAsRead(id: string): Promise<void> {
  try {
    const current = await getReadNoticeIds();
    if (!current.includes(id)) {
      current.push(id);
      await AsyncStorage.setItem(STORAGE_KEY_NOTICES, JSON.stringify(current));
      notifyListeners();
    }
  } catch (err) {
    console.warn("markNoticeAsRead error:", err);
  }
}

export async function markAllNoticesAsRead(ids: string[]): Promise<void> {
  try {
    const current = await getReadNoticeIds();
    const merged = Array.from(new Set([...current, ...ids]));
    await AsyncStorage.setItem(STORAGE_KEY_NOTICES, JSON.stringify(merged));
    notifyListeners();
  } catch (err) {
    console.warn("markAllNoticesAsRead error:", err);
  }
}

export async function getSeenDocIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_DOCS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function markDocsAsSeen(ids: string[]): Promise<void> {
  try {
    const current = await getSeenDocIds();
    const merged = Array.from(new Set([...current, ...ids]));
    await AsyncStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(merged));
    notifyListeners();
  } catch (err) {
    console.warn("markDocsAsSeen error:", err);
  }
}

export async function getLastSeenFeesTimestamp(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_FEES);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

export async function markFeesAsSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_FEES, Date.now().toString());
    notifyListeners();
  } catch (err) {
    console.warn("markFeesAsSeen error:", err);
  }
}

// React hook to listen to read status changes locally
export function useReadStatus() {
  const [readNoticeIds, setReadNoticeIds] = useState<string[]>([]);
  const [seenDocIds, setSeenDocIds] = useState<string[]>([]);
  const [lastSeenFeesTs, setLastSeenFeesTs] = useState<number>(0);

  const refresh = useCallback(async () => {
    const [notices, docs, fees] = await Promise.all([
      getReadNoticeIds(),
      getSeenDocIds(),
      getLastSeenFeesTimestamp(),
    ]);
    setReadNoticeIds(notices);
    setSeenDocIds(docs);
    setLastSeenFeesTs(fees);
  }, []);

  useEffect(() => {
    void refresh();
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
    };
  }, [refresh]);

  return {
    readNoticeIds,
    seenDocIds,
    lastSeenFeesTs,
    refresh,
  };
}
