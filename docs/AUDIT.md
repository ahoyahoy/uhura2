# Uhura — audit a plán dokončení

Datum: 3. října 2026. Rozsah: aktuální pracovní kopie, připojená databáze pouze pro čtení, bezpečné HTTP kontroly localhostu a existující přihlášené produkční UI. Audit neprováděl zápisy do uživatelských dat ani placené generování textu či audia. Během auditu vznikl pouze tento dokument; dřívější rozpracované změny zůstaly zachované.

## Závěr

Uhura má použitelný základ trenažéru vět: Google přihlášení, jazykové kurzy, témata, generování dvojic vět, procvičování, hodnocení, audio a lokální cache. Největší problém je spolehlivost jádra: ztráta výsledků při chybě sítě, ignorování neúspěšných odpovědí v dlouhodobém pokroku a neoddělená lokální data různých účtů. Doporučuji dokončit tento základ před rozšiřováním o články.

Stack: Next.js App Router, React, Better Auth, PostgreSQL/Neon přes Drizzle, TanStack Query + Dexie, OpenAI pro věty a ElevenLabs pro řeč. Přepis ani výměna stacku nejsou pro nalezené problémy potřeba.

## Potvrzené požadavky uživatele

- Současná data jsou výhradně testovací. Při následných opravách není nutné zachovat jejich kompatibilitu ani připravovat jejich migraci do nového modelu. Audit sám žádná data nemaže.
- Generování audia probíhá výhradně na našem backendu.
- Frontend posílá pouze ID věty, nikdy její text ani parametry poskytovatele. Backend ověří session a vlastnictví věty a sám načte její text a jazyk.
- Audio se na backendu ukládá trvale, bez TTL a bez automatického obnovování. Smazání tématu, věty nebo kurzu nesmí mazat již vygenerované audio z cache.
- Backend nejprve hledá existující audio, poskytovatele volá pouze při chybějícím záznamu. Klíč cache odvozuje sám z obsahu a parametrů řeči. Změna textu či hlasu může vytvořit nový záznam, původní zůstává uložený; nejde o pravidelnou obnovu cache.
- Souběžné požadavky na stejné chybějící audio mají sdílet jedno generování; toto je potřeba řešit i mezi instancemi backendu na Vercelu, ne pouze pomocí mapy v paměti.

## Ověřený stav

- `pnpm exec tsc --noEmit`: prošlo.
- `pnpm lint`: selhalo, 11 chyb a 20 varování. Chyby zahrnují `any` a pravidlo `set-state-in-effect`; samy o sobě nedokazují funkční selhání všech dotčených míst.
- `next.config.ts:9` má `typescript.ignoreBuildErrors: true`. Úspěšný produkční build proto není záruka typové správnosti. Nový produkční build nebyl v rámci auditu spouštěn.
- V repozitáři nebyly nalezeny projektové automatické testy ani CI workflow; nejsou ani testovací skripty v `package.json`.
- Připojená DB: 6 kurzů, 22 témat, 350 vět, 69 záznamů pokroku. Počty jsou za celou připojenou DB. Aktuálně 0 duplicitních dvojic uživatel/věta a 0 aktivních témat bez kurzu.
- DB má pro `language_class`, `topic`, `sentence` a `sentence_progress` jen primární indexy. Unikátnost `(user_id, sentence_id)` opravdu chybí i v živé DB.
- Anonymní `/api/sync` vrací 401. Anonymní `/api/tts` s prázdným JSON vrací 400 kvůli chybějícímu textu; autorizaci vůbec nekontroluje. Placený TTS požadavek nebyl proveden.
- `/home` a `/classes` jsou bez přihlášení dostupné jako stránky s HTTP 200. Samotné API pro synchronizaci data nevydá, ale UI nemá společnou ochranu přihlášení ani rozumný stav po 401. Na čistém localhostu `/classes` zůstalo bez obsahu kurzů a bez přesměrování k přihlášení.
- Produkční UI zobrazuje existující témata. `Articles` a `Stats` vedou pouze na `#`.
- Google OAuth byl v předchozí práci vytvořen a přihlášení ověřeno; zůstává v režimu Testing. Veřejné spuštění vyžaduje dokončit požadavky Google brandingu. Lokální port je 3017.

## Nálezy podle priority

