import Dexie, { type EntityTable } from "dexie";

export interface IDBClass {
  id: string;
  sourceLanguage: string;
  targetLanguage: string;
  createdAt: string;
}

export interface IDBTopic {
  id: string;
  classId: string | null;
  title: string;
  description: string;
  level: string;
  goalKind?: string;
  focus?: string;
  practiceStyle?: string;
  register?: string;
  voiceIds?: string[];
  createdAt: string;
}

export interface IDBSentence {
  id: string;
  topicId: string;
  sourceText: string;
  targetText: string;
  voiceId?: string | null;
  createdAt: string;
}

export interface IDBProgress {
  sentenceId: string;
  level: number;
  lastGrade: string | null;
  lastReviewedAt: string | null;
  nextReviewAt: string;
  repetitions: number;
}

export const idb = new Dexie("uhura") as Dexie & {
  classes: EntityTable<IDBClass, "id">;
  topics: EntityTable<IDBTopic, "id">;
  sentences: EntityTable<IDBSentence, "id">;
  progress: EntityTable<IDBProgress, "sentenceId">;
};

idb.version(2).stores({
  classes: "id",
  topics: "id, classId",
  sentences: "id, topicId",
  progress: "sentenceId",
});
