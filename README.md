# Daily Puzzles

Eight daily puzzle games in one web app. Every puzzle is generated in the browser from the date, so there is a fresh set each day with no server, no database and no scheduled job.

| Game | Plays like | Easy | Medium | Hard |
|---|---|---|---|---|
| Trail | Zip | 5x5, many numbers | 6x6, a few walls | 7x7, fewer numbers, more walls |
| Crowns | Queens | 6x6 | 7x7 | 8x8, no conflict highlights |
| Weave | Wend | 4x4, 3 to 5 letter words | 5x5, 4 to 6 letters | 6x6, 4 to 6 letters |
| Ladder | Crossclimb | 4 letters, rungs in order | 4 letters, scrambled | 5 letters, scrambled, synonym clues |
| Word Guess | Wordle | 4 letters | 5 letters | 5 letters, less common, hints must be reused |
| Mini Crossword | The Mini | 4x4 | 5x5 | 5x5, rarer words, synonym clues |
| Hive | Spelling Bee | common words only | everyday dictionary | big dictionary |
| Trivia | daily trivia | easy questions | medium | hard |

Each game has Easy, Medium and Hard, a **New puzzle** button for an extra round, **Show answer**, and saves progress in the browser.

## How the daily puzzles work

The seed is `date | game | difficulty | extra-round number`. The same seed always produces the same puzzle on any device, so today's puzzle is the same on your phone and laptop, and tomorrow's is new. Generators use step budgets rather than clocks, so slow devices get identical results.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # writes dist/index.html, one self-contained file
npm test         # runs every generator over many seeds and checks the rules
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, choose **Add New > Project** and import the repo.
3. Vercel detects Vite. Keep the defaults (build `npm run build`, output `dist`) and deploy.

Any static host works too: upload `dist/index.html`.

## Data

`src/data` holds prebuilt data, committed so builds need no network:

- `words.json`: English word lists by commonness tier, from [SCOWL](http://wordlist.aspell.net/) via `wordlist-english` (MIT), filtered with the LDNOOBW blocklist via `naughty-words` (CC BY 4.0).
- `clues.json`: short definitions and synonyms from [Princeton WordNet](https://wordnet.princeton.edu/) via `wordnet-db`.
- `trivia.json`: questions from the [Open Trivia Database](https://opentdb.com/), licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

Rebuild words and clues with `npm run data`. Trivia comes from `scripts/fetch-trivia.py`.

The game names and designs are generic. They are not affiliated with LinkedIn or The New York Times.
