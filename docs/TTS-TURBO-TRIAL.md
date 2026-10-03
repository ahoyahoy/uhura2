# Eleven v4 Turbo — ověřený vzorek

Ověřeno 3. 10. 2026: backend úspěšně vytvořil jednu anglickou větu přes
`eleven_v4_turbo`, Text to Dialogue WebSocket API, s hlasem
`UQoLnPXvf18gaKpLzfb8` (Robert — Business Book Narrator).

- Vstup skriptu: pouze ID existující věty; text a jazyk načte z databáze.
- Věta: `03d3acea-d8ae-43c7-9d4d-410e61af7db1`, 79 znaků.
- Výstup: MP3, 44,1 kHz / 128 kbps, 76 113 bajtů.
- Odhad při standardní ceně 0,04 USD / 1 000 znaků: 0,00316 USD bez daně.
  Nejde o potvrzení skutečně zaúčtované ceny; účetní přehled klíč nepovoluje.
- Jeden pokus, maximálně 100 znaků, žádné automatické opakování ani náhradní model.
- Výstup trvale uložen v `tts_cache`; klíč zahrnuje poskytovatele, model, hlas,
  formát, jazyk a text. Staré záznamy se nepřepisují.
- Opakované spuštění ověřeno: čte cache, nevolá generování.

Spuštění z kořene projektu (Node 22); bez `--generate` pouze ověří vstup a cache:

```powershell
node --experimental-strip-types --env-file=.env.local scripts/try-tts-turbo.mjs 03d3acea-d8ae-43c7-9d4d-410e61af7db1 --generate
```

Lokální `.cache/tts-turbo/trial-attempt.json` zabraňuje dalšímu placenému pokusu,
včetně opakování po nejasném selhání. Před zápisem do databáze se audio uloží také
lokálně, aby selhání databáze nevedlo k opětovnému placení. Tento nástroj je pouze
pro obsluhu z backendu/CLI; není veřejné API a neřeší přihlášení uživatele aplikace.

Stav 4. 10. 2026: hlavní aplikace už používá `lib/elevenlabs-turbo.ts` přes
autorizované `/api/tts`. Web posílá pouze ID věty; server načte text a přiřazený
hlas, hlídá denní limit a sdílí trvalou cache mezi uživateli i instancemi. Produkční
E2E ověřilo vytvoření, uložení a opakovaný poslech audia bez dalšího generování.
Výše uvedený skript zůstává jednorázovým diagnostickým nástrojem se samostatnou
pojistkou pro placený pokus, nikoli běžnou cestou aplikace.

Oficiální dokumentace uvádí 90+ jazyků, včetně češtiny. Poslechový test v této
změně pokrývá angličtinu; kvalita ostatních jazyků nebyla ověřena.

- https://elevenlabs.io/docs/overview/models
- https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket
- https://elevenlabs.io/pricing/api
