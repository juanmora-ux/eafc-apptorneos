-- ==============================================================================
-- EA FC COMPANION APP - SUPABASE DATABASE SCHEMA & RLS POLICIES
-- Proyecto: Torneos EA FC (Companion App & Realtime Infrastructure)
-- Base de datos: PostgreSQL (Supabase)
-- ==============================================================================

-- 1. EXTENSIONES NECESARIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. ENUMS & TIPOS PERSONALIZADOS
-- ==============================================================================
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('player', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tournament_status AS ENUM ('draft', 'in_progress', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE match_status AS ENUM (
        'scheduled',       -- Creado en calendario, esperando que se juegue la fecha
        'live',            -- Partido en curso (se registran eventos)
        'pending_approval',-- Local cargó marcador final, esperando validación del visitante (Handshake)
        'disputed',        -- Visitante rechazó el marcador o hubo discrepancia
        'finished'         -- Validado por ambos o resuelto por admin
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE match_event_type AS ENUM ('goal', 'yellow_card', 'red_card');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 3. TABLAS PRINCIPALES
-- ==============================================================================

-- 3.1. LIGAS
CREATE TABLE IF NOT EXISTS public.leagues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    country VARCHAR(100) NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.2. CLUBES
CREATE TABLE IF NOT EXISTS public.clubs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL UNIQUE,
    short_name VARCHAR(10) NOT NULL,
    logo_url TEXT,
    overall_rating INT CHECK (overall_rating BETWEEN 50 AND 99),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.3. JUGADORES
CREATE TABLE IF NOT EXISTS public.players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    position VARCHAR(10) NOT NULL,
    rating INT CHECK (rating BETWEEN 40 AND 99) NOT NULL,
    pace INT CHECK (pace BETWEEN 0 AND 99),
    shooting INT CHECK (shooting BETWEEN 0 AND 99),
    passing INT CHECK (passing BETWEEN 0 AND 99),
    dribbling INT CHECK (dribbling BETWEEN 0 AND 99),
    defending INT CHECK (defending BETWEEN 0 AND 99),
    physical INT CHECK (physical BETWEEN 0 AND 99),
    photo_url TEXT,
    nationality VARCHAR(80),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.4. PERFILES DE USUARIO
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    username VARCHAR(60) NOT NULL UNIQUE,
    avatar_url TEXT,
    role user_role DEFAULT 'player' NOT NULL,
    assigned_club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
    has_spun_wheel BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.5. TORNEOS
CREATE TABLE IF NOT EXISTS public.tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    status tournament_status DEFAULT 'draft' NOT NULL,
    total_rounds INT DEFAULT 0 NOT NULL,
    current_round INT DEFAULT 1 NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.6. PARTICIPANTES DEL TORNEO
CREATE TABLE IF NOT EXISTS public.tournament_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE RESTRICT,
    joined_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(tournament_id, user_id),
    UNIQUE(tournament_id, club_id)
);

-- 3.7. JORNADAS / FECHAS DEL CALENDARIO
CREATE TABLE IF NOT EXISTS public.rounds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    round_number INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT FALSE NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(tournament_id, round_number)
);

-- 3.8. PARTIDOS
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
    
    home_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    home_club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE RESTRICT,
    home_score INT DEFAULT 0 NOT NULL CHECK (home_score >= 0),
    
    away_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    away_club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE RESTRICT,
    away_score INT DEFAULT 0 NOT NULL CHECK (away_score >= 0),
    
    status match_status DEFAULT 'scheduled' NOT NULL,
    local_submitted_at TIMESTAMPTZ,
    visitor_reviewed_at TIMESTAMPTZ,
    dispute_reason TEXT,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT different_users CHECK (home_user_id <> away_user_id)
);

-- 3.9. EVENTOS DE PARTIDO EN VIVO
CREATE TABLE IF NOT EXISTS public.match_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE RESTRICT,
    player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
    event_type match_event_type NOT NULL,
    minute INT CHECK (minute BETWEEN 1 AND 130) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.10. PIZARRA TÁCTICA Y ALINEACIÓN
CREATE TABLE IF NOT EXISTS public.tactics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    formation VARCHAR(20) DEFAULT '4-3-3' NOT NULL,
    positions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, club_id)
);

