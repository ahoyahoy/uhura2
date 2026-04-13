Tady máš čistě strukturovaný **Markdown spec**, připravený tak, aby to šlo rovnou hodit do Cloud Code / repo jako zadání 👇

---

# 🧠 AI Sentence Trainer – Specifikace

## 🎯 Cíl aplikace

Aplikace slouží k tréninku mluvené angličtiny pomocí **opakování a variací vět generovaných AI**.

Hlavní princip:

* uživatel si vytvoří **topic (téma)**
* AI generuje **varianty vět** (CZ → EN)
* uživatel:

  * vidí českou větu
  * snaží se ji říct anglicky
  * zobrazí správnou odpověď
  * nechá si ji přečíst (TTS)
  * ohodnotí, jak si vedl
* systém věty **řadí a opakuje (spaced repetition-like)**

Cílem není memorovat konkrétní věty, ale:

> osvojit si **patterny a konstrukce jazyka**

---

## 🧱 Tech Stack

### Frontend

* Next.js
* React
* TypeScript
* UI komponenty:

  * shadcn/ui (instalace přes `pnpm`, negenerovat ručně)

### Backend

* Next.js API routes / server actions
* Vercel AI SDK
* Vercel AI Gateway (multi-model access)

### AI

* model:

  * ChatGPT (preferovaný pro generování vět)
* přístup přes Vercel AI gateway (env klíče)

### Speech

* STT (speech-to-text):

  * Vercel / OpenAI Whisper (transcribe)
* TTS (text-to-speech):

  * generování audio z anglických vět

### Databáze

* jednoduchá DB (např. Postgres / SQLite / Vercel KV)
* ukládání:

  * topics
  * sentences
  * user ratings

---

## 🧩 Hlavní funkce

### 1. Topic creation

#### UI:

* input: název topicu
* microphone input:

  * uživatel nadiktuje zadání (např. „chci trénovat fitness a daily routine“)

#### Flow:

1. audio → STT → text
2. user text upraví (edit)
3. submit

#### Výsledek:

uložený topic obsahuje:

```ts
type Topic = {
  id: string
  title: string
  description: string // prompt pro LLM
  createdAt: Date
}
```

---

### 2. Generování vět

#### Trigger:

* po vytvoření topicu
* nebo manuální „generate more“

#### Požadavky na LLM:

* generovat **více variant stejného patternu**
* ne jen random věty
* důraz na:

  * opakovatelnost struktur
  * mírné variace

#### Formát:

```ts
type Sentence = {
  id: string
  topicId: string
  cz: string
  en: string
  createdAt: Date

  // learning metadata
  score: number
  lastReviewedAt?: Date
  nextReviewAt?: Date
  repetitions: number
}
```

#### Prompt (koncept):

* vstup: topic.description
* instrukce:

  * generuj 10–20 vět
  * drž se jednoho patternu
  * variuj:

    * subject
    * activity
    * context
  * zachovej:

    * strukturu (např. "I’ve been X for the last few months")

---

### 3. Learning mode (hlavní obrazovka)

#### Flow:

1. zobraz:

   * CZ věta

2. user:

   * řekne EN (nahlas / v hlavě)

3. klik:

   * "Show answer"

4. zobraz:

   * EN věta

5. TTS:

   * automaticky přehraje správnou výslovnost

6. user rating:

   * např:

     * ❌ nevěděl
     * 😐 skoro
     * ✅ správně

---

### 4. Repetition algoritmus

Použít (nebo upravit) existující algoritmus ze staré appky.

#### Minimální logika:

* každá věta má score
* podle ratingu:

  * zvýšit / snížit prioritu
* plánování:

  * `nextReviewAt`

#### Cíl:

* horší věty → častěji
* lepší věty → méně často

#### Alternativa:

* inspirovat se:

  * Anki / SM-2 algorithm

---

### 5. TTS (Text-to-Speech)

* při zobrazení EN věty:

  * automaticky přehrát audio
* možnost replay

---

### 6. STT (Speech-to-Text)

* pouze pro:

  * zadání topicu

---

## 📱 Obrazovky

### 1. Topics list

* seznam topiců
* tlačítko: "New topic"

### 2. Create topic

* title
* microphone input
* edit text
* submit

### 3. Learning screen

* CZ sentence
* "Show answer"
* EN sentence
* TTS playback
* rating buttons

### 4. Sentence management (optional)

* list vět
* regenerate / delete

---

## 🧠 Learning filozofie (důležité pro AI)

Aplikace NENÍ:

* klasický vocab trainer

Aplikace JE:

* pattern learning engine

LLM musí:

* generovat:

  * podobné věty
  * stejné struktury
* ne:

  * úplně random obsah

---

## 🔁 Generování variací (klíč feature)

Příklad:

Base:

```
I’ve been slacking the last few months
```

Variace:

```
I’ve been procrastinating the last few weeks
I’ve been skipping workouts lately
I’ve been ignoring my routine for a while
```

➡️ zachovat:

* tense
* structure
* flow

➡️ měnit:

* slova
* kontext

---

## 🚀 Budoucí rozšíření

* voice input pro odpovědi (porovnání s EN)
* AI feedback na výslovnost
* adaptive difficulty
* tagging patternů (např. "present perfect continuous")

---

## 🧪 Poznámky pro implementaci

* nepřegenerovávat UI → použít shadcn
* AI calls:

  * izolovat do služby
* generování:

  * batch (10–20 vět)
* caching:

  * ukládat výsledky

---

## 🔑 Environment

```env
AI_GATEWAY_KEY=...
OPENAI_API_KEY=...
```

---

## 🧾 Shrnutí

Core loop:

```
topic → generate sentences → repeat → rate → reorder → repeat
```

---

Tohle je dostatečně konkrétní, aby to Cloud Code mohl rovnou začít stavět, a zároveň otevřený na iterace (hlavně ten repetition engine 👍).
