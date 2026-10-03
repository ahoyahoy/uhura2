# Uhura

Uhura is a language practice app built with Next.js, Better Auth, Neon/Drizzle, OpenAI and ElevenLabs. The production app is [uhura2.vercel.app](https://uhura2.vercel.app).

## Local development

Install dependencies with `pnpm install`, configure `.env.local`, then run `pnpm dev`. The app uses [localhost:3017](http://localhost:3017) for both `dev` and `start`, so it does not collide with projects on port 3000. For Google login, use `BETTER_AUTH_URL=http://localhost:3017` and `NEXT_PUBLIC_APP_URL=http://localhost:3017`; the OAuth client's redirect URI must include `http://localhost:3017/api/auth/callback/google`.

Do not commit `.env.local`. The server needs the configured database, auth, OpenAI, and ElevenLabs environment variables. Run `pnpm exec drizzle-kit migrate` when applying the checked-in migrations to a fresh database.

## Lessons and audio

Lesson creation stores the learning goal, focus, practice style, register, and a selection of up to six curated voices. The selected voice IDs are remembered in this browser for the next lesson; their displayed names are stable aliases for each target language, transliterated into Latin script where needed. Each voice card is selectable as a whole; its sample is generated in the course's target language, cached permanently, and shows loading/playback state. Sarah's underlying voice ID is played at a lower volume to match the others. The backend assigns one voice to each sentence, avoiding the immediately previous voice when possible. Adding sentences keeps the same lesson goal and sends the existing sentence pairs to the generator; the server filters duplicates and runs a bounded teacher review. Generated pairs can be reviewed and edited before practice.

The browser requests speech with a sentence ID only. The server checks ownership, loads text and voice, calls ElevenLabs Turbo v4, and stores the audio in the database with a key based on model, language, voice and text. Cached audio is reused indefinitely; editing a sentence creates a new cache key. Uncached speech is limited to 10,000 input characters per UTC day across the app.

See [sentence generation design](docs/SENTENCE-GENERATION-DESIGN.md) and [Turbo trial](docs/TTS-TURBO-TRIAL.md) for the reasoning and evaluation limits.
