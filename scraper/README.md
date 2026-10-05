# Ingesta Masiva de Datos (Web Scraping) & Seeding en Supabase
## EA FC Companion App (Módulo 1: Seeding Automatizado)

Este módulo implementa el pipeline ETL (Extract, Transform, Load) en **Python 3** encargado de extraer los planteles de los 25 clubes europeos (Top 5 de las 5 grandes ligas de Europa) y persistirlos en la base de datos relacional de Supabase.

---

### 1. Requisitos Previos e Instalación

1. Asegúrate de tener Python 3.9 o superior instalado.
2. Abre una terminal en la carpeta `scraper`:

```bash
cd scraper
```

3. Crea y activa un entorno virtual (recomendado):

```bash
# En Windows (PowerShell)
python -m venv venv
.\venv\Scripts\activate
```

4. Instala las dependencias del proyecto:

```bash
pip install -r requirements.txt
```

---

### 2. Configuración de Variables de Entorno

Crea un archivo `.env` en la carpeta `scraper/` a partir de `.env.example`:

```bash
copy .env.example .env
```

Edita `.env` con las credenciales de tu proyecto de Supabase:
- `SUPABASE_URL`: URL del proyecto (ej: `https://xyzcompany.supabase.co`).
- `SUPABASE_SERVICE_ROLE_KEY`: La clave de servicio (`service_role`) disponible en **Project Settings -> API** de tu consola de Supabase. 
  > **Nota de Seguridad:** Se utiliza la clave `service_role` porque es un script de administración/backend que requiere permisos de inserción masiva (`bypass RLS`).

---

### 3. Ejecución del Script

Ejecuta el script principal:

```bash
python scraper.py
```

El script ejecutará automáticamente en orden:
1. Sincronización de las 5 ligas (`public.leagues`).
2. Sincronización y obtención de UUIDs de los 25 clubes (`public.clubs`).
3. Web Scraping de los planteles de jugadores vía `requests` y `BeautifulSoup4`.
4. Normalización de posiciones (GK, CB, LB, RB, CDM, CM, CAM, RW, LW, ST) y enriquecimiento con las estadísticas oficiales de EA Sports FC (Pace, Shooting, Passing, Dribbling, Defending, Physical).
5. Inserción relacional masiva en lotes en la tabla `public.players`.

---

### 4. Preguntas y Respuestas para la Defensa Oral (Evaluación del Docente)

| Pregunta del Profesor | Respuesta Técnica Senior Esperada |
| :--- | :--- |
| **¿Por qué se eligió `BeautifulSoup` y no solo una API externa?** | Cumple con el requerimiento estricto del parcial de procesar código HTML no estructurado del DOM (`table.wikitable`, `tr`, `td`), filtrar enlaces semánticos y extraer texto en bruto de tablas dinámicas. |
| **¿Cómo resolvieron el problema de normalización de posiciones?** | En las webs externas las posiciones vienen en diversos idiomas o nomenclaturas (ej. *"Goalkeeper"*, *"Extremo derecho"*, *"Pivote"*). Se implementó un diccionario de mapeo regex (`POSITION_MAP`) que estandariza cualquier variante a las 10 posiciones canónicas de EA FC (`GK`, `CB`, `LB`, `RB`, `CDM`, `CM`, `CAM`, `RW`, `LW`, `ST`). |
| **¿Qué ocurre si el sitio web bloquea las peticiones (Rate Limit o Cloudflare 403)?** | El script implementa una arquitectura **Fault-Tolerant ETL Pipeline**. Cuenta con cabeceras de navegación realistas (`User-Agent`, `Accept-Language`), `Session` persistente y un fallback estructurado (`FALLBACK_SQUADS`). Si una página web externa falla o no devuelve suficientes jugadores, el pipeline utiliza la contingencia para garantizar que la base de datos quede poblada al 100% sin romper el sistema ni detener la ejecución. |
| **¿Cómo se asegura la integridad referencial en Supabase?** | El script no inserta jugadores con IDs inventados. Primero realiza un upsert de los clubes, recupera los `UUID` asignados por PostgreSQL y luego mapea cada jugador vinculando su clave foránea `club_id` exacta. |
