import { useCallback, useEffect, useMemo, useState } from 'react';
import { householdDislikes, profilesFrom, type ProfileRow } from './model';
import { loadProfiles } from './repo';

export function useProfiles(householdId: string | null) {
  const [rows, setRows] = useState<ProfileRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const reload = useCallback(async () => {
    try {
      setRows(await loadProfiles());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    if (householdId) void reload();
  }, [householdId, reload]);
  const profiles = useMemo(() => profilesFrom(rows ?? []), [rows]);
  const dislikes = useMemo(() => householdDislikes(profiles), [profiles]);
  return { profiles, dislikes, loaded: rows !== null, failed, reload };
}
