-- Every answer is one row, so future features (streaks, spaced repetition,
-- history) can be worked out from the log without another migration.
CREATE TABLE attempts (
  id         uuid PRIMARY KEY,
  word_id    text NOT NULL,
  answer     text NOT NULL,
  correct    boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX attempts_word_id_created_at ON attempts (word_id, created_at DESC);
