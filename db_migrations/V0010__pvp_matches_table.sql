CREATE TABLE IF NOT EXISTS t_p67729910_mobile_game_reaction.pvp_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player1_id UUID NOT NULL,
    player2_id UUID NOT NULL,
    player1_nickname TEXT NOT NULL,
    player2_nickname TEXT NOT NULL,
    signal_delay_ms INTEGER NOT NULL,
    player1_time INTEGER NULL,
    player2_time INTEGER NULL,
    winner_id UUID NULL,
    status TEXT NOT NULL DEFAULT 'playing',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS idx_pvp_p1 ON t_p67729910_mobile_game_reaction.pvp_matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_pvp_p2 ON t_p67729910_mobile_game_reaction.pvp_matches(player2_id);
CREATE INDEX IF NOT EXISTS idx_pvp_status ON t_p67729910_mobile_game_reaction.pvp_matches(status);

CREATE INDEX IF NOT EXISTS idx_mm_queue_joined ON t_p67729910_mobile_game_reaction.matchmaking_queue(joined_at);