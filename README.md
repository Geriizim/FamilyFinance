# FamilyFinance

En enkel, responsiv prototyp för att hantera familjens ekonomi lokalt på en Ubuntu-server.

## Funktioner
- Import av Excel-filer (`.xlsx` / `.xls`) via SheetJS.
- Automatisk kategorisering med nyckelord + möjlighet att mass-kategorisera liknande transaktioner.
- Budget per kategori.
- Översikt med månad/månad- och år/år-jämförelse.
- Responsivt GUI för både dator och mobil.

## Kom igång
1. Ladda upp projektet till din Ubuntu-server.
2. Installera beroenden:
   ```bash
   npm install
   ```
3. Ange Postgres-anslutning:
   ```bash
   export DATABASE_URL="postgres://user:password@localhost:5432/familyfinance"
   ```
4. Starta servern (API + statiska filer):
   ```bash
   npm start
   ```
5. Öppna `http://<server-ip>:8080` i webbläsaren.

## Databas
Servern skapar tabellen `transactions` automatiskt om den saknas. Synkningen görs via knappen
\"Spara till databas\" eller automatiskt efter import/kategorisering.

## Importformat
Stöd för följande rubriker i Excel-filer:

```
Reskontradatum  Transaktionsdatum  Text  Belopp  Saldo
```

```
Transaktionsdatum  Inköpsställe  Belopp  Valuta  Valutakurs  Utländskt belopp  Utländsk valuta  Kortinnehavare
```
