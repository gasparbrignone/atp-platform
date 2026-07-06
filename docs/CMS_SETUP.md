# CMS_SETUP.md

# Puesta en marcha de Decap CMS

## Objetivo

Documentar los pasos que quedan pendientes para que el panel `/admin` (Decap
CMS) pueda editar contenido real en producción, y cómo probar todo lo demás
ahora mismo sin necesitar ninguno de esos pasos.

Estos pasos son acciones sobre cuentas externas (GitHub, un proveedor de auth)
que solo puede hacer quien tenga acceso a esas cuentas — no son cambios de
código.

---

# Qué ya está listo

- Todo el contenido (`Actividades`, `Biblioteca`, `Carreras`, `Herramientas`)
  vive en Astro Content Collections (`src/content.config.ts` + JSON en
  `src/content/<colección>/`), el formato que Decap puede editar.
- El panel vive en `public/admin/` (`index.html` + `config.yml`), sin ninguna
  dependencia nueva en `package.json` — Decap se carga vía CDN.
- `config.yml` ya tiene las 4 colecciones configuradas con sus campos.

---

# Qué falta (acción externa, no código)

## 1. ~~Crear el repositorio real en GitHub~~ ✅ Listo

Repo: `gasparbrignone/atp-platform` (rama `main`), ya con el código pusheado.
`config.yml` ya tiene el `repo:` real completado.

## 2. Crear una GitHub OAuth App

GitHub → Settings → Developer settings → OAuth Apps → New OAuth App.

## 3. Elegir un proveedor de autenticación

El hosting del sitio es GitHub Pages (sin backend propio), así que Decap
necesita un proveedor externo que haga el intercambio OAuth. La opción
recomendada, sin escribir ni mantener código de servidor:

- Crear un sitio gratuito en **Netlify**, conectado al mismo repo, usado
  **solo** como proveedor de autenticación (Site settings → Access control →
  OAuth) — el sitio real sigue sirviéndose desde GitHub Pages, Netlify no lo
  hostea.
- Cargar ahí el Client ID/Secret de la OAuth App creada en el paso 2.
- La URL de ese sitio Netlify es el `base_url` que va en `config.yml`.

## 4. ~~Completar el placeholder restante de `public/admin/config.yml`~~ ✅ Listo

`base_url: https://mellifluous-cat-9cd28e.netlify.app` (el sitio Netlify del
paso 3). `config.yml` ya no tiene placeholders pendientes.

Para que el login funcione de punta a punta todavía hace falta que el paso 2
(OAuth App) esté conectado en ese mismo sitio Netlify (paso 3, Access control
→ OAuth, con el Client ID/Secret de la OAuth App) — eso sigue siendo una
acción manual en las cuentas de GitHub/Netlify, no un cambio de código.

---

# Probar todo ahora mismo, sin nada de lo anterior

`config.yml` ya tiene `local_backend: true`, que permite usar el panel contra
el filesystem local sin necesitar git ni OAuth:

1. Terminal 1: `npm run dev`
2. Terminal 2: `npx decap-server`
3. Abrir `http://localhost:4321/admin/index.html` (con `index.html` explícito:
   el servidor de desarrollo de Astro no resuelve `/admin/` a su índice como
   sí hace cualquier hosting estático en producción — en GitHub Pages
   `/admin/` funciona sin el sufijo).
4. Editar cualquier entrada (por ejemplo, una actividad) y guardar.
5. Confirmar que el JSON correspondiente en `src/content/activities/` cambió
   en disco, y que `/actividades` refleja el cambio.

Esta es la verificación funcional del CMS hasta que existan el repo real y el
proveedor de auth.