### P1 — 1. Veřejný endpoint může čerpat placené audio API

**Důkaz:** `app/api/tts/route.ts:4–11`, `lib/tts.ts:23–35`.

`POST /api/tts` přijímá libovolný neprázdný text bez přihlášení, kontroly vlastnictví věty, limitu délky a aplikačního limitu požadavků. Při nenalezení v cache volá ElevenLabs s klíčem aplikace. Přihlášený uživatel není pro čerpání tohoto endpointu potřeba. U generování témat a vět autentizace existuje, ale aplikační kvóty a limity objemu také chybí.

**Oprava:** TTS požadavek vztáhnout ke konkrétní uživatelově větě, ověřit session a vlastnictví, validovat vstupy a zavést limity i strop nákladů. Náklady a limity stanovit před placenými testy. Ochrany případně nastavené mimo repozitář nebyly tímto auditem posouzeny.

### P1 — 2. Lokální cache přežívá odhlášení a není oddělená podle účtu

**Důkaz:** `lib/idb.ts:36–48`, `lib/hooks/use-sync.ts:79–98`, `components/providers.tsx:10`, `app/(app)/settings/page.tsx:45`.

Všichni uživatelé na stejné doméně používají databázi `uhura` a query key `["sync"]`. Odhlášení pouze volá `signOut()`: nemaže query cache, IndexedDB ani neprovádí přesměrování. `useSync` nejdřív vrací uložená data a až potom synchronizuje. Po změně účtu se tak mohou zobrazit data předchozího uživatele; při neúspěšné synchronizaci mohou zůstat zobrazená. Serverová ochrana `/api/sync` tuto klientskou chybu neřeší.

**Oprava:** klíčovat cache identitou uživatele, načítat soukromá data až po ověření session, při odhlášení zrušit probíhající požadavky a odstranit soukromé cache. Společná ochrana pro skupinu `(app)` a jednotné řešení expirace session.

### P1 — 3. Dokončená odpověď se může ztratit

**Důkaz:** `app/(app)/learn/review/page.tsx:154–172`, `lib/hooks/use-mutations.ts:10–49`.

Úspěšná odpověď se ihned odstraní z lokálního poolu a UI přejde dál. API zápis běží nezávisle přes `mutate()`. Chyba se v obrazovce nezobrazuje a není zde trvalá fronta neodeslaných výsledků. Uživatel může dostat „All done for today“, přestože zápis selhal. Reload nebo zavření stránky neumí rozpracovanou lekci obnovit.

**Oprava:** definovat potvrzený zápis výsledku, viditelný stav ukládání a obnovu po selhání. Pro požadované offline učení použít perzistentní frontu s idempotentním identifikátorem události; jinak jasně vyžadovat online potvrzení. Souhrn nesmí zaměňovat lokálně dokončeno a bezpečně uloženo.

### P1 — 4. Dlouhodobé opakování ignoruje neúspěchy

**Důkaz:** `app/(app)/learn/review/page.tsx:159–164`, `app/api/rate/route.ts:38–43`, `lib/spaced-repetition.ts:8–9,29–38`.

Na server se posílají jen známky 1 a 2. Známky 3–5 mění pouze dočasný pool. Například dlouho známá věta hodnocená nejprve 5 a později 1 se na serveru chová jako bezchybná odpověď; snížení úrovně v `getNextLevel` se běžnou cestou z UI nikdy nepoužije. Při opuštění lekce se neúspěchy úplně ztratí.

Navíc `getNextReviewDate` komentářem očekává počet opakování v lekci, ale API do něj předává celoživotní `repetitions`. Od čtvrtého uloženého výsledku se proto používá poloviční interval bez ohledu na průběh aktuální lekce. Izolované spuštění funkce potvrdilo pro level 7 interval 120 dní při `repetitions=1` a 60 dní při `repetitions=5`.

**Oprava:** sjednotit význam známek, výsledek lekce, počet pokusů v lekci a dlouhodobý stav. Uchovávat události odpovědí nebo definovaný agregovaný výsledek, který zohlední neúspěchy. Přidat deterministické testy konkrétních posloupností známek a času.

### P1 — 5. Souběžné hodnocení může vytvořit duplicitní pokrok nebo přepsat výsledek

