export const STORAGE_KEYS = {
  draft: 'yst-draft-v1',
  history: 'yst-history-v1',
  displayName: 'yst-display-name-v1',
} as const;

export type DraftEntry = {
  url: string;
  html: string;
  updatedAt: number;
};

export type HistoryEntry = {
  id: string;
  url: string;
  title: string;
  videoId: string | null;
  html: string;
  createdAt: number;
};

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadDraft(): DraftEntry | null {
  if (typeof window === 'undefined') return null;
  const d = safeParse<DraftEntry>(localStorage.getItem(STORAGE_KEYS.draft));
  if (!d || typeof d.url !== 'string' || typeof d.html !== 'string') return null;
  return d;
}

export function saveDraft(entry: DraftEntry): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(entry));
}

export function clearDraft(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.draft);
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  const raw = safeParse<unknown>(localStorage.getItem(STORAGE_KEYS.history));
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (h): h is HistoryEntry =>
      h &&
      typeof h === 'object' &&
      typeof (h as HistoryEntry).id === 'string' &&
      typeof (h as HistoryEntry).url === 'string' &&
      typeof (h as HistoryEntry).html === 'string' &&
      typeof (h as HistoryEntry).createdAt === 'number',
  );
}

export function saveHistory(entries: HistoryEntry[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(entries.slice(0, 50)));
}

export function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'createdAt'>): HistoryEntry {
  const full: HistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  const prev = loadHistory().filter((h) => h.url !== entry.url);
  saveHistory([full, ...prev]);
  return full;
}

export function removeHistoryEntry(id: string): void {
  const prev = loadHistory().filter((h) => h.id !== id);
  saveHistory(prev);
}

export function getDisplayName(): string {
  if (typeof window === 'undefined') return '访客';
  return localStorage.getItem(STORAGE_KEYS.displayName)?.trim() || '访客';
}