-- ==============================================================================
-- 4. ÍNDICES DE ALTO RENDIMIENTO
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_clubs_league_id ON public.clubs(league_id);
CREATE INDEX IF NOT EXISTS idx_players_club_id ON public.players(club_id);
CREATE INDEX IF NOT EXISTS idx_matches_round_id ON public.matches(round_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_users ON public.matches(home_user_id, away_user_id);
CREATE INDEX IF NOT EXISTS idx_match_events_match_id ON public.match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tourn ON public.tournament_participants(tournament_id);

-- ==============================================================================
-- 5. FUNCIONES Y TRIGGERS DE NEGOCIO
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER set_matches_updated_at
BEFORE UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER set_tournaments_updated_at
BEFORE UPDATE ON public.tournaments
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER set_tactics_updated_at
BEFORE UPDATE ON public.tactics
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, username, avatar_url, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url',
        'player'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_match_goal_event()
RETURNS TRIGGER AS $$
DECLARE
    v_home_club_id UUID;
    v_away_club_id UUID;
BEGIN
    IF NEW.event_type = 'goal' THEN
        SELECT home_club_id, away_club_id INTO v_home_club_id, v_away_club_id
        FROM public.matches
        WHERE id = NEW.match_id;

        IF NEW.club_id = v_home_club_id THEN
            UPDATE public.matches
            SET home_score = home_score + 1
            WHERE id = NEW.match_id;
        ELSIF NEW.club_id = v_away_club_id THEN
            UPDATE public.matches
            SET away_score = away_score + 1
            WHERE id = NEW.match_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_match_event_goal_inserted
AFTER INSERT ON public.match_events
FOR EACH ROW EXECUTE FUNCTION public.handle_match_goal_event();

-- ==============================================================================
-- 6. VISTA DINÁMICA: TABLA DE POSICIONES
-- ==============================================================================
CREATE OR REPLACE VIEW public.leaderboard_view AS
WITH match_results AS (
    SELECT
        m.tournament_id,
        m.home_user_id AS user_id,
        m.home_club_id AS club_id,
        1 AS pj,
        CASE WHEN m.home_score > m.away_score THEN 1 ELSE 0 END AS pg,
        CASE WHEN m.home_score = m.away_score THEN 1 ELSE 0 END AS pe,
        CASE WHEN m.home_score < m.away_score THEN 1 ELSE 0 END AS pp,
        m.home_score AS gf,
        m.away_score AS gc,
        CASE 
            WHEN m.home_score > m.away_score THEN 3
            WHEN m.home_score = m.away_score THEN 1
            ELSE 0
        END AS pts
    FROM public.matches m
    WHERE m.status = 'finished'

    UNION ALL

    SELECT
        m.tournament_id,
        m.away_user_id AS user_id,
        m.away_club_id AS club_id,
        1 AS pj,
        CASE WHEN m.away_score > m.home_score THEN 1 ELSE 0 END AS pg,
        CASE WHEN m.away_score = m.home_score THEN 1 ELSE 0 END AS pe,
        CASE WHEN m.away_score < m.home_score THEN 1 ELSE 0 END AS pp,
        m.away_score AS gf,
        m.home_score AS gc,
        CASE 
            WHEN m.away_score > m.home_score THEN 3
            WHEN m.away_score = m.home_score THEN 1
            ELSE 0
        END AS pts
    FROM public.matches m
    WHERE m.status = 'finished'
)
SELECT 
    tp.tournament_id,
    p.id AS user_id,
    p.username,
    c.id AS club_id,
    c.name AS club_name,
    c.short_name AS club_short_name,
    c.logo_url AS club_logo_url,
    COALESCE(SUM(mr.pj), 0)::INT AS pj,
    COALESCE(SUM(mr.pg), 0)::INT AS pg,
    COALESCE(SUM(mr.pe), 0)::INT AS pe,
    COALESCE(SUM(mr.pp), 0)::INT AS pp,
    COALESCE(SUM(mr.gf), 0)::INT AS gf,
    COALESCE(SUM(mr.gc), 0)::INT AS gc,
    (COALESCE(SUM(mr.gf), 0) - COALESCE(SUM(mr.gc), 0))::INT AS dg,
    COALESCE(SUM(mr.pts), 0)::INT AS pts
FROM public.tournament_participants tp
JOIN public.profiles p ON tp.user_id = p.id
JOIN public.clubs c ON tp.club_id = c.id
LEFT JOIN match_results mr 
    ON tp.tournament_id = mr.tournament_id 
    AND tp.user_id = mr.user_id 
    AND tp.club_id = mr.club_id
GROUP BY tp.tournament_id, p.id, p.username, c.id, c.name, c.short_name, c.logo_url
ORDER BY pts DESC, dg DESC, gf DESC, c.name ASC;

-- ==============================================================================
-- 7. ROW LEVEL SECURITY (RLS) - POLÍTICAS IDEMPOTENTES
-- ==============================================================================

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tactics ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.2. LIGAS, CLUBES Y JUGADORES
DROP POLICY IF EXISTS "Leagues are viewable by authenticated users" ON public.leagues;
CREATE POLICY "Leagues are viewable by authenticated users"
ON public.leagues FOR SELECT
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Leagues editable only by admin" ON public.leagues;
CREATE POLICY "Leagues editable only by admin"
ON public.leagues FOR ALL
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Clubs are viewable by authenticated users" ON public.clubs;
CREATE POLICY "Clubs are viewable by authenticated users"
ON public.clubs FOR SELECT
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Clubs editable only by admin" ON public.clubs;
CREATE POLICY "Clubs editable only by admin"
ON public.clubs FOR ALL
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Players are viewable by authenticated users" ON public.players;
CREATE POLICY "Players are viewable by authenticated users"
ON public.players FOR SELECT
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Players editable only by admin" ON public.players;
CREATE POLICY "Players editable only by admin"
ON public.players FOR ALL
TO authenticated
USING (public.is_admin());

-- 7.3. PROFILES
DROP POLICY IF EXISTS "Profiles are viewable by all authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by all authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id 
    AND (role = (SELECT role FROM public.profiles WHERE id = auth.uid()))
);

