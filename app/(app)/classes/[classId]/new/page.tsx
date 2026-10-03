"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, ChevronDown, Pause, Volume2 } from "lucide-react";
import Link from "next/link";
import { useCreateTopic } from "@/lib/hooks/use-mutations";
import { FloatingBar } from "@/components/floating-bar";
import { ActionButton } from "@/components/action-button";
import { useScreenBg } from "@/lib/hooks/use-screen-bg";
import { VOICES } from "@/lib/voice-catalog";
import { voiceVolume } from "@/lib/voice-volume";
import { setStoredString, useStoredString } from "@/lib/hooks/use-stored-string";
import { useSync } from "@/lib/hooks/use-sync";
import { voiceName } from "@/lib/voice-names";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const GOALS = [
  { id: "situation", label: "Situation" },
  { id: "vocabulary", label: "Word / phrase" },
  { id: "grammar", label: "Grammar" },
  { id: "contrast", label: "Compare" },
];
const STYLES = [
  { id: "fixed", label: "Fixed pattern" },
  { id: "varied", label: "Varied use" },
  { id: "situational", label: "In context" },
];
const REGISTERS = [
  { id: "neutral_spoken", label: "Everyday" },
  { id: "informal", label: "Casual" },
  { id: "work_polite", label: "Polite work" },
  { id: "formal_written", label: "Formal writing" },
];
const DEFAULT_VOICES = ["UQoLnPXvf18gaKpLzfb8", "EXAVITQu4vr4xnSDxMaL", "JBFqnCBsd6RMkjVDRZzb"];
const LAST_VOICES_KEY = "uhura:lastVoiceIds";

function validVoiceIds(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    const available = new Set<string>(VOICES.map((voice) => voice.id));
    if (Array.isArray(parsed)) {
      const valid = parsed.filter((id): id is string => typeof id === "string" && available.has(id));
      if (valid.length) return [...new Set(valid)];
    }
  } catch { /* use defaults */ }
  return DEFAULT_VOICES;
}

const TEMPLATES = [
  { label: "Introducing yourself", prompt: "Introducing myself — name, age, where I'm from, what I do for a living, my family, basic personal info." },
  { label: "Small talk & socializing", prompt: "Casual small talk — weather, weekend plans, how was your day, general chitchat with colleagues or neighbors." },
  { label: "Meeting new people", prompt: "Getting to know someone new — asking questions, talking about hobbies, finding common interests, at a party or event." },
  { label: "Daily routine", prompt: "Describing my daily routine — morning habits, commute, work schedule, evening activities, what I usually do." },
  { label: "Work & office", prompt: "Office and work situations — meetings, deadlines, asking colleagues for help, talking about projects, email follow-ups." },
  { label: "Job interview", prompt: "Job interview preparation — talking about my experience, strengths, why I want this job, asking about the role." },
  { label: "Restaurant & food", prompt: "At a restaurant — ordering food, asking about the menu, dietary restrictions, paying the bill, recommending dishes." },
  { label: "Shopping", prompt: "Shopping situations — asking about prices, sizes, returning items, comparing products, asking for recommendations." },
  { label: "Travel & directions", prompt: "Traveling — asking for directions, at the airport, booking a hotel, public transport, talking about trips and destinations." },
  { label: "Doctor & health", prompt: "At the doctor — describing symptoms, explaining how I feel, understanding instructions, making appointments, pharmacy." },
  { label: "Opinions & agreeing/disagreeing", prompt: "Expressing opinions — I think, I believe, agreeing and disagreeing politely, discussing topics, giving reasons." },
  { label: "Making plans", prompt: "Making and changing plans — suggesting activities, accepting/declining invitations, scheduling, what should we do." },
  { label: "Complaining & solving problems", prompt: "Complaining politely — something is broken, bad service, wrong order, asking for a refund, resolving issues." },
  { label: "Phone calls & appointments", prompt: "Phone conversations — making appointments, calling customer service, leaving a message, confirming details." },
  { label: "Hobbies & free time", prompt: "Talking about hobbies — sports, reading, music, gaming, what I like to do in my free time, how often I do it." },
  { label: "Feelings & emotions", prompt: "Expressing feelings — happy, frustrated, excited, nervous, tired, explaining why I feel a certain way." },
  { label: "Past experiences", prompt: "Talking about the past — what I did last weekend, childhood memories, past tense stories, have you ever..." },
  { label: "Future plans & goals", prompt: "Future plans and goals — what I want to achieve, where I see myself, planning ahead, I'm going to, I'd like to." },
];