**Důkaz:** `app/api/rate/route.ts:28–64`, `db/schema.ts:105–118`; ověřeny indexy skutečné DB.

Postup SELECT → INSERT/UPDATE není atomický. Dvě první odpovědi pro stejnou větu mohou obě vložit řádek, protože chybí unikátní `(user_id, sentence_id)`. Další čtení použije první nalezený řádek bez jednoznačného určení. Při existujícím řádku mohou souběžné zápisy ztratit zvýšení čítače. V aktuálních datech duplicity nebyly nalezeny; jde o potvrzenou možnost v implementaci, nikoli doložené již nastalé poškození.

**Oprava:** unikátní constraint, atomické zpracování změny stavu a idempotence opakovaných požadavků. Před migrací vždy ověřit a případně opravit existující duplicity.

### P1 — 6. Kontrola vlastnictví není úplná

**Důkaz:** `app/api/topics/route.ts:32–42,64–73`, `app/api/rate/route.ts:19–35`.

Vytvoření tématu načítá kurz jen podle `classId`, nikoli zároveň podle uživatele. Lze tedy vytvořit vlastní téma odkazující na cizí existující kurz. Hodnocení také neověřuje, zda zadaná věta patří přes své téma přihlášenému uživateli. Vytváří vlastní pokrok nad libovolným existujícím ID věty. To je chyba integrity a autorizace vazeb; tento audit netvrdí, že endpoint tím přímo vydává text cizích vět.

**Oprava:** ověřovat celé vztahy uživatel → kurz → téma → věta, včetně `deletedAt`, před voláním AI i před zápisem. Validovat UUID, jazyky, rozdílnost jazyků, CEFR úroveň a délky vstupů.

### P1 — 7. Migrace nereprodukují současnou databázi

**Důkaz:** `db/migrations/meta/_journal.json`, `db/migrations/0002_add_classes_rename_columns.sql`, `db/schema.ts` a introspekce připojené DB.

Journal obsahuje jen migrace 0000 a 0001; soubor 0002 není zaregistrovaný. V uložených SQL navíc chybí vytvoření `tts_cache` a přidání `topic.deleted_at`, přestože aplikace i skutečná DB tyto objekty používají. Standardní rekonstrukce z migrační historie nedá současné schéma. Ruční SQL 0002 řeší jen část rozdílu a nepřiřazuje stará témata ke kurzům.

**Oprava:** protože jsou současná data testovací, lze připravit čistou výchozí migrační historii pro konečné schéma. Není potřeba zachraňovat starý pokrok ani přiřazovat stará témata. Ověřit vytvoření nové DB z migrací; případný reset musí mířit na ověřené prostředí projektu Uhura.

### P2 — 8. Selhání API se mění v prázdnou obrazovku nebo falešné dokončení

**Důkaz:** `app/(app)/classes/page.tsx:46–58`, `app/(app)/classes/[classId]/page.tsx:16–28`, `app/(app)/learn/review/page.tsx:97–111`; mutace v `lib/hooks/use-mutations.ts`.

Stránky běžně zpracovávají pouze `isLoading`, nikoli `isError`. Při chybě načtení kurzů zůstane spinner; jinde se zobrazí prázdný seznam nebo „No sentences due“. Inicializace lekce je jednorázová a může uzamknout stará data z IndexedDB ještě před dokončením synchronizace. Pozdější aktualizace už pool neopraví. Vytvoření kurzu při chybě pouze odemkne tlačítko bez vysvětlení.

**Oprava:** explicitní stavy načítání, prázdných dat, chyb, offline a expirace session. Lekci zahájit ze zvoleného konzistentního snapshotu, odlišit lokální předběžná data od potvrzeného seznamu.

### P2 — 9. Generování není bezpečné při chybě, opakování ani souběhu

Podrobný rozbor kvality vět, rozporu mezi prvním generováním a pokračováním,
konkrétních ukázek z DB a návrh učebních cílů je v
[SENTENCE-GENERATION-DESIGN.md](./SENTENCE-GENERATION-DESIGN.md).

**Důkaz:** `app/api/topics/route.ts:49–124`, `app/api/generate/route.ts:44–101`, `components/topics-list.tsx:55–59`.

