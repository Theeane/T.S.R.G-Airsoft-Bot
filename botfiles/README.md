# T.S.G.R Airsoft Bot (Moderniserad)

Det här är en omskriven och moderniserad version av er gamla airsoft-bot.

## Vad den gör
- `/starta-spelanmälning` skapar en ny spelanmälan
- Grön knapp: anmäl ett eller flera namn
- Röd knapp: avanmäl endast namn du själv har anmält
- "Anmälda spelare": visar hela listan med sidning
- "Admin": adminverktyg för att redigera, uppdatera bild, avanmäla valfria spelare och avsluta spelanmälan
- All data sparas lokalt i `data/signups.json`
- Ingen MongoDB behövs längre

## Krav
- Node.js 20+
- En Discord-bot med följande intents aktiverade i Developer Portal:
  - Server Members Intent

## Installation
1. Packa upp zippen
2. Kör `npm install`
3. Kopiera `data/config.example.json` till `data/config.json`
4. Fyll i värdena i `data/config.json`
5. Kör `npm start`

## Kommandoregistrering
Botten registrerar guild-kommandon automatiskt vid start om `guildId` finns i config.

Om du vill registrera kommandon manuellt:
- `npm run deploy`

## Config
```json
{
  "token": "DISCORD_BOT_TOKEN",
  "clientId": "APPLICATION_ID",
  "guildId": "SERVER_ID",
  "adminRoleId": "OPTIONAL_ROLE_ID_OR_EMPTY",
  "defaultImageUrl": "https://i.imgur.com/PfIm2sY.jpeg"
}
```

### adminRoleId
- Lämna tom sträng om vanlig Discord-admin ska räcka
- Sätt roll-ID om ni vill att en särskild adminroll också ska få adminverktygen

## Viktigt
- Om ett anmälningsmeddelande raderas manuellt ligger datan kvar tills ni avslutar den eller skapar ny rensning själva
- Botten bygger på Discords components/modals i discord.js v14

## Rekommenderad hosting
För en liten bot som denna passar exempelvis Koyeb, Railway eller en liten VPS.
