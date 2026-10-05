-- ==============================================================================
-- EA FC COMPANION APP - SEED DATA: 5 GRANDES LIGAS Y TOP 5 CLUBES POR LIGA (25 CLUBES)
-- ==============================================================================

-- 1. INSERTAR LAS 5 LIGAS PRINCIPALES
INSERT INTO public.leagues (id, name, country, logo_url) VALUES
('11111111-1111-1111-1111-111111111111', 'Premier League', 'Inglaterra', 'https://media.api-sports.io/football/leagues/39.png'),
('22222222-2222-2222-2222-222222222222', 'LaLiga EA Sports', 'España', 'https://media.api-sports.io/football/leagues/140.png'),
('33333333-3333-3333-3333-333333333333', 'Serie A', 'Italia', 'https://media.api-sports.io/football/leagues/135.png'),
('44444444-4444-4444-4444-444444444444', 'Bundesliga', 'Alemania', 'https://media.api-sports.io/football/leagues/78.png'),
('55555555-5555-5555-5555-555555555555', 'Ligue 1 McDonald''s', 'Francia', 'https://media.api-sports.io/football/leagues/61.png')
ON CONFLICT (name) DO NOTHING;

-- 2. INSERTAR TOP 5 CLUBES DE CADA LIGA (TOTAL: 25 CLUBES)
INSERT INTO public.clubs (id, league_id, name, short_name, logo_url, overall_rating) VALUES
-- Premier League (Inglaterra)
(uuid_generate_v4(), '11111111-1111-1111-1111-111111111111', 'Manchester City', 'MCI', 'https://media.api-sports.io/football/teams/50.png', 85),
(uuid_generate_v4(), '11111111-1111-1111-1111-111111111111', 'Arsenal FC', 'ARS', 'https://media.api-sports.io/football/teams/42.png', 83),
(uuid_generate_v4(), '11111111-1111-1111-1111-111111111111', 'Liverpool FC', 'LIV', 'https://media.api-sports.io/football/teams/40.png', 84),
(uuid_generate_v4(), '11111111-1111-1111-1111-111111111111', 'Manchester United', 'MUN', 'https://media.api-sports.io/football/teams/33.png', 82),
(uuid_generate_v4(), '11111111-1111-1111-1111-111111111111', 'Chelsea FC', 'CHE', 'https://media.api-sports.io/football/teams/49.png', 81),

-- LaLiga (España)
(uuid_generate_v4(), '22222222-2222-2222-2222-222222222222', 'Real Madrid', 'RMA', 'https://media.api-sports.io/football/teams/541.png', 86),
(uuid_generate_v4(), '22222222-2222-2222-2222-222222222222', 'FC Barcelona', 'FCB', 'https://media.api-sports.io/football/teams/529.png', 84),
(uuid_generate_v4(), '22222222-2222-2222-2222-222222222222', 'Atlético de Madrid', 'ATM', 'https://media.api-sports.io/football/teams/530.png', 82),
(uuid_generate_v4(), '22222222-2222-2222-2222-222222222222', 'Girona FC', 'GIR', 'https://media.api-sports.io/football/teams/547.png', 78),
(uuid_generate_v4(), '22222222-2222-2222-2222-222222222222', 'Athletic Club', 'ATH', 'https://media.api-sports.io/football/teams/531.png', 80),

-- Serie A (Italia)
(uuid_generate_v4(), '33333333-3333-3333-3333-333333333333', 'Inter de Milán', 'INT', 'https://media.api-sports.io/football/teams/505.png', 83),
(uuid_generate_v4(), '33333333-3333-3333-3333-333333333333', 'AC Milan', 'MIL', 'https://media.api-sports.io/football/teams/489.png', 81),
(uuid_generate_v4(), '33333333-3333-3333-3333-333333333333', 'Juventus FC', 'JUV', 'https://media.api-sports.io/football/teams/496.png', 81),
(uuid_generate_v4(), '33333333-3333-3333-3333-333333333333', 'AS Roma', 'ROM', 'https://media.api-sports.io/football/teams/497.png', 81),
(uuid_generate_v4(), '33333333-3333-3333-3333-333333333333', 'SSC Napoli', 'NAP', 'https://media.api-sports.io/football/teams/492.png', 81),

-- Bundesliga (Alemania)
(uuid_generate_v4(), '44444444-4444-4444-4444-444444444444', 'Bayer 04 Leverkusen', 'B04', 'https://media.api-sports.io/football/teams/168.png', 83),
(uuid_generate_v4(), '44444444-4444-4444-4444-444444444444', 'Bayern Múnich', 'BAY', 'https://media.api-sports.io/football/teams/157.png', 85),
(uuid_generate_v4(), '44444444-4444-4444-4444-444444444444', 'Borussia Dortmund', 'BVB', 'https://media.api-sports.io/football/teams/165.png', 81),
(uuid_generate_v4(), '44444444-4444-4444-4444-444444444444', 'RB Leipzig', 'RBL', 'https://media.api-sports.io/football/teams/173.png', 80),
(uuid_generate_v4(), '44444444-4444-4444-4444-444444444444', 'VfB Stuttgart', 'VFB', 'https://media.api-sports.io/football/teams/172.png', 78),

-- Ligue 1 (Francia)
(uuid_generate_v4(), '55555555-5555-5555-5555-555555555555', 'Paris Saint-Germain', 'PSG', 'https://media.api-sports.io/football/teams/85.png', 84),
(uuid_generate_v4(), '55555555-5555-5555-5555-555555555555', 'AS Mónaco', 'ASM', 'https://media.api-sports.io/football/teams/91.png', 79),
(uuid_generate_v4(), '55555555-5555-5555-5555-555555555555', 'Stade Brestois 29', 'BRE', 'https://media.api-sports.io/football/teams/106.png', 76),
(uuid_generate_v4(), '55555555-5555-5555-5555-555555555555', 'LOSC Lille', 'LIL', 'https://media.api-sports.io/football/teams/79.png', 78),
(uuid_generate_v4(), '55555555-5555-5555-5555-555555555555', 'Olympique de Marsella', 'OM', 'https://media.api-sports.io/football/teams/81.png', 79)
ON CONFLICT (name) DO NOTHING;
