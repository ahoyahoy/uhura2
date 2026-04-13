/**
 * Session engine převzatý ze starého Uhura algoritmu.
 *
 * Pool vět, weighted random výběr, pass odebírá z poolu, fail nechává.
 */

const TTL_SETTINGS = {
  ratingModifiers: { 3: 1, 4: 0.5, 5: 0.33 } as Record<number, number>,
  maxRatingHistory: 5,
};

export type SessionSentence = {
  id: string;
  sourceText: string;
  targetText: string;
  topicTitle: string;
  level: number;
  // session-only state
  ratingHistory: number[];
  repeatWeight: number;
  repeatCount: number;
  lastRepeat: number;
};

export type InputSentence = {
  id: string;
  sourceText: string;
  targetText: string;
  topicTitle: string;
  progress: { level: number; lastGrade: string | null } | null;
};

function interpolateRatingModifiers(rating: number): number {
  const floor = Math.floor(rating);
  const ceil = Math.ceil(rating);

  if (floor === ceil) {
    return TTL_SETTINGS.ratingModifiers[floor] ?? 1;
  }

  const w = rating - floor;
  const floorMod = TTL_SETTINGS.ratingModifiers[floor] ?? 1;
  const ceilMod = TTL_SETTINGS.ratingModifiers[ceil] ?? 1;
  return w * ceilMod + (1 - w) * floorMod;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class SessionEngine {
  pool: Map<string, SessionSentence> = new Map();
  activeSentenceId: string | null = null;
  initialCount = 0;

  init(sentences: InputSentence[]) {
    this.pool.clear();
    for (const s of sentences) {
      this.pool.set(s.id, {
        id: s.id,
        sourceText: s.sourceText,
        targetText: s.targetText,
        topicTitle: s.topicTitle,
        level: s.progress?.level ?? 0,
        ratingHistory: [],
        repeatWeight: 4,
        repeatCount: 0,
        lastRepeat: 0,
      });
    }
    this.initialCount = this.pool.size;
    this.activeSentenceId = null;
  }

  get remaining() {
    return this.pool.size;
  }

  getNext(): SessionSentence | null {
    const sentences = Array.from(this.pool.values());
    if (sentences.length === 0) return null;
    if (sentences.length === 1) {
      this.activeSentenceId = sentences[0].id;
      return sentences[0];
    }

    // Time-based multiplier (1-20)
    const sorted = [...sentences].sort((a, b) => a.lastRepeat - b.lastRepeat);
    const minLR = sorted[0].lastRepeat;
    const maxLR = sorted[sorted.length - 1].lastRepeat;
    const range = maxLR - minLR || 1;

    const ids: string[] = [];

    for (const s of sentences) {
      // Skip the currently active sentence to avoid repeating it
      if (sentences.length > 1 && s.id === this.activeSentenceId) continue;

      const timePos = (s.lastRepeat - minLR) / range;
      const timeMul = Math.floor(timePos * 19) + 1; // 1-20
      const weightMul = s.repeatWeight * 10; // 10-30 (default weight 4 → starts at 40, but that's fine)
      const copies = Math.ceil(timeMul + weightMul);

      for (let i = 0; i < copies; i++) {
        ids.push(s.id);
      }
    }

    const shuffled = shuffle(ids);
    const pickedId = shuffled[0];
    this.activeSentenceId = pickedId;
    return this.pool.get(pickedId) ?? null;
  }

  /**
   * Evaluate the current sentence.
   * Returns true if it was a pass (removed from pool).
   */
  evaluate(sentenceId: string, rating: number): boolean {
    const s = this.pool.get(sentenceId);
    if (!s) return false;

    s.repeatCount++;
    s.lastRepeat = Date.now();

    s.ratingHistory.push(rating);
    if (s.ratingHistory.length > TTL_SETTINGS.maxRatingHistory) {
      s.ratingHistory.shift();
    }

    // 1-2 = pass: remove from pool
    if (rating <= 2) {
      this.pool.delete(sentenceId);
      return true;
    }

    // 3-5 = fail: update weight, keep in pool
    const avg =
      s.ratingHistory.reduce((a, b) => a + b, 0) / s.ratingHistory.length;
    s.repeatWeight = 1 / interpolateRatingModifiers(avg);

    return false;
  }
}