Téma se uloží před druhým AI voláním pro věty. Jeho selhání zanechá téma bez vět, přestože klient dostal chybu. Retry může vytvořit další téma. JSON výstup AI se pouze přetypuje, bez runtime validace struktury a obsahu; počet vět a duplicity se nevynucují. Generování dalších vět nefiltruje smazané téma. Paralelní generování pošle stejné existující věty jako kontext a nemá deduplikaci. Do kontextu se posílají všechny dosavadní věty, takže objem roste bez horní hranice. Smazání a generování mohou také proběhnout současně.

**Oprava:** oddělit stav generování od hotového obsahu, validovat odpověď AI, uložit výsledek konzistentně a podporovat bezpečný retry. Zavést omezený kontext, deduplikaci a koordinaci souběhu na téma. V UI ukázat výsledek každé položky dávky.

### P2 — 10. Výběr vět a přepočet termínů mají nesrovnalosti

**Důkaz:** `lib/session-engine.ts:93–107`, `lib/spaced-repetition.ts:66–74`, `lib/hooks/use-sentences-due.ts:36`, `lib/hooks/use-topics-with-counts.ts:20–42`.

Časová váha dává vyšší váhu novějšímu `lastRepeat`, přestože komentář popisuje upřednostnění dlouho neviděných vět. Do pole `lastReviewedAt` se navíc při výběru předává `nextReviewAt`. První vážené zamíchání je dále následované novým výběrem v SessionEngine, jehož počáteční váhy jsou pro všechny stejné. Algoritmus potřebuje jednu jasnou specifikaci, ne dvě částečně odlišné implementace.

Počet vět k opakování používá `new Date()` jen uvnitř memoizace závislé na datech a kurzu. Pouhé dosažení času opakování výpočet neobnoví; query také nemá interval a má vypnuté obnovení při návratu do okna.

**Oprava:** jedna implementace výběru s testovatelným časem a náhodou; správné časové pole a směr váhy. Obnovovat splatnost po návratu do aplikace nebo při nejbližším termínu.

### P1/P2 — 11. Audio nesplňuje požadovaný kontrakt ani trvalost cache

**Důkaz:** `lib/audio-cache.ts:1–18`, `lib/tts.ts:11–50`, `app/(app)/learn/review/page.tsx:123–149`, `app/api/topics/[id]/route.ts`.

Frontend dnes posílá `{ text }` a smazání tématu explicitně odstraňuje z `tts_cache` záznamy podle textů jeho vět. To porušuje požadavek na předávání pouze ID a na trvalé uložení audia. Stejné audio může navíc sloužit jiné větě nebo jinému uživateli, takže smazání jednoho tématu vyvolá budoucí placené přegenerování i jinde.

Klient cachuje až hotové blob URL. Prefetch a klik na přehrání mohou současně vyvolat dva požadavky pro tentýž text. Server také dělá SELECT → placené volání → INSERT bez koordinace. Obě volání tak mohou spotřebovat kredit a druhý INSERT selže na unikátním hash. Klíč obsahuje pouze text, nikoli jazyk, hlas nebo verzi modelu; při změně hlasu se vrátí staré audio. Chyby přehrávání UI potlačuje. Blob URL se neuvolňují a cache nemá limit.

**Oprava:** klientské API přijímá `sentenceId`; backend vyhledá přístupnou větu a načte text/jazyk. Trvalá serverová cache se nikdy automaticky nemaže ani neobnovuje a nemá vazbu s kaskádovým mazáním na větu/téma. Sdílet probíhající promise na klientu, koordinovat generování mezi instancemi backendu, ošetřit konflikt při zápisu a zahrnout do klíče parametry řeči. Omezit lze pouze dočasnou paměťovou cache blob URL v prohlížeči; trvalé audio tím není dotčeno. Přidat srozumitelný retry. Samotný upsert neřeší dvojí placené volání.

### P2 — 12. Synchronizace kurzu a správa obsahu jsou nedokončené

**Důkaz:** `app/(app)/classes/new/page.tsx:31–43`, `lib/hooks/use-sync.ts`, dostupné stránky a API.

Vytvoření kurzu zapisuje pouze do již existující query cache, nikoli do IndexedDB. Pokud cache neexistuje, updater vrátí `undefined`; pokud existuje stará IDB, po reloadu může následovat dočasně starý seznam. Chybí jednotná invalidace či persistování po této mutaci.

