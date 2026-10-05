# Frontend Móvil - EA FC Companion App (Expo Go)
## Módulo 1: Autenticación & Ruleta de Asignación Persistente

Esta aplicación móvil está desarrollada con **React Native** y **TypeScript**, optimizada para ejecutarse directamente en **Expo Go** sin requerir compilación nativa previa.

---

### 1. Instalación y Ejecución en Expo Go

1. Abre tu terminal y navega hasta la carpeta `mobile`:
```bash
cd mobile
```

2. Instala las dependencias del proyecto:
```bash
npm install
```

3. Configura tus credenciales de Supabase en [`mobile/src/services/supabase.ts`](file:///c:/Users/Asus/Documents/PROYECTO%20SEGUNDO%20CORTE%20MOVIL/mobile/src/services/supabase.ts):
```typescript
export const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co';
export const SUPABASE_ANON_KEY = 'TU_SUPABASE_ANON_KEY';
```

4. Inicia el servidor de desarrollo de Expo:
```bash
npx expo start
```

5. Abre la aplicación **Expo Go** en tu dispositivo físico (Android o iOS) o emulador y escanea el código QR mostrado en la terminal.

---

### 2. Arquitectura de Componentes Móviles

```
mobile/
├── App.tsx                     # Entrypoint: GestureHandlerRootView + AuthProvider + RootNavigator
├── app.json                    # Configuración de Expo SDK
├── babel.config.js             # Plugin de Reanimated
├── package.json                # Dependencias validadas para Expo Go
├── tsconfig.json               # Configuración TypeScript
└── src/
    ├── context/
    │   └── AuthContext.tsx     # Contexto global con reactividad ante login/logout y sincronización de perfiles
    ├── screens/
    │   ├── AuthScreen.tsx      # Login y Registro con Supabase Auth (toggle, validaciones, diseño EA FC)
    │   └── ClubWheelScreen.tsx # Ruleta de asignación con Reanimated y persistencia de club asignado
    ├── services/
    │   └── supabase.ts         # Cliente Supabase configurado con AsyncStorage para guardar sesión en móvil
    └── types/
        └── database.ts         # Tipado TypeScript derivado del esquema PostgreSQL
```

---

### 3. Argumentación Técnica para la Defensa Oral

| Aspecto Evaluado | Explicación Técnica de Alto Nivel |
| :--- | :--- |
| **Persistencia de Sesión Móvil** | En aplicaciones móviles no existe `localStorage` del navegador. Se configuró `@react-native-async-storage/async-storage` como el motor de persistencia del cliente Supabase (`auth.storage = AsyncStorage`), garantizando que los tokens JWT de sesión se almacenen de forma segura en el almacenamiento local del dispositivo. |
| **Animación fluida a 60 FPS con Reanimated** | La ruleta de asignación utiliza valores compartidos (`useSharedValue`), estilos en el hilo nativo (`useAnimatedStyle`) y una curva de aceleración/frenado físico (`Easing.out(Easing.cubic)`). Al ejecutarse directamente en el **UI Thread** de React Native, se eliminan caídas de frames provocadas por el hilo de JavaScript (evita el "Bridge bottleneck"). |
| **Sincronización Hilo Nativo a JS (`runOnJS`)** | Cuando la animación del giro concluye en el hilo de renderizado nativo, la función `runOnJS(handleSpinEnd)` transfiere el control de vuelta al hilo de JavaScript para ejecutar la actualización asíncrona en Supabase (`public.profiles`) y refrescar el estado de React. |
| **Garantía de Asignación Única y Persistente** | La pantalla evalúa la bandera `profile.has_spun_wheel` y `profile.assigned_club_id`. Una vez que el usuario gira la ruleta, la columna `has_spun_wheel` pasa a `true` en la base de datos. Si el usuario cierra y vuelve a abrir la app, la interfaz salta automáticamente la ruleta y muestra la carta de su club oficial asignado, respetando la regla del campeonato. |
