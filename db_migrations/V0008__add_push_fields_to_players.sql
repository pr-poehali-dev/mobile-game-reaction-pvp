ALTER TABLE t_p67729910_mobile_game_reaction.players
  ADD COLUMN IF NOT EXISTS push_token       text NULL,
  ADD COLUMN IF NOT EXISTS push_token_updated_at timestamp with time zone NULL,
  ADD COLUMN IF NOT EXISTS last_result      text NULL,
  ADD COLUMN IF NOT EXISTS near_miss_diff   integer NULL,
  ADD COLUMN IF NOT EXISTS push_sent_at     timestamp with time zone NULL,
  ADD COLUMN IF NOT EXISTS push_count_today integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS push_reset_date  date NULL;