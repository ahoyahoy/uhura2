"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useCreateTopic } from "@/lib/hooks/use-mutations";
import { FloatingBar } from "@/components/floating-bar";
import { ActionButton } from "@/components/action-button";
import { useScreenBg } from "@/lib/hooks/use-screen-bg";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

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
  const [showTemplates, setShowTemplates] = useState(false);

  const createTopic = useCreateTopic();

  async function handleSubmit() {
    createTopic.mutate(
      { description, level, classId },
      { onSuccess: () => router.replace(`/classes/${classId}`) }
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
                      : "bg-white hover:bg-primary/10"
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
          className="w-full rounded-lg px-4 py-3 text-sm bg-white resize-none overflow-hidden"
          placeholder="Describe what you want to practice..."
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          rows={3}
        />
        <div className="flex justify-center gap-2">
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                level === l
                  ? "bg-primary text-primary-foreground"
                  : "bg-white hover:bg-primary/10"
              }`}
              onClick={() => setLevel(l)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <FloatingBar>
        <ActionButton
          onClick={handleSubmit}
          disabled={createTopic.isPending || !description.trim()}
          icon={createTopic.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
        >
          {createTopic.isPending ? "Generating..." : "Create topic"}
        </ActionButton>
      </FloatingBar>
    </div>
  );
}
