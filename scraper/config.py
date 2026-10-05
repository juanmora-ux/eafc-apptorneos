"""
Configuración y metadatos de las 5 grandes ligas y los 25 clubes oficiales para EA FC Companion App.
"""

LEAGUES_DATA = [
    {
        "id": "11111111-1111-1111-1111-111111111111",
        "name": "Premier League",
        "country": "Inglaterra",
        "logo_url": "https://media.api-sports.io/football/leagues/39.png"
    },
    {
        "id": "22222222-2222-2222-2222-222222222222",
        "name": "LaLiga EA Sports",
        "country": "España",
        "logo_url": "https://media.api-sports.io/football/leagues/140.png"
    },
    {
        "id": "33333333-3333-3333-3333-333333333333",
        "name": "Serie A",
        "country": "Italia",
        "logo_url": "https://media.api-sports.io/football/leagues/135.png"
    },
    {
        "id": "44444444-4444-4444-4444-444444444444",
        "name": "Bundesliga",
        "country": "Alemania",
        "logo_url": "https://media.api-sports.io/football/leagues/78.png"
    },
    {
        "id": "55555555-5555-5555-5555-555555555555",
        "name": "Ligue 1 McDonald's",
        "country": "Francia",
        "logo_url": "https://media.api-sports.io/football/leagues/61.png"
    }
]

