# YOUTUBE_SETUP.md

# Puesta en marcha de la grilla de videos de YouTube

## Objetivo

Documentar el único paso pendiente para que la grilla de últimos videos
(home y Carreras → Medicina) muestre videos reales, y qué se ve mientras
tanto.

---

# Por qué una API key

La grilla necesita pedirle a YouTube "los últimos N videos subidos al
canal" — eso no es una URL fija como el embed de un solo video, requiere
la YouTube Data API v3. La key se usa **solo durante el build del sitio**
(en GitHub Actions, no en el navegador de quien visita el sitio): nunca
viaja al público ni queda expuesta en el código del sitio (ver
`src/lib/youtube.ts` y `src/env.d.ts`).

Sin la key configurada, la grilla no rompe nada: en su lugar aparece un
botón "Ver nuestro canal en YouTube" que lleva directo al canal.

---

# Qué ya está listo (código)

- `src/lib/youtube.ts` pide los últimos videos a la API en build time.
- `src/components/YouTubeVideoGrid.astro` los muestra en una grilla con la
  miniatura real de cada video; al hacer click recién ahí carga el
  reproductor (no se cargan videos que nadie reproduce).
- Usado en el home (al final de la página) y en Carreras → Medicina.
- `.github/workflows/deploy.yml` ya pasa el secret `YOUTUBE_API_KEY` al
  build — falta crearlo (paso 2 de abajo).

---

# Qué falta (acción externa, no código)

## 1. Crear la API key en Google Cloud

1. Ir a [console.cloud.google.com](https://console.cloud.google.com/) e
   iniciar sesión con la cuenta de Google de ATP
   (`atpcienciasmedicas@gmail.com`).
2. Crear un proyecto nuevo (o usar uno existente) — el nombre no importa,
   por ejemplo "ATP Platform".
3. En el buscador de arriba, escribir **"YouTube Data API v3"**, entrar y
   apretar **Habilitar**.
4. Ir a **APIs y servicios → Credenciales → Crear credenciales → Clave de
   API**. Se genera la key al instante.
5. Restringir la key (recomendado, evita que alguien más la use si se
   filtra): en la pantalla de la key recién creada, bajo
   **Restricciones de API**, elegir **Restringir clave** y tildar
   únicamente **YouTube Data API v3**. Guardar.
6. Copiar la key (empieza con `AIza...`).

La cuota gratuita (10.000 unidades/día) alcanza de sobra: cada build del
sitio gasta 1 unidad.

## 2. Cargarla como secret en GitHub

1. En el repo, ir a **Settings → Secrets and variables → Actions**.
2. **New repository secret**.
3. Nombre: `YOUTUBE_API_KEY`. Valor: la key copiada en el paso anterior.
4. Guardar.

Con eso, el próximo push a `main` (o `workflow_dispatch` manual en la
pestaña Actions) ya la usa — no hace falta tocar código.

## 3. Para probar en la computadora (opcional)

Crear un archivo `.env` en la raíz del proyecto (ya está en `.gitignore`,
nunca se sube) con:

```
YOUTUBE_API_KEY=AIza...
```

y correr `npm run dev` o `npm run build` normalmente.

---

# Verificar que funciona

1. Con el secret cargado, esperar al próximo deploy (o dispararlo a mano
   desde la pestaña **Actions** del repo, botón **Run workflow** sobre
   "Deploy to GitHub Pages").
2. Entrar al home (al final de la página) o a Carreras → Medicina — debería
   verse una grilla con miniaturas reales de los últimos videos del canal,
   no el botón "Ver nuestro canal en YouTube".
3. Subir un video nuevo al canal y esperar al próximo deploy: aparece solo,
   sin tocar nada acá.
