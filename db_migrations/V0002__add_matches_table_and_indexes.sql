CREATE TABLE IF NOT EXISTS t_p67729910_mobile_game_reaction.matches (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES t_p67729910_mobile_game_reaction.players(id),
  result text NOT NULL CHECK (result IN ('win', 'lose', 'false_start')),
  player_reaction_ms integer NULL,
  opponent_reaction_ms integer NULL,
  rating_change integer NOT NULL DEFAULT 0,
  coins_earned integer NOT NULL DEFAULT 0,
  played_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matches_player_id ON t_p67729910_mobile_game_reaction.matches(player_id);
CREATE INDEX IF NOT EXISTS idx_matches_played_at ON t_p67729910_mobile_game_reaction.matches(played_at DESC);
CREATE INDEX IF NOT EXISTS idx_players_rating ON t_p67729910_mobile_game_reaction.players(rating DESC);
