# TSGR Airsoft Bot - Ultra Clean

Minimal modern version av er spelanmälan-bot.

## Funktioner
- `/starta-spelanmälning` skapar ett nytt anmälningsinlägg
- Grön knapp: anmäl ett eller flera namn
- Röd knapp: avanmäler bara namn som du själv lagt in
- `Anmälda spelare`: visar hela listan med sidning
- `Admin`: redigera, ta bort valfria spelare, uppdatera bild/event-länk, stäng anmälan
- `/show-list`: snabb adminöversikt över aktiva spel
- Sparar allt lokalt i `data/signups.json`
- Registrerar slash commands automatiskt vid start

## Setup lokalt
1. `npm install`
2. Kopiera `.env.example` till `.env`
3. Fyll i värdena i `.env`
4. `npm start`

## Setup på gratis host
Använd miljövariablerna från `.env.example` i hostens dashboard.
Ingen separat deploy-fil behövs.

## Behörighet
Botten accepterar antingen:
- vanlig Discord Administrator
- eller rollen i `ADMIN_ROLE_ID` om du fyller i den

## Viktigt
Slå på **Server Members Intent** i Discord Developer Portal.
