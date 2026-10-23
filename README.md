# Daily Puzzles

Sixteen daily puzzle games in one web app. Every puzzle is generated in the browser from the date, so there is a fresh set each day with no server, no database and no scheduled job.

| Game | Plays like | Easy | Medium | Hard |
|---|---|---|---|---|
| Zap | Zip | 5x5, many numbers | 6x6, a few walls | 7x7, fewer numbers, more walls |
| Queins | Queens | 6x6 | 7x7 | 8x8, no conflict highlights |
| Wand | Wend | 5x5, words of 3 to 6 letters | 6x6, 4 to 8 letters | 7x7, 4 to 9 letters |
| Crissclimb | Crossclimb | 3 rungs in order | 5 rungs, scrambled | 6 rungs, scrambled, synonym clues |
| Werdle | Wordle | 4 letters | 5 letters | 5 letters, less common, hints must be reused |
| The Mino | The Mini | 4x4 | 5x5 | 5x5, rarer words, synonym clues |
| Spilling Bee | Spelling Bee | common words only | everyday dictionary | big dictionary |
| Trivia | daily trivia | easy questions | medium | hard |
| Sudoku | Sudoku | 40 givens | 32 givens | about 26 givens, still one answer |
| Pops | Pips | 5 dominoes | 7 dominoes, more inequalities | 9 dominoes, more open squares |
| Toles | Tiles | 4x4, two layers | 5x4, three layers | 6x5, three layers, more designs |
| Litter Boxed | Letter Boxed | target 6 words | target 5 | target 4, rarer letters |
| Cannections | Connections | everyday categories | one FIRE ___ style group | rarer words, up to two pattern groups |
| Strends | Strands | 5x6 grid | 6x7 | 6x8, wider word pool |
| The Mido | The Midi | 7x7 | 7x7 | 7x7, synonym clues |
| Woffle | Waffle | common words, par 6 swaps | common words, par 10 | wider word list, par 10, fewer green to start |

Crissclimb's top and bottom words join into a compound word (FIRE + WORK). Spilling Bee is solved when you find a pangram.

Each game has Easy, Medium and Hard, a **New puzzle** button for an extra round, **Show answer**, and saves progress in the browser.

## How the daily puzzles work

The seed is `date | game | difficulty | extra-round number`. The same seed always produces the same puzzle on any device, so today's puzzle is the same on your phone and laptop, and tomorrow's is new. Generators use step budgets rather than clocks, so slow devices get identical results.

Games that draw from a fixed bank (Trivia questions, Groups and Threads categories, Ladder compounds, Word Guess answers) deal from one shuffled deck per day, so pressing **New puzzle** moves on to items you haven't seen that day instead of drawing at random again. When a generator changes, bump the game's `version` so saved progress from the old board isn't loaded onto the new one.

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
- `categories.json`: everyday WordNet categories (kinds of fish, furniture, trees) plus compound patterns (FIRE ___, ___ BALL), shared by Groups and Threads.
- `compounds.json`: compound words for Ladder's top and bottom rungs.
- `trivia.json`: questions from the [Open Trivia Database](https://opentdb.com/), licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

Rebuild words and clues with `npm run data`. Trivia comes from `scripts/fetch-trivia.py`.

Game names are one-letter twists on the originals so they're easy to recognize, and the site asks search engines not to index it. They are not affiliated with LinkedIn or The New York Times.
