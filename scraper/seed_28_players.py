import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Cargar credenciales desde scraper/.env
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("EXPO_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = (
    os.getenv("SUPABASE_KEY")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("EXPO_PUBLIC_SUPABASE_ANON_KEY")
)

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: No se encontraron credenciales válidas en scraper/.env")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Base de datos de jugadores reales de los top clubes de EA FC
SQUADS_DATABASE = {
    "Real Madrid": [
        {"name": "Thibaut Courtois", "position": "GK", "rating": 89, "pace": 52, "shooting": 48, "passing": 74, "dribbling": 72, "defending": 50, "physical": 77, "photo_url": "https://cdn.sofifa.net/players/192/119/25_120.png"},
        {"name": "Éder Militão", "position": "CB", "rating": 85, "pace": 84, "shooting": 50, "passing": 70, "dribbling": 72, "defending": 85, "physical": 82, "photo_url": "https://cdn.sofifa.net/players/240/130/25_120.png"},
        {"name": "Antonio Rüdiger", "position": "CB", "rating": 87, "pace": 82, "shooting": 54, "passing": 71, "dribbling": 68, "defending": 86, "physical": 86, "photo_url": "https://cdn.sofifa.net/players/205/498/25_120.png"},
        {"name": "Dani Carvajal", "position": "RB", "rating": 86, "pace": 80, "shooting": 60, "passing": 80, "dribbling": 81, "defending": 83, "physical": 81, "photo_url": "https://cdn.sofifa.net/players/204/963/25_120.png"},
        {"name": "Ferland Mendy", "position": "LB", "rating": 82, "pace": 89, "shooting": 62, "passing": 74, "dribbling": 78, "defending": 81, "physical": 84, "photo_url": "https://cdn.sofifa.net/players/232/862/25_120.png"},
        {"name": "Aurélien Tchouaméni", "position": "CDM", "rating": 85, "pace": 75, "shooting": 74, "passing": 81, "dribbling": 80, "defending": 83, "physical": 84, "photo_url": "https://cdn.sofifa.net/players/241/637/25_120.png"},
        {"name": "Federico Valverde", "position": "CM", "rating": 88, "pace": 88, "shooting": 84, "passing": 84, "dribbling": 83, "defending": 81, "physical": 85, "photo_url": "https://cdn.sofifa.net/players/239/053/25_120.png"},
        {"name": "Jude Bellingham", "position": "CAM", "rating": 90, "pace": 80, "shooting": 87, "passing": 84, "dribbling": 88, "defending": 79, "physical": 84, "photo_url": "https://cdn.sofifa.net/players/252/371/25_120.png"},
        {"name": "Rodrygo", "position": "RW", "rating": 86, "pace": 89, "shooting": 82, "passing": 81, "dribbling": 87, "defending": 53, "physical": 64, "photo_url": "https://cdn.sofifa.net/players/243/812/25_120.png"},
        {"name": "Vinicius Jr", "position": "LW", "rating": 90, "pace": 95, "shooting": 84, "passing": 81, "dribbling": 91, "defending": 39, "physical": 69, "photo_url": "https://cdn.sofifa.net/players/238/794/25_120.png"},
        {"name": "Kylian Mbappé", "position": "ST", "rating": 91, "pace": 97, "shooting": 90, "passing": 80, "dribbling": 92, "defending": 36, "physical": 78, "photo_url": "https://cdn.sofifa.net/players/231/747/25_120.png"}
    ],
    "FC Barcelona": [
        {"name": "Marc-André ter Stegen", "position": "GK", "rating": 89, "pace": 54, "shooting": 46, "passing": 87, "dribbling": 85, "defending": 48, "physical": 78, "photo_url": "https://cdn.sofifa.net/players/192/448/25_120.png"},
        {"name": "Ronald Araújo", "position": "CB", "rating": 85, "pace": 83, "shooting": 48, "passing": 65, "dribbling": 65, "defending": 85, "physical": 84, "photo_url": "https://cdn.sofifa.net/players/253/163/25_120.png"},
        {"name": "Pau Cubarsí", "position": "CB", "rating": 80, "pace": 72, "shooting": 40, "passing": 78, "dribbling": 75, "defending": 81, "physical": 74, "photo_url": "https://cdn.sofifa.net/players/278/290/25_120.png"},
        {"name": "Jules Koundé", "position": "RB", "rating": 85, "pace": 84, "shooting": 45, "passing": 75, "dribbling": 77, "defending": 85, "physical": 78, "photo_url": "https://cdn.sofifa.net/players/241/461/25_120.png"},
        {"name": "Alejandro Balde", "position": "LB", "rating": 81, "pace": 91, "shooting": 50, "passing": 73, "dribbling": 79, "defending": 76, "physical": 68, "photo_url": "https://cdn.sofifa.net/players/260/100/25_120.png"},
        {"name": "Marc Casadó", "position": "CDM", "rating": 78, "pace": 72, "shooting": 62, "passing": 78, "dribbling": 77, "defending": 77, "physical": 75, "photo_url": "https://cdn.sofifa.net/players/270/203/25_120.png"},
        {"name": "Pedri", "position": "CM", "rating": 86, "pace": 78, "shooting": 72, "passing": 86, "dribbling": 89, "defending": 70, "physical": 68, "photo_url": "https://cdn.sofifa.net/players/251/854/25_120.png"},
        {"name": "Dani Olmo", "position": "CAM", "rating": 85, "pace": 78, "shooting": 82, "passing": 84, "dribbling": 86, "defending": 54, "physical": 66, "photo_url": "https://cdn.sofifa.net/players/230/481/25_120.png"},
        {"name": "Lamine Yamal", "position": "RW", "rating": 86, "pace": 88, "shooting": 81, "passing": 83, "dribbling": 89, "defending": 42, "physical": 58, "photo_url": "https://cdn.sofifa.net/players/277/833/25_120.png"},
        {"name": "Raphinha", "position": "LW", "rating": 86, "pace": 89, "shooting": 83, "passing": 82, "dribbling": 86, "defending": 55, "physical": 73, "photo_url": "https://cdn.sofifa.net/players/233/419/25_120.png"},
        {"name": "Robert Lewandowski", "position": "ST", "rating": 88, "pace": 74, "shooting": 88, "passing": 79, "dribbling": 85, "defending": 44, "physical": 80, "photo_url": "https://cdn.sofifa.net/players/188/545/25_120.png"}
    ],
    "Manchester City": [
        {"name": "Ederson", "position": "GK", "rating": 88, "pace": 64, "shooting": 60, "passing": 93, "dribbling": 87, "defending": 64, "physical": 78, "photo_url": "https://cdn.sofifa.net/players/210/257/25_120.png"},
        {"name": "Rúben Dias", "position": "CB", "rating": 88, "pace": 66, "shooting": 39, "passing": 70, "dribbling": 68, "defending": 89, "physical": 87, "photo_url": "https://cdn.sofifa.net/players/239/818/25_120.png"},
        {"name": "Josko Gvardiol", "position": "LB", "rating": 83, "pace": 78, "shooting": 64, "passing": 75, "dribbling": 78, "defending": 82, "physical": 84, "photo_url": "https://cdn.sofifa.net/players/254/704/25_120.png"},
        {"name": "Kyle Walker", "position": "RB", "rating": 84, "pace": 90, "shooting": 63, "passing": 76, "dribbling": 77, "defending": 81, "physical": 81, "photo_url": "https://cdn.sofifa.net/players/188/377/25_120.png"},
        {"name": "Rodri", "position": "CDM", "rating": 91, "pace": 66, "shooting": 80, "passing": 86, "dribbling": 84, "defending": 87, "physical": 85, "photo_url": "https://cdn.sofifa.net/players/231/866/25_120.png"},
        {"name": "Kevin De Bruyne", "position": "CM", "rating": 90, "pace": 67, "shooting": 87, "passing": 94, "dribbling": 87, "defending": 65, "physical": 75, "photo_url": "https://cdn.sofifa.net/players/192/985/25_120.png"},
        {"name": "Phil Foden", "position": "RW", "rating": 88, "pace": 86, "shooting": 85, "passing": 87, "dribbling": 90, "defending": 58, "physical": 64, "photo_url": "https://cdn.sofifa.net/players/237/692/25_120.png"},
        {"name": "Erling Haaland", "position": "ST", "rating": 91, "pace": 89, "shooting": 93, "passing": 70, "dribbling": 81, "defending": 45, "physical": 88, "photo_url": "https://cdn.sofifa.net/players/239/085/25_120.png"}
    ]
}

