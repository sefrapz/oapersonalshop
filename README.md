# OA Personalshop — multi-tenant personalshop-plattform

EN plattform. Varje kund = en rad i databasen med inställningar:
logga, färg, välkomsttext, beställningsmodell (fritt/attest/kvot),
sortiment och personallista. Noll kod per kund.

## Beställningsmodeller (väljs per kund i adminpanelen)
- **Fritt**: order går direkt till behandling, notis till kontaktadressen
- **Attest**: order (över valfri gräns) mejlas till attestansvarig med
  Godkänn/Avslå-knappar — ett klick direkt i mejlet, beställaren notifieras
- **Kvot**: X kr eller X plagg per anställd/år; systemet räknar och stoppar

## Deploy (samma flöde som OA Chat)
1. SUPABASE: nytt projekt -> SQL Editor -> kör supabase/schema.sql
2. GITHUB: nytt privat repo (t.ex. oapersonalshop) -> pusha denna mapp
   git init && git add . && git commit -m "OA Personalshop v0.1"
   git branch -M main && git remote add origin https://github.com/sefrapz/oapersonalshop.git && git push -u origin main
3. VERCEL: importera repot -> miljövariabler enligt .env.example -> Deploy
   OBS: APP_URL ska vara den slutliga adressen (https://shop.oasystems.se)
4. DOMÄN: Vercel -> Domains -> shop.oasystems.se; Netlify DNS -> CNAME "shop" -> cname.vercel-dns.com
5. RESEND: RESEND_FROM t.ex. "OA Personalshop <shop@oasystems.se>" (domänen redan verifierad)

## Onboarda en kund (~30 min, ingen kod)
1. /admin -> + Ny kund -> namn, slug, färg, logga-URL, beställningsmodell -> Skapa
2. Fliken Produkter: lägg upp sortimentet (namn, pris, storlekar, ev. bild-URL)
3. Fliken Personal: klistra in personallistan (en per rad) -> Lägg till
4. Skicka länken till kunden: https://shop.oasystems.se/s/<slug>
   Personalen loggar in med sin jobbmejl (magic link — inga lösenord)

## Att veta
- Priser hämtas ALLTID ur databasen vid order — aldrig från klienten
- Kvotår nollställs inte automatiskt (V2: årlig cron). Manuellt:
  update staff set used_kr=0, used_items=0 where tenant_id='...';
- Bilder är URL:er i V1 (ladda upp t.ex. till er Netlify-sajt eller Supabase Storage)
- Kortbetalning (Stripe) är medvetet utanför V1 — modellerna fritt/attest/kvot
  täcker profilkläder-caset där företaget betalar
