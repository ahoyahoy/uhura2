// Rating 1-5: 1,2 = pass (umíš, odlož), 3,4,5 = fail (neumíš, opakuj)
export type Grade = 1 | 2 | 3 | 4 | 5;

// Intervaly v dnech pro každý level
const INTERVALS = [0, 1, 3, 7, 15, 30, 60, 120];
const MAX_LEVEL = INTERVALS.length - 1;

// Modifikátor intervalu podle počtu opakování v session (ze starého algoritmu)
const REPETITION_MODIFIERS = [1, 1, 0.75, 0.75, 0.5];

export function getNextLevel(currentLevel: number, grade: Grade): number {
  switch (grade) {
    case 1:
      return Math.min(currentLevel + 1, MAX_LEVEL); // perfect → next level
    case 2:
      return Math.max(currentLevel, 1); // good → same level, ale min 1 (aby se odložilo na zítra)
    case 3:
      return Math.max(currentLevel - 1, 0); // so-so → level down
    case 4:
      return Math.max(currentLevel - 2, 0); // bad → 2 levels down
    case 5:
      return 0; // no idea → reset
  }
}

export function getNextReviewDate(
  level: number,
  repetitions: number
): Date {
  const now = new Date();
  const baseDays = INTERVALS[Math.min(level, MAX_LEVEL)];

  const modIndex = Math.min(
    repetitions,
    REPETITION_MODIFIERS.length - 1
  );
  const modifier = REPETITION_MODIFIERS[modIndex];
  const days = Math.max(Math.round(baseDays * modifier), level === 0 ? 0 : 1);

  now.setDate(now.getDate() + days);
  return now;
}

export function isGradePass(grade: Grade): boolean {
  return grade <= 2;
}

/**
 * Weighted random selection ze starého algoritmu.
 * Kombinuje jak dlouho jsi větu neviděl + jak je těžká.
 */
export function weightedShuffle<
  T extends { lastReviewedAt?: Date | string | null; level?: number | null }
>(items: T[]): T[] {
  if (items.length <= 1) return items;

  const timestamps = items.map((item) => {
    if (!item.lastReviewedAt) return 0;
    return new Date(item.lastReviewedAt).getTime();
  });
  const minTs = Math.min(...timestamps);
  const maxTs = Math.max(...timestamps);
  const range = maxTs - minTs || 1;

  const pool: number[] = [];
  items.forEach((item, index) => {
    const ts = timestamps[index];
    const timePosition = (ts - minTs) / range;
    const timeMultiplier = Math.floor(timePosition * 19) + 1;

    const level = item.level ?? 0;
    const difficultyMultiplier = Math.max(30 - level * 5, 10);

    const copies = Math.ceil(timeMultiplier + difficultyMultiplier);
    for (let i = 0; i < copies; i++) {
      pool.push(index);
    }
  });

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const seen = new Set<number>();
  const order: number[] = [];
  for (const idx of pool) {
    if (!seen.has(idx)) {
      seen.add(idx);
      order.push(idx);
    }
  }

  return order.map((i) => items[i]);
}
