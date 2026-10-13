export const TENSE_FAMILY_OPTIONS = ["Simple", "Continuous", "Perfect Simple", "Perfect Continuous"] as const;
export const TENSE_FAMILY_OPTIONS_CS = ["Prostý", "Průběhový", "Perfektní prostý", "Perfektní průběhový"] as const;
export const QUIZ_MODES = ["tense_family", "custom"] as const;
export type QuizMode = (typeof QUIZ_MODES)[number];
export const MAX_QUIZ_QUESTIONS = 200;
export const QUIZ_BATCH_SIZE = 10;

export function tenseOptions(language: string): string[] | null {
  if (language === "en") return [...TENSE_FAMILY_OPTIONS];
  if (language === "cs") return [...TENSE_FAMILY_OPTIONS_CS];
  return null;
}

export type QuizPlan = {
  title: string;
  description: string;
  mode: QuizMode;
  level: string;
  questionLanguage: string;
  answerLanguage: string;
  options: string[];
};

export type QuizItem = {
  prompt: string;
  answerIndex: number;
  example: string;
  explanation: string;
};
