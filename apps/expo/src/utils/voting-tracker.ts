import { useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY_VOTED = "aconvi_voted_session_ids";

// In-memory set for instantaneous synchronous lookup across components
const inMemoryVotedSessions = new Set<string>();

// Pre-load from AsyncStorage into memory immediately on module import
AsyncStorage.getItem(STORAGE_KEY_VOTED)
  .then((raw) => {
    if (raw) {
      const ids: string[] = JSON.parse(raw);
      ids.forEach((id) => inMemoryVotedSessions.add(id));
      notifyListeners();
    }
  })
  .catch(() => {});

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

export function isSessionVotedInMemory(sessionId: string): boolean {
  return inMemoryVotedSessions.has(sessionId);
}

export async function getVotedSessionIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_VOTED);
    const diskIds: string[] = raw ? JSON.parse(raw) : [];
    diskIds.forEach((id) => inMemoryVotedSessions.add(id));
    return Array.from(inMemoryVotedSessions);
  } catch {
    return Array.from(inMemoryVotedSessions);
  }
}

export async function markSessionAsVoted(sessionId: string): Promise<void> {
  if (!sessionId) return;
  // 1. Immediately update in-memory state so any sync check sees it instantly
  inMemoryVotedSessions.add(sessionId);
  notifyListeners();

  // 2. Persist to AsyncStorage asynchronously
  try {
    const diskIds = await getVotedSessionIds();
    const updated = Array.from(new Set([...diskIds, sessionId]));
    await AsyncStorage.setItem(STORAGE_KEY_VOTED, JSON.stringify(updated));
  } catch (err) {
    console.warn("markSessionAsVoted error:", err);
  }
}

export function useVotedSessions() {
  const [votedIds, setVotedIds] = useState<string[]>(() =>
    Array.from(inMemoryVotedSessions),
  );

  const refresh = useCallback(async () => {
    const ids = await getVotedSessionIds();
    setVotedIds([...ids]);
  }, []);

  useEffect(() => {
    // Initial sync
    void refresh();

    // Subscribe to listener updates
    const onUpdate = () => {
      setVotedIds(Array.from(inMemoryVotedSessions));
    };
    listeners.add(onUpdate);
    return () => {
      listeners.delete(onUpdate);
    };
  }, [refresh]);

  const isSessionVoted = useCallback(
    (sessionId?: string | null) => {
      if (!sessionId) return false;
      return (
        inMemoryVotedSessions.has(sessionId) || votedIds.includes(sessionId)
      );
    },
    [votedIds],
  );

  return {
    votedSessionIds: votedIds,
    isSessionVoted,
    markAsVoted: markSessionAsVoted,
  };
}
