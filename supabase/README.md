# Documentación de Arquitectura de Base de Datos - Supabase & RLS
## EA FC Companion App (Desarrollo Móvil - Parcial V2)

Este documento detalla las decisiones técnicas y de ingeniería implementadas en el archivo [`schema.sql`](file:///c:/Users/Asus/Documents/PROYECTO%20SEGUNDO%20CORTE%20MOVIL/supabase/schema.sql) para cumplir con todos los requerimientos de la evaluación y preparar la defensa oral.

---

### 1. Pasos de Instalación y Ejecución

#### Opción A: A través del Dashboard de Supabase (Recomendado para desarrollo rápido)
1. Inicia sesión en tu consola de [Supabase](https://supabase.com/dashboard).
2. Crea un nuevo proyecto (o selecciona uno existente).
3. Dirígete a la pestaña **SQL Editor** en la barra lateral izquierda.
4. Abre el archivo [`supabase/schema.sql`](file:///c:/Users/Asus/Documents/PROYECTO%20SEGUNDO%20CORTE%20MOVIL/supabase/schema.sql), copia todo su contenido y pégalo en el editor.
5. Haz clic en **Run**. 
6. Verifica en la sección **Table Editor** y **Database -> Replication** que las tablas estén creadas y las publicaciones de Realtime estén activas.

#### Opción B: A través de Supabase CLI
```bash
# Instalar Supabase CLI si no se tiene
npm install -g supabase

# Iniciar sesión y enlazar el proyecto
supabase login
supabase link --project-ref TU_PROJECT_ID

# Aplicar el esquema
supabase db push
```

---

### 2. Decisiones Clave para la Defensa Oral (Guía para Preguntas Aleatorias)

| Módulo / Decisión | Justificación Técnica & Preguntas Típicas del Profesor |
| :--- | :--- |
| **Separación de `auth.users` y `public.profiles`** | **¿Por qué no guardar datos extra en `auth.users`?** <br>Por seguridad y arquitectura; la tabla `auth.users` es gestionada internamente por GoTrue (Supabase Auth). La tabla `profiles` nos permite aplicar claves foráneas (`assigned_club_id`), roles personalizados (`player`, `admin`) y políticas RLS controladas por el frontend. Se sincroniza con un trigger `SECURITY DEFINER` al crearse el usuario. |
| **Ruleta de Asignación Persistente** | La columna `has_spun_wheel` y `assigned_club_id` en `profiles` aseguran que una vez que el usuario gira la ruleta tras el registro, la asignación queda congelada. Las restricciones RLS impiden que vuelva a modificarse si ya tiene un valor. |
| **RLS Estricta en Partidos en Vivo (`match_events`)** | **¿Cómo se asegura que un usuario no manipule los goles del rival?** <br>La política RLS `Strict team event registration` verifica mediante un subquery en PostgreSQL que: <br>1. `auth.uid() = user_id`<br>2. El partido esté en estado `'live'`.<br>3. Si el usuario es local, el `club_id` del evento DEBE ser estrictamente `m.home_club_id`. Si es visitante, DEBE ser `m.away_club_id`. Cualquier intento de inyectar goles al rival es rechazado a nivel de motor de BD. |
| **Handshake y Validación Cruzada (`matches`)** | El flujo de estados implementado (`scheduled` -> `live` -> `pending_approval` -> `finished` / `disputed`) garantiza el protocolo de dos fases: <br>• El equipo local finaliza y actualiza a `pending_approval`.<br>• El equipo visitante recibe la actualización por WebSockets y tiene permisos RLS exclusivos para transicionar a `finished` (aprobado) o `disputed` (rechazado). Si cae en `disputed`, solo el `admin` puede intervenir. |
| **Tabla de Posiciones Dinámica (`leaderboard_view`)** | **¿Por qué una View con `UNION ALL` en lugar de columnas estáticas de puntos?** <br>Evita inconsistencias de concurrencia y condiciones de carrera (Race Conditions). La vista calcula al vuelo PJ, PG, PE, PP, GF, GC, DG y PTS tomando únicamente los partidos con `status = 'finished'`. Si un resultado se corrige o entra en disputa, la tabla de posiciones se recalcula atómicamente sin desincronizaciones. |
| **Supabase Realtime (WebSockets)** | Se habilitó la publicación `supabase_realtime` en las tablas `matches`, `match_events`, `rounds` y `tactics` para alimentar los canales de Supabase en React Native sin necesidad de polling HTTP continuo. |
