# Financiera Digital — Scoring PWA
## Cómo deployar en 10 minutos (gratis)

### Lo que necesitás
- Cuenta en GitHub (gratis): github.com
- Cuenta en Vercel (gratis): vercel.com

---

## PASO 1 — Subir el código a GitHub

1. Entrá a github.com → "New repository"
2. Nombre: `financiera-scoring` → "Create repository"
3. Subí todos los archivos de esta carpeta
   (arrastrá la carpeta completa al navegador de GitHub)

---

## PASO 2 — Deployar en Vercel

1. Entrá a vercel.com → "Add New Project"
2. Conectá tu cuenta de GitHub
3. Seleccioná el repo `financiera-scoring`
4. Framework: **Create React App** (lo detecta solo)
5. Click en **Deploy**
6. En 2 minutos tenés la URL: `https://financiera-scoring.vercel.app`

---

## PASO 3 — Instalar como app en el celular

### Android (Chrome):
1. Abrí la URL en Chrome
2. Aparece un banner "Agregar a pantalla de inicio" — tocalo
3. O bien: menú ⋮ → "Instalar aplicación"
4. La app queda con ícono propio en la pantalla de inicio

### iPhone (Safari):
1. Abrí la URL en Safari (no Chrome)
2. Tocá el botón compartir (cajita con flecha)
3. "Agregar a pantalla de inicio"
4. La app queda instalada como app nativa

---

## PASO 4 — Compartir con el equipo

Simplemente compartís la URL. Cada integrante del equipo
puede instalársela en su celu siguiendo el Paso 3.

No requiere App Store ni Google Play.
No requiere cuenta de usuario.
Funciona offline una vez instalada.

---

## Para actualizar la app

Cualquier cambio que subas a GitHub se publica
automáticamente en Vercel en ~30 segundos.

---

## Estructura del proyecto

```
financiera-pwa/
├── public/
│   ├── index.html        ← HTML base + PWA meta tags
│   ├── manifest.json     ← Configuración de la app (nombre, ícono, colores)
│   └── sw.js             ← Service worker (funciona offline)
├── src/
│   ├── index.js          ← Punto de entrada React
│   └── App.js            ← Toda la lógica de la app
└── package.json          ← Dependencias
```

---

## Personalización rápida

Para cambiar el nombre de la app:
→ `public/manifest.json` → campo "name" y "short_name"

Para cambiar la TNA base:
→ `src/App.js` → línea: `const TNA_BASE = 0.95;`

Para cambiar montos máximos por zona:
→ `src/App.js` → array `ZONAS` al principio del archivo
