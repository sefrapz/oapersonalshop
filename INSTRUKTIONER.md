# OA Personalshop v3 — "demon fast på riktigt"

Butiken har nu exakt samma design och funktioner som säljdemon, men allt kör mot riktig data:
kvotring, plaggkonst, favoriter, ordertidslinje, chefens attestkorg I APPEN, AI-assistent,
admin-dashboard med riktiga siffror och theme builder som publicerar direkt.

## Deploy (befintligt repo — 3 steg)

1. **SQL** — kör i Supabase (PERSONALSHOP-projektet!) → SQL Editor:
   - `supabase/uppdatering1.sql` (om du inte redan körde den vid säkerhetsfixen)
   - `supabase/uppdatering2.sql` (roller, plaggformer, hörnradie)

2. **Miljövariabel (valfri men rekommenderad)** — Vercel → Settings → Environment Variables:
   - `ANTHROPIC_API_KEY` = din Anthropic-nyckel → AI-assistenten svarar med Claude Haiku
     (superbilligt: ~1 öre per fråga). Utan nyckel svarar en inbyggd deterministisk fallback
     med samma riktiga data. Glöm inte **Redeploy** efter att variabeln lagts till.

3. **Koden** — kör `personalshop-v3.ps1` där repot ligger (skriver filerna), eller kopiera
   `src/` + `supabase/` från zippen över repo-roten (OBS dubbelmappen oa-personalshop\oa-personalshop). Sedan:
   ```
   git add -A && git commit -m "v3: butik i demoparitet + attestkorg + AI + dashboard" && git push
   ```

## Så testar du (5 min)

1. **Chefsroll:** /admin → välj kund → Personal → "Gör till chef" på dig själv.
2. **Attest i appen:** sätt modellen till Attest (Utseende-fliken) → logga in i butiken som
   vanlig anställd → beställ → logga in som chefen → ✅ Attest-fliken har en badge → Godkänn.
   Beställaren får mejl, tidslinjen hoppar till "Tryck".
3. **Theme builder:** Utseende-fliken → byt färg/radie → öppna butiken → nya utseendet live.
4. **AI:** klicka ✦ Assistent i butiken → "vad finns kvar av min kvot?" → svar med riktiga siffror.
5. **Dashboard:** /admin → Dashboard visar riktiga KPI:er, veckostaplar, topprodukter, storlekar.

## Ärliga noter

- **Cart-drawern är borta** — demons direktorderflöde (en produkt per order) ersätter den,
  precis som du bad om. Vill du ha flervaruordrar tillbaka säger du till.
- **Tidslinjens "Klar"** tänds när du klickar "Markera klar" på ordern i /admin (status ready).
- **Dashboarden** ligger i din superadmin per vald kund — inte ett separat företagsinlogg (kan byggas senare).
- Kvoten är fortsatt **atomär på servern** (säkerhetsfixen) — klientkollen är bara trevlig UX.
- Attestbeslut går genom EN delad kodväg (`src/lib/attest.ts`) oavsett om chefen klickar i
  mejlet eller i appen — samma mejl, samma logik.
