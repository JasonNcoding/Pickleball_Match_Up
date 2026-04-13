'use client';
import { useEffect, useRef } from 'react';
import { saveTournamentState } from '@/app/lib/actions';

/**
 * Debounced persistence hook.
 * Fires a 500ms debounced save whenever `saveKey` changes (as long as
 * `isHydrated` and `canSave` are both true).
 *
 * `saveKey` is an integer that each reducer increments on every dirty action
 * (but NOT on LOAD_STATE or MARK_SAVED), so the effect only re-runs when real
 * mutations happen.
 */
export function usePersistence(
  isHydrated: boolean,
  canSave: boolean,
  saveKey: number,
  buildSnapshot: () => unknown,
  onSaved: () => void,
  onError: (msg: string) => void,
): void {
  // Keep latest callbacks in refs so the effect closure never goes stale.
  const snapshotRef = useRef(buildSnapshot);
  snapshotRef.current = buildSnapshot;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!isHydrated || !canSave) return;

    const timeoutId = setTimeout(async () => {
      const snapshot = snapshotRef.current();
      try {
        const result = await saveTournamentState(snapshot);
        if (result?.success) {
          onSavedRef.current();
        } else {
          onErrorRef.current('Cloud sync failed');
        }
      } catch {
        onErrorRef.current('Cloud sync failed');
      }
    }, 500);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, canSave, saveKey]);
}