# 25 Clubes seleccionados (5 por liga)
CLUBS_DATA = [
    # Premier League
    {
        "name": "Manchester City",
        "short_name": "MCI",
        "league_id": "11111111-1111-1111-1111-111111111111",
        "overall_rating": 85,
        "logo_url": "https://media.api-sports.io/football/teams/50.png",
        "wiki_slug": "Manchester_City_F.C."
    },
    {
        "name": "Arsenal FC",
        "short_name": "ARS",
        "league_id": "11111111-1111-1111-1111-111111111111",
        "overall_rating": 83,
        "logo_url": "https://media.api-sports.io/football/teams/42.png",
        "wiki_slug": "Arsenal_F.C."
    },
    {
        "name": "Liverpool FC",
        "short_name": "LIV",
        "league_id": "11111111-1111-1111-1111-111111111111",
        "overall_rating": 84,
        "logo_url": "https://media.api-sports.io/football/teams/40.png",
        "wiki_slug": "Liverpool_F.C."
    },
    {
        "name": "Manchester United",
        "short_name": "MUN",
        "league_id": "11111111-1111-1111-1111-111111111111",
        "overall_rating": 82,
        "logo_url": "https://media.api-sports.io/football/teams/33.png",
        "wiki_slug": "Manchester_United_F.C."
    },
    {
        "name": "Chelsea FC",
        "short_name": "CHE",
        "league_id": "11111111-1111-1111-1111-111111111111",
        "overall_rating": 81,
        "logo_url": "https://media.api-sports.io/football/teams/49.png",
        "wiki_slug": "Chelsea_F.C."
    },

    # LaLiga EA Sports
    {
        "name": "Real Madrid",
        "short_name": "RMA",
        "league_id": "22222222-2222-2222-2222-222222222222",
        "overall_rating": 86,
        "logo_url": "https://media.api-sports.io/football/teams/541.png",
        "wiki_slug": "Real_Madrid_CF"
    },
    {
        "name": "FC Barcelona",
        "short_name": "FCB",
        "league_id": "22222222-2222-2222-2222-222222222222",
        "overall_rating": 84,
        "logo_url": "https://media.api-sports.io/football/teams/529.png",
        "wiki_slug": "FC_Barcelona"
    },
    {
        "name": "Atlético de Madrid",
        "short_name": "ATM",
        "league_id": "22222222-2222-2222-2222-222222222222",
        "overall_rating": 82,
        "logo_url": "https://media.api-sports.io/football/teams/530.png",
        "wiki_slug": "Atl%C3%A9tico_Madrid"
    },
    {
        "name": "Girona FC",
        "short_name": "GIR",
        "league_id": "22222222-2222-2222-2222-222222222222",
        "overall_rating": 78,
        "logo_url": "https://media.api-sports.io/football/teams/547.png",
        "wiki_slug": "Girona_FC"
    },
    {
        "name": "Athletic Club",
        "short_name": "ATH",
        "league_id": "22222222-2222-2222-2222-222222222222",
        "overall_rating": 80,
        "logo_url": "https://media.api-sports.io/football/teams/531.png",
        "wiki_slug": "Athletic_Bilbao"
    },

    # Serie A
    {
        "name": "Inter de Milán",
        "short_name": "INT",
        "league_id": "33333333-3333-3333-3333-333333333333",
        "overall_rating": 83,
        "logo_url": "https://media.api-sports.io/football/teams/505.png",
        "wiki_slug": "Inter_Milan"
    },
    {
        "name": "AC Milan",
        "short_name": "MIL",
        "league_id": "33333333-3333-3333-3333-333333333333",
        "overall_rating": 81,
        "logo_url": "https://media.api-sports.io/football/teams/489.png",
        "wiki_slug": "AC_Milan"
    },
    {
        "name": "Juventus FC",
        "short_name": "JUV",
        "league_id": "33333333-3333-3333-3333-333333333333",
        "overall_rating": 81,
        "logo_url": "https://media.api-sports.io/football/teams/496.png",
        "wiki_slug": "Juventus_FC"
    },
    {
        "name": "AS Roma",
        "short_name": "ROM",
        "league_id": "33333333-3333-3333-3333-333333333333",
        "overall_rating": 81,
        "logo_url": "https://media.api-sports.io/football/teams/497.png",
        "wiki_slug": "AS_Roma"
    },
    {
        "name": "SSC Napoli",
        "short_name": "NAP",
        "league_id": "33333333-3333-3333-3333-333333333333",
        "overall_rating": 81,
        "logo_url": "https://media.api-sports.io/football/teams/492.png",
        "wiki_slug": "SSC_Napoli"
    },

    # Bundesliga
    {
        "name": "Bayer 04 Leverkusen",
        "short_name": "B04",
        "league_id": "44444444-4444-4444-4444-444444444444",
        "overall_rating": 83,
        "logo_url": "https://media.api-sports.io/football/teams/168.png",
        "wiki_slug": "Bayer_04_Leverkusen"
    },
    {
        "name": "Bayern Múnich",
        "short_name": "BAY",
        "league_id": "44444444-4444-4444-4444-444444444444",
        "overall_rating": 85,
        "logo_url": "https://media.api-sports.io/football/teams/157.png",
        "wiki_slug": "FC_Bayern_Munich"
    },
    {
        "name": "Borussia Dortmund",
        "short_name": "BVB",
        "league_id": "44444444-4444-4444-4444-444444444444",
        "overall_rating": 81,
        "logo_url": "https://media.api-sports.io/football/teams/165.png",
        "wiki_slug": "Borussia_Dortmund"
    },
    {
        "name": "RB Leipzig",
        "short_name": "RBL",
        "league_id": "44444444-4444-4444-4444-444444444444",
        "overall_rating": 80,
        "logo_url": "https://media.api-sports.io/football/teams/173.png",
        "wiki_slug": "RB_Leipzig"
    },
    {
        "name": "VfB Stuttgart",
        "short_name": "VFB",
        "league_id": "44444444-4444-4444-4444-444444444444",
        "overall_rating": 78,
        "logo_url": "https://media.api-sports.io/football/teams/172.png",
        "wiki_slug": "VfB_Stuttgart"
    },

    # Ligue 1
    {
        "name": "Paris Saint-Germain",
        "short_name": "PSG",
        "league_id": "55555555-5555-5555-5555-555555555555",
        "overall_rating": 84,
        "logo_url": "https://media.api-sports.io/football/teams/85.png",
        "wiki_slug": "Paris_Saint-Germain_F.C."
    },
    {
        "name": "AS Mónaco",
        "short_name": "ASM",
        "league_id": "55555555-5555-5555-5555-555555555555",
        "overall_rating": 79,
        "logo_url": "https://media.api-sports.io/football/teams/91.png",
        "wiki_slug": "AS_Monaco_FC"
    },
    {
        "name": "Stade Brestois 29",
        "short_name": "BRE",
        "league_id": "55555555-5555-5555-5555-555555555555",
        "overall_rating": 76,
        "logo_url": "https://media.api-sports.io/football/teams/106.png",
        "wiki_slug": "Stade_Brestois_29"
    },
    {
        "name": "LOSC Lille",
        "short_name": "LIL",
        "league_id": "55555555-5555-5555-5555-555555555555",
        "overall_rating": 78,
        "logo_url": "https://media.api-sports.io/football/teams/79.png",
        "wiki_slug": "LOSC_Lille"
    },
    {
        "name": "Olympique de Marsella",
        "short_name": "OM",
        "league_id": "55555555-5555-5555-5555-555555555555",
        "overall_rating": 79,
        "logo_url": "https://media.api-sports.io/football/teams/81.png",
        "wiki_slug": "Olympique_de_Marseille"
    }
]
