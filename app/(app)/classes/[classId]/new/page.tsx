"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useCreateTopic } from "@/lib/hooks/use-mutations";
import { FloatingBar } from "@/components/floating-bar";
import { ActionButton } from "@/components/action-button";
import { useScreenBg } from "@/lib/hooks/use-screen-bg";

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
type VoiceOption = { id: string; name: string; description: string; gender: string };
const DEFAULT_VOICES = ["UQoLnPXvf18gaKpLzfb8", "EXAVITQu4vr4xnSDxMaL", "JBFqnCBsd6RMkjVDRZzb"];
const LAST_VOICES_KEY = "uhura:lastVoiceIds";

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
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("B1");
  const [goalKind, setGoalKind] = useState("situation");
  const [focus, setFocus] = useState("");
  const [practiceStyle, setPracticeStyle] = useState("varied");
  const [register, setRegister] = useState("neutral_spoken");
  const [voiceIds, setVoiceIds] = useState<string[]>(DEFAULT_VOICES);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const createTopic = useCreateTopic();

  useEffect(() => {
    let active = true;
    fetch("/api/voices").then(async (res) => {
      if (!res.ok) throw new Error("Voices are temporarily unavailable");
      return res.json();
    }).then((data: { voices: VoiceOption[] }) => {
      if (!active) return;
      setVoices(data.voices);
      const available = new Set(data.voices.map((voice) => voice.id));
      let remembered: unknown = null;
      try { remembered = JSON.parse(localStorage.getItem(LAST_VOICES_KEY) ?? "null"); } catch { /* use defaults */ }
      setVoiceIds((selected) => {
        if (Array.isArray(remembered)) selected = remembered.filter((id): id is string => typeof id === "string");
        const valid = selected.filter((id) => available.has(id));
        return valid.length ? valid : DEFAULT_VOICES.filter((id) => available.has(id)).length
          ? DEFAULT_VOICES.filter((id) => available.has(id))
          : data.voices.slice(0, 1).map((voice) => voice.id);
      });
    }).catch((error) => { if (active) setVoicesError(error.message); });
    return () => { active = false; previewRef.current?.pause(); };
  }, []);

  function toggleVoice(id: string) {
    setVoiceIds((selected) => selected.includes(id)
      ? selected.length > 1 ? selected.filter((value) => value !== id) : selected
      : [...selected, id]);
  }

  function playPreview(id: string) {
    previewRef.current?.pause();
    const audio = new Audio(`/api/voices/preview?voiceId=${encodeURIComponent(id)}`);
    previewRef.current = audio;
    audio.play().catch(() => setVoicesError("Could not play this voice sample"));
  }

  function handleSubmit() {
    createTopic.mutate(
      { description, level, classId, goalKind, focus, practiceStyle, register, voiceIds },
      { onSuccess: () => {
        localStorage.setItem(LAST_VOICES_KEY, JSON.stringify(voiceIds));
        router.replace(`/classes/${classId}`);
      } }
    );
  }

  return (
    <div className="flex flex-col items-stretch min-h-svh w-full max-w-2xl mx-auto p-6 pb-44">
      <Link
        href={`/classes/${classId}`}
        className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition-transform duration-200 active:translate-y-0.5 active:duration-0"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>

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
        <div className="flex justify-center gap-2">
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
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
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Voices · select one or more. Each sentence keeps its assigned voice.</p>
          <div className="grid grid-cols-2 gap-2">
            {voices.map((voice) => <div key={voice.id} className={`rounded-lg p-2 bg-card ${voiceIds.includes(voice.id) ? "ring-1 ring-primary" : ""}`}>
              <button type="button" aria-pressed={voiceIds.includes(voice.id)} onClick={() => toggleVoice(voice.id)}
                className="w-full text-left text-sm"><span aria-hidden="true">{voiceIds.includes(voice.id) ? "✓ " : "+ "}</span>{voice.name}</button>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{voice.description}</span>
                <button type="button" onClick={() => playPreview(voice.id)} aria-label={`Play ${voice.name} voice sample`} className="p-1 text-primary">▶</button>
              </div>
            </div>)}
          </div>
          {voicesError && <p role="alert" className="text-xs text-destructive">{voicesError}</p>}
        </div>
        {createTopic.error && <p role="alert" className="text-sm text-destructive">{createTopic.error.message}</p>}
      </div>

      <FloatingBar>
        <ActionButton
          onClick={handleSubmit}
          disabled={createTopic.isPending || !description.trim() || (goalKind !== "situation" && !focus.trim()) || voiceIds.length === 0 || voices.length === 0}
          icon={createTopic.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
        >
          {createTopic.isPending ? "Generating..." : "Create topic"}
        </ActionButton>
      </FloatingBar>
    </div>
  );
}