# Estructura para completar automáticamente los 28 puestos de cualquier otro club
ROSTER_FILLER = [
    ("GK", 85, "192119"), ("RB", 82, "204963"), ("CB", 84, "240130"), ("CB", 85, "205498"),
    ("LB", 81, "232862"), ("CDM", 83, "241637"), ("CM", 84, "239053"), ("CAM", 85, "252371"),
    ("RW", 84, "243812"), ("LW", 86, "238794"), ("ST", 87, "231747"),
    ("GK", 79, "230862"), ("CB", 80, "243715"), ("RB", 78, "231936"), ("CM", 80, "248242"),
    ("RM", 79, "226161"), ("LW", 80, "251990"), ("ST", 81, "260230"),
    ("GK", 75, "236401"), ("CB", 76, "256280"), ("LB", 75, "260100"), ("CDM", 77, "270203"),
    ("CM", 76, "270202"), ("CAM", 78, "244261"), ("RW", 77, "262622"), ("LW", 76, "270812"),
    ("ST", 77, "273950"), ("ST", 74, "262821")
]

def seed_all_clubs():
    print("Obteniendo la lista de clubes de Supabase...")
    clubs_res = supabase.table("clubs").select("id, name").execute()
    db_clubs = clubs_res.data

    if not db_clubs:
        print("❌ No se encontraron clubes en la BD.")
        return

    print(f"✔ Se encontraron {len(db_clubs)} clubes en la BD.")
    total_inserted = 0

    for club in db_clubs:
        club_id = club["id"]
        club_name = club["name"]

        # Limpiar jugadores previos
        supabase.table("players").delete().eq("club_id", club_id).execute()

        payload = []
        real_squad = SQUADS_DATABASE.get(club_name, [])

        # 1. Agregar jugadores reales conocidos
        for p in real_squad:
            p_data = p.copy()
            p_data["club_id"] = club_id
            p_data["nationality"] = "Internacional"
            payload.append(p_data)

        # 2. Rellenar hasta tener exactamente 28 jugadores en el plantel
        start_idx = len(payload)
        for i in range(start_idx, 28):
            pos, rating, photo_id = ROSTER_FILLER[i]
            is_def = pos in ["GK", "CB", "LB", "RB", "CDM"]
            payload.append({
                "club_id": club_id,
                "name": f"Jugador {i + 1} ({club_name})",
                "position": pos,
                "rating": rating,
                "pace": 84 if not is_def else 75,
                "shooting": 80 if not is_def else 45,
                "passing": 78,
                "dribbling": 82,
                "defending": 42 if not is_def else 82,
                "physical": 75 if not is_def else 80,
                "nationality": "Internacional",
                "photo_url": f"https://cdn.sofifa.net/players/{photo_id[:3]}/{photo_id[3:]}/25_120.png"
            })

        res = supabase.table("players").insert(payload).execute()
        count = len(res.data) if res.data else 0
        total_inserted += count
        print(f"  └─ ✔ {count} jugadores registrados para: {club_name}")

    print(f"\n🎉 ¡Proceso finalizado con éxito! Total de jugadores cargados: {total_inserted}")

if __name__ == "__main__":
    seed_all_clubs()