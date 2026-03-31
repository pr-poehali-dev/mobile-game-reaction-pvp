
CREATE TABLE t_p67729910_mobile_game_reaction.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname TEXT NOT NULL DEFAULT 'Игрок',
  rating INTEGER NOT NULL DEFAULT 1000,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  best_reaction INTEGER,
  total_reaction BIGINT NOT NULL DEFAULT 0,
  reaction_count INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  max_streak INTEGER NOT NULL DEFAULT 0,
  coins INTEGER NOT NULL DEFAULT 150,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_played_at TIMESTAMPTZ
);

CREATE INDEX idx_players_rating ON t_p67729910_mobile_game_reaction.players (rating DESC);