-- 7.4. TORNEOS Y PARTICIPANTES
DROP POLICY IF EXISTS "Tournaments viewable by authenticated users" ON public.tournaments;
CREATE POLICY "Tournaments viewable by authenticated users"
ON public.tournaments FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Tournaments manageable by admin" ON public.tournaments;
CREATE POLICY "Tournaments manageable by admin"
ON public.tournaments FOR ALL
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Tournament participants viewable by all" ON public.tournament_participants;
CREATE POLICY "Tournament participants viewable by all"
ON public.tournament_participants FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can join tournament or admin can assign" ON public.tournament_participants;
CREATE POLICY "Users can join tournament or admin can assign"
ON public.tournament_participants FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id OR public.is_admin()
);

-- 7.5. JORNADAS / FECHAS (ROUNDS)
DROP POLICY IF EXISTS "Rounds viewable by all authenticated users" ON public.rounds;
CREATE POLICY "Rounds viewable by all authenticated users"
ON public.rounds FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Rounds manageable exclusively by admin" ON public.rounds;
CREATE POLICY "Rounds manageable exclusively by admin"
ON public.rounds FOR ALL
TO authenticated
USING (public.is_admin());

-- 7.6. PARTIDOS (MATCHES)
DROP POLICY IF EXISTS "Matches viewable by all authenticated users" ON public.matches;
CREATE POLICY "Matches viewable by all authenticated users"
ON public.matches FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admin can insert matches" ON public.matches;
CREATE POLICY "Admin can insert matches"
ON public.matches FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users can update their own active matches or admin" ON public.matches;
CREATE POLICY "Users can update their own active matches or admin"
ON public.matches FOR UPDATE
TO authenticated
USING (
    public.is_admin()
    OR auth.uid() = home_user_id
    OR auth.uid() = away_user_id
)
WITH CHECK (
    public.is_admin()
    OR (
        auth.uid() = home_user_id 
        AND status IN ('scheduled', 'live', 'pending_approval')
    )
    OR (
        auth.uid() = away_user_id 
        AND status IN ('pending_approval', 'finished', 'disputed')
    )
);

-- 7.7. EVENTOS DE PARTIDO EN VIVO (MATCH EVENTS)
DROP POLICY IF EXISTS "Match events viewable by all authenticated users" ON public.match_events;
CREATE POLICY "Match events viewable by all authenticated users"
ON public.match_events FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Strict team event registration" ON public.match_events;
CREATE POLICY "Strict team event registration"
ON public.match_events FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1 FROM public.matches m
        WHERE m.id = match_id
          AND m.status IN ('scheduled', 'live')
          AND (
              (m.home_user_id = auth.uid() AND m.home_club_id = club_id)
              OR
              (m.away_user_id = auth.uid() AND m.away_club_id = club_id)
          )
    )
);

-- 7.8. PIZARRA TÁCTICA (TACTICS)
DROP POLICY IF EXISTS "Users can view any team tactics" ON public.tactics;
CREATE POLICY "Users can view any team tactics"
ON public.tactics FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can insert their own tactics" ON public.tactics;
CREATE POLICY "Users can insert their own tactics"
ON public.tactics FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update only their own tactics" ON public.tactics;
CREATE POLICY "Users can update only their own tactics"
ON public.tactics FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- 8. HABILITAR SUPABASE REALTIME & PERMISOS
-- ==============================================================================
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_events;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rounds;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tactics;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;