# OA Personalshop — senaste versionen (inkl. säkerhetsfix K1/K3/H1/H3/H5/M1/M2)

Detta är HELA projektet i senaste skick. Två sätt att använda:

## A) Om ditt repo redan är deployat (ditt läge)
1. Kör supabase/uppdatering1.sql i Supabase SQL Editor (personalshop-projektet!
   inte oachat) — skapar consume_quota/refund_quota + index + RLS. Idempotent,
   säker att köra även om den körts förr.
2. Packa upp zipen, kopiera in src/ över repots src/ (skriv över allt).
   OBS: repo-roten är C:\Users\Pat\Downloads\oa-personalshop\oa-personalshop
   (dubbelmappen!) — där package.json ligger.
3. git add . && git commit -m "Säkerhetsfix: attest POST, atomär kvot, logout" && git push

## B) Om du sätter upp från noll någon gång
1. Nytt Supabase-projekt → kör schema.sql, sedan uppdatering1.sql
2. Vercel: importera repot, env-variabler enligt README (SUPABASE_URL,
   SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM, ADMIN_SECRET, APP_URL)

## Testa efter deploy (3 min)
1. Lägg en order som kräver attest → öppna attestmejlets länk
   → ska visa BEKRÄFTELSESIDA med knapp (inte godkänna direkt) → klicka → klart
2. "Logga ut"-knappen i butikshuvudet → ska kasta ut dig till inloggningen
3. Kvottest: två snabba ordrar som tillsammans överskrider kvoten
   → den andra ska nekas med kvotmeddelande
