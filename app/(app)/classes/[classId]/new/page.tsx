"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useCreateTopic } from "@/lib/hooks/use-mutations";

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
  const router = useRouter();
  const { classId } = useParams<{ classId: string }>();
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("B1");
  const [showTemplates, setShowTemplates] = useState(false);

  const createTopic = useCreateTopic();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createTopic.mutate(
      { description, level, classId },
      { onSuccess: () => router.replace(`/classes/${classId}`) }
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 space-y-6">
      <Link
        href={`/classes/${classId}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>New Topic</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="description">Prompt</Label>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowTemplates(!showTemplates)}
                >
                  From template
                  <ChevronDown className={`h-3 w-3 transition-transform ${showTemplates ? "rotate-180" : ""}`} />
                </button>
              </div>
              {showTemplates && (
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                        description === t.prompt
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:bg-accent border-border"
                      }`}
                      onClick={() => { setDescription(t.prompt); setShowTemplates(false); }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
              <Textarea
                id="description"
                placeholder="Describe what you want to practice..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Level</Label>
              <div className="flex gap-2">
                {LEVELS.map((l) => (
                  <Button key={l} type="button" variant={level === l ? "default" : "outline"} size="sm" onClick={() => setLevel(l)}>
                    {l}
                  </Button>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={createTopic.isPending || !description.trim()}>
              {createTopic.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {createTopic.isPending ? "Generating sentences..." : "Create & Generate Sentences"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
