# Kotoba (ことば)

Practise Japanese by typing what each word or kanji means. It has two modes:

- **Words:** pages 1 to 11 of the [JLPT N5 vocab list](http://www.tanos.co.uk/jlpt/): 218 entries,
  which make 217 cards. After you answer, each kanji in the word is shown with its meaning.
- **Kanji:** the 165 individual kanji used in those words. **Show a hint** reveals the parts a kanji
  is built from. After you answer, you get a memory tip, how to tell it from look-alikes, and the
  words on your list that use it.

Built with Next.js and Postgres, and made to deploy on Vercel.

## Deploy on Vercel

1. In Vercel, choose **Add New > Project** and import this repo. The default settings work.
2. In the project's **Storage** tab, create a Postgres database (Neon works) and connect it. This
   sets `DATABASE_URL` for you. To use a database from elsewhere, add `DATABASE_URL` under
   **Settings > Environment Variables** instead.
3. Redeploy. The build creates the tables.

The quiz works before step 2, but nothing is saved until a database is connected.

## Run it locally

```sh
npm install
cp .env.example .env.local   # optional: set DATABASE_URL here to save progress
npm run db:migrate           # only with a database; export DATABASE_URL first
npm run dev
npm test
```

## How it works

- **Sessions** mix up to half review words, weakest first, with new words. Learned words only fill
  any room left over.
- **A wrong word comes back** a few words later and repeats until you get it right.
- **A word is learned** after 3 right answers in a row (`LEARNED_STREAK` in `lib/session.ts`). A
  wrong answer resets the count.
- **Answers are checked in the browser.** Case, punctuation, "to", "a" and "the" are ignored, and any
  one listed meaning is enough. A likely typo gets a retry and is never marked right. If your wording
  is rejected but correct, **Count as correct** fixes the score.

## Project layout

| Path | What's there |
| --- | --- |
| `data/words.json` | The vocabulary. `accept` lists extra answers that count as right. |
| `data/kanji.json` | The kanji, in the same format. A test checks it covers every kanji in the words. |
| `lib/decks.ts` | Turns both lists into the cards the quiz shows |
| `lib/grade.ts` | Answer checking |
| `lib/session.ts` | Choosing words and running a session |
| `lib/db.ts` | Database queries |
| `migrations/` | SQL files, applied in filename order by every build |
| `components/` | The home screen and quiz |

Every answer is saved as a row in `attempts`, so new statistics can be worked out from the existing
history.

## Common changes

- **Add words:** add entries to `data/words.json` with a new unique `id`. Don't reuse or change an
  existing `id`, because saved progress points to it. The tests in `tests/grade.test.ts` check the
  list, including its expected size, so update that number too. Add any new kanji to
  `data/kanji.json` as well.
- **Change the database:** add a file such as `migrations/002_add_something.sql`. Don't edit a
  migration that has already run.

## Things to know

- **There's no login.** Anyone with the URL can study and add to the one shared set of progress.
  Adding accounts would mean a `user_id` column on `attempts`.
- **TLS:** the database certificate is verified. If a provider's URL fails with a certificate error
  (some Supabase pooler URLs do), use that provider's direct or CA-verified connection string.

## Corrections to the source list

The PDF has a few errors, which are fixed in `data/words.json`:

| Word | The PDF says | Changed to | Why |
| --- | --- | --- | --- |
| あかるい | 明い | 明るい | Standard spelling |
| おじいさん | 伯父/叔父 | お祖父さん | The PDF repeats the kanji for "uncle" |
| おじさん | 伯父/叔父 | 伯父さん/叔父さん | Matches the reading |
| おわる | 終る | 終わる | Standard spelling |
| いちにち (一日) | first of the month | one day | "First of the month" is ついたち. The old answer is still accepted. |
| くらい (暗い) | gloomy | dark, gloomy | "Dark" is the main meaning |
| きらい (嫌い) | hate | dislike, hate | "Dislike" is the usual translation |

The PDF also lists あの twice, as "that over there" and "um...". Both look identical on a card, so
they're one card that accepts either meaning. Capitalisation and comma spacing were also tidied.

## Kanji meanings and tips

The meanings shown in `data/kanji.json` were written for this app and checked against
[KANJIDIC](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project). Most of its `accept` lists include
KANJIDIC's English meanings, so any valid meaning counts as right. KANJIDIC is the property of the
Electronic Dictionary Research and Development Group and is used under its
[licence](https://www.edrdg.org/edrdg/licence.html) (CC BY-SA 4.0).

The memory tips are stories to help you remember, not the kanji's real history. The parts listed for
each kanji were checked against [KRADFILE](https://www.edrdg.org/krad/kradinf.html), also from the
EDRDG. A test makes sure a hint never contains an accepted answer.
