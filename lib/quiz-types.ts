import { compactVerbForms } from "@/lib/quiz-verb-forms";

export type QuizRecord = {
  id: string;
  classId: string;
  title: string;
  description: string;
  mode: "tense_family" | "tense_form" | "custom";
  level: string;
  questionLanguage: string;
  answerLanguage: string;
  options: string[];
  sourceQuizId: string | null;
  voiceId: string;
  createdAt: string;
  questionCount?: number;
  dueCount?: number;
};

export type QuizQuestionRecord = {
  id: string;
  quizId: string;
  prompt: string;
  answerIndex: number;
  options: string[];
  familyIndex: number | null;
  example: string;
  explanation: string;
  position: number;
};

export type QuizProgressRecord = {
  questionId: string;
  level: number;
  lastGrade: string | null;
  lastReviewedAt: string | null;
  nextReviewAt: string;
  repetitions: number;
};

export type QuizDetail = {
  quiz: QuizRecord;
  questions: QuizQuestionRecord[];
  progress: QuizProgressRecord[];
};

export function quizQuestionOptions(quiz: QuizRecord, question: QuizQuestionRecord): string[] {
  const options = question.options.length ? question.options : quiz.options;
  return quiz.mode === "tense_form" ? compactVerbForms(options) : options;
}