Uživatel nemá obrazovku pro prohlédnutí a opravu vygenerovaných vět ani editaci tématu; prohlížecí API vět existuje, ale není k němu plnohodnotné UI. Chybí správa a odstranění celého kurzu. U AI obsahu je možnost opravit chybný překlad podstatná pro použitelnost.

### P2/P3 — 13. Chybí základ pro dokončení produktu a regresní kontrolu

- `Articles` a `Stats` jsou jen odkazy na `#` (`app/(app)/home/page.tsx:75–84`). Historie jednotlivých odpovědí se neukládá, takže skutečné denní statistiky nelze zpětně sestavit z aktuálního stavu pokroku.
- Nastavení hodnocení a posledního kurzu je pouze lokální; synchronizované uživatelské preference nejsou implementované.
- Je přítomný PWA manifest, ale žádný nalezený service worker ani spolehlivá fronta offline zápisů. Lokální cache sama o sobě nepředstavuje dokončený offline režim.
- Klikatelné řádky kurzů a témat jsou `div` bez klávesnicové obsluhy; ikonová tlačítka často nemají přístupný název. Layout zakazuje zvětšování přes `maximumScale: 1`.
- Chybí testy, CI a projektová provozní dokumentace; README je převážně výchozí šablona. `ignoreBuildErrors` oslabuje kontrolu nasazení.
- `/api/sync` vždy stahuje veškeré věty a pokrok; počítání témat opakovaně prochází pole. Při nynějších 350 větách nebylo doloženo výkonnostní selhání. Indexy, měření a postupnou synchronizaci řešit podle růstu, až po opravě správnosti.

## Doporučený plán dokončení

### Etapa 1 — bezpečný účet a konzistentní data

Ochrana TTS a ostatních vstupů, vlastnictví vazeb, cache podle uživatele a správné odhlášení, čisté reprodukovatelné migrace bez potřeby zachovat testovací data, unikátnost a atomické zápisy pokroku. Převést audio endpoint na ID věty a odstranit mazání trvalé audio cache při mazání témat.

Hotovo, když: anonymní placené endpointy vracejí 401; cizí ID nelze použít k zápisu nebo generování audia; požadavek z FE obsahuje pouze ID věty; smazání tématu zachová serverové audio; změna účtu nikdy nezobrazí původní cache; dvě současné odpovědi nezaloží duplicitu; testovací databáze jde vytvořit z migrací.

### Etapa 2 — spolehlivé procvičování

Specifikace známek a intervalů, zohlednění všech pokusů, trvalé nebo potvrzované ukládání, obnova lekce, správné termíny a chybové stavy, koordinace audia.

Hotovo, když: posloupnost 5 → 3 → 1 zanechá správný dlouhodobý výsledek; výpadek sítě ani reload neztratí potvrzené hodnocení; dokončení lekce odpovídá stavu ukládání; audio se při souběhu negeneruje dvakrát. Průběh ověřit i na mobilu.

### Etapa 3 — kompletní trenažér vět

Bezpečné generování a retry, prohlížení/editace vět, správa témat a kurzů, přehledný onboarding, jednotné chybové stavy, přístupnost a dokončení veřejného přihlášení dle Google požadavků.

Hotovo, když: nový uživatel založí kurz a téma, procvičí je, opraví chybnou větu a naváže na jiném zařízení; chyba AI se dá obnovit bez duplicit. Nákladové limity jsou vynucené serverem.

### Etapa 4 — statistiky a rozšíření

Statistiky postavit na událostech sbíraných už od etapy 2. Články řešit jako samostatnou funkci s vlastní specifikací; do té doby odstranit nebo jasně označit nefunkční vstup. O plném offline režimu rozhodnout explicitně a podle toho dokončit PWA.

## Rozsah ověření a omezení

Funkční kontroly auditu byly nedestruktivní: nehodnotily reálné věty, nemazaly témata a negenerovaly placený obsah. Chování při dvou účtech, konkurenčních zápisech a selhání AI je odvozeno z konkrétních cest v kódu a schématu; nebylo simulováno mutacemi produkčních dat. Celý migrační replay na nové DB a úplný placený scénář generování → audio patří do ověřování následných oprav. Tento dokument rozlišuje tyto mezery od živě ověřených HTTP, UI, typových a databázových kontrol.
