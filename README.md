# Guitar Collection Manager

A browser-based application to manage your guitar collection, track string changes, and keep detailed records of every instrument you own.

## Features

- **Guitar inventory** -- Store manufacturer, model, year, serial number, purchase location, cost, and notes for each guitar
- **Restring tracking** -- Log every restring with string maker, gauge, material, and date. The most recent restring is always shown on the card so you know what's currently on each guitar
- **Pre-filled restrings** -- When logging a new restring, the form pre-fills with the last strings used so repeat purchases are fast
- **Full history** -- View the complete restring history for any guitar from the detail view
- **Search** -- Filter your collection by manufacturer, model, year, serial number, or string details
- **Export/Import** -- Back up your collection to JSON and restore it later (via browser console: `exportData()` / file import)
- **Offline & private** -- All data stays in your browser's localStorage. No server, no account needed

## Usage

1. Open `index.html` in any modern browser
2. Click **"+ Add Guitar"** to add instruments to your collection
3. Click the guitar pick icon on a card to **log a restring**
4. Click any card to see **full details and restring history**
5. Use the search bar to filter by any field