export default function NewTopicPage() {
  useScreenBg("tinted");
  const router = useRouter();
  const { classId } = useParams<{ classId: string }>();
  const { data: syncData } = useSync();
  const targetLanguage = syncData?.classes.find((course) => course.id === classId)?.targetLanguage;
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("B1");
  const [goalKind, setGoalKind] = useState("situation");
  const [focus, setFocus] = useState("");
  const [practiceStyle, setPracticeStyle] = useState("varied");
  const [register, setRegister] = useState("neutral_spoken");
  const rememberedVoices = useStoredString(LAST_VOICES_KEY, JSON.stringify(DEFAULT_VOICES));
  const [draftVoiceIds, setDraftVoiceIds] = useState<string[] | null>(null);
  const voiceIds = draftVoiceIds ?? validVoiceIds(rememberedVoices);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const [previewState, setPreviewState] = useState<{ id: string; status: "loading" | "playing" } | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const createTopic = useCreateTopic();

  useEffect(() => {
    return () => { previewRef.current?.pause(); previewRef.current = null; };
  }, []);

  function toggleVoice(id: string) {
    setDraftVoiceIds((draft) => {
      const selected = draft ?? validVoiceIds(rememberedVoices);
      return selected.includes(id)
        ? selected.length > 1 ? selected.filter((value) => value !== id) : selected
        : [...selected, id];
    });
  }

  function playPreview(id: string) {
    if (previewState?.id === id && previewState.status === "loading") return;
    if (previewState?.id === id && previewState.status === "playing") {
      previewRef.current?.pause();
      previewRef.current = null;
      setPreviewState(null);
      return;
    }
    previewRef.current?.pause();
    const audio = new Audio(`/api/voices/preview?voiceId=${encodeURIComponent(id)}&classId=${encodeURIComponent(classId)}`);
    audio.volume = voiceVolume(id);
    previewRef.current = audio;
    setPreviewState({ id, status: "loading" });
    audio.onplaying = () => { if (previewRef.current === audio) setPreviewState({ id, status: "playing" }); };
    audio.onwaiting = () => { if (previewRef.current === audio) setPreviewState({ id, status: "loading" }); };
    audio.onended = () => { if (previewRef.current === audio) { previewRef.current = null; setPreviewState(null); } };
    audio.onerror = () => { if (previewRef.current === audio) { previewRef.current = null; setPreviewState(null); } };
    audio.play().catch((error) => {
      if (previewRef.current === audio) {
        console.warn("Voice sample playback failed", error);
        previewRef.current = null;
        setPreviewState(null);
      }
    });
  }

  function handleSubmit() {
    createTopic.mutate(
      { description, level, classId, goalKind, focus, practiceStyle, register, voiceIds },
      { onSuccess: () => {
        setStoredString(LAST_VOICES_KEY, JSON.stringify(voiceIds));
        router.replace(`/classes/${classId}`);
      } }
    );
  }

  return (
    <div className="flex flex-col items-stretch min-h-svh w-full max-w-2xl mx-auto p-6 pb-44">
      <div className="fixed inset-x-0 top-0 z-30 pointer-events-none">
        <div className="w-full max-w-2xl mx-auto px-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
          <Link
            href={`/classes/${classId}`}
            aria-label="Back to course"
            className="pointer-events-auto inline-flex items-center justify-center h-9 w-9 rounded-full bg-card/90 text-primary shadow-sm backdrop-blur-sm hover:bg-card transition-transform duration-200 active:translate-y-0.5 active:duration-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <div className="h-9" aria-hidden="true" />

      <h1 className="mt-auto mb-12 text-4xl font-normal">New Topic</h1>

      <div className="space-y-4 mb-8">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowTemplates(true)}
        >
          Templates
          <ChevronDown className="h-3.5 w-3.5" />
        </button>

        {showTemplates && (
          <div
            className="fixed inset-0 z-50 bg-[var(--background)] flex flex-col justify-center p-8"
            onClick={() => setShowTemplates(false)}
          >
            <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
              {TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  className={`px-4 py-2 text-sm rounded-full transition-colors ${
                    description === t.prompt
                      ? "bg-primary text-primary-foreground"
                      : "bg-card hover:bg-primary/10"
                  }`}
                  onClick={() => { setDescription(t.prompt); setShowTemplates(false); }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <textarea
          className="w-full rounded-lg px-4 py-3 text-sm bg-card resize-none overflow-hidden"
          placeholder="Describe what you want to practice..."
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          rows={3}
        />
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">What should these sentences teach?</p>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((goal) => <button key={goal.id} type="button" aria-pressed={goalKind === goal.id}
              className={`rounded-full px-3 py-1.5 text-xs ${goalKind === goal.id ? "bg-primary text-primary-foreground" : "bg-card"}`}
              onClick={() => setGoalKind(goal.id)}>{goal.label}</button>)}
          </div>
          {goalKind !== "situation" && <input value={focus} onChange={(event) => setFocus(event.target.value)}
            className="w-full rounded-lg bg-card px-4 py-3 text-sm" maxLength={200}
            placeholder={goalKind === "vocabulary" ? "e.g. borrow — take and return later" : goalKind === "contrast" ? "e.g. borrow vs lend" : "e.g. used to — past habits"}
            aria-label="Learning focus" />}
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Practice style</p>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((style) => <button key={style.id} type="button" aria-pressed={practiceStyle === style.id}
              className={`rounded-full px-3 py-1.5 text-xs ${practiceStyle === style.id ? "bg-primary text-primary-foreground" : "bg-card"}`}
              onClick={() => setPracticeStyle(style.id)}>{style.label}</button>)}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Tone</p>
          <div className="flex flex-wrap gap-2">
            {REGISTERS.map((item) => <button key={item.id} type="button" aria-pressed={register === item.id}
              className={`rounded-full px-3 py-1.5 text-xs ${register === item.id ? "bg-primary text-primary-foreground" : "bg-card"}`}
              onClick={() => setRegister(item.id)}>{item.label}</button>)}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Level</p>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={level === l}
                className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                  level === l
                    ? "bg-primary text-primary-foreground"
                    : "bg-card hover:bg-primary/10"
                }`}
                onClick={() => setLevel(l)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Voices · choose one or more. Samples speak the language of this course.</p>
          <div className="grid grid-cols-2 gap-2">
            {targetLanguage ? VOICES.map((voice) => {
              const name = voiceName(voice.id, targetLanguage);
              return <div key={voice.id} className={`relative rounded-lg bg-card ${voiceIds.includes(voice.id) ? "ring-1 ring-primary" : ""}`}>
              <button type="button" aria-pressed={voiceIds.includes(voice.id)} onClick={() => toggleVoice(voice.id)}
                className="w-full min-h-18 rounded-lg p-3 pr-12 text-left hover:bg-primary/5 transition-colors">
                <span className="flex items-center gap-1.5 text-sm">{name}{voiceIds.includes(voice.id) && <Check aria-hidden="true" className="h-3.5 w-3.5 text-primary" />}</span>
                <span className="block text-xs text-muted-foreground">
                  {previewState?.id === voice.id ? previewState.status === "loading" ? "Loading sample…" : "Playing sample" : voice.description}
                </span>
              </button>
              <button type="button" onClick={() => playPreview(voice.id)}
                disabled={previewState?.id === voice.id && previewState.status === "loading"}
                aria-label={`${previewState?.id === voice.id ? previewState.status === "loading" ? "Loading" : "Stop" : "Play"} ${name} voice sample`}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary disabled:opacity-70">
                {previewState?.id === voice.id && previewState.status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" />
                  : previewState?.id === voice.id && previewState.status === "playing" ? <Pause className="h-4 w-4" />
                  : <Volume2 className="h-4 w-4" />}
              </button>
            </div>;
            }) : <div className="col-span-2 flex justify-center py-4"><Loader2 aria-label="Loading voices" className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
          </div>
        </div>
      </div>

      <FloatingBar>
        <ActionButton
          onClick={handleSubmit}
          disabled={createTopic.isPending || !targetLanguage || !description.trim() || (goalKind !== "situation" && !focus.trim()) || voiceIds.length === 0}
          icon={createTopic.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
        >
          {createTopic.isPending ? "Generating..." : createTopic.isError ? "Try again" : "Create topic"}
        </ActionButton>
      </FloatingBar>
    </div>
  );
}
