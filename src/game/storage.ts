/**
 * Best-score persistence via localStorage. All access is wrapped in try/catch
 * so the game still works where localStorage is unavailable or throws (private
 * mode, blocked cookies) - per the definition of done (section 8).
 */

const KEY = 'kitten-chaos.progress.v1';

export interface BestResult {
  score: number;
  stars: number;
}

type Progress = Record<string, BestResult>;

function loadAll(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Progress) : {};
  } catch {
    return {};
  }
}

export function getBest(levelId: string): BestResult | null {
  return loadAll()[levelId] ?? null;
}

/**
 * Record a result if it beats the stored best. Returns true if it was a new
 * best (or the first result for this level).
 */
export function saveBest(levelId: string, result: BestResult): boolean {
  const all = loadAll();
  const current = all[levelId];
  const isBetter = !current || result.score > current.score || result.stars > current.stars;
  if (!isBetter) return false;
  all[levelId] = {
    score: Math.max(result.score, current?.score ?? 0),
    stars: Math.max(result.stars, current?.stars ?? 0),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Persistence unavailable; the session still plays fine.
  }
  return true;
}
