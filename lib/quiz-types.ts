export type QuizRecord = {
  id: string;
  classId: string;
  title: string;
  description: string;
  mode: "tense_family" | "custom";
  level: string;
  questionLanguage: string;
  answerLanguage: string;
  options: string[];
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
