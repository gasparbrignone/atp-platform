# CMS_SETUP.md

# Puesta en marcha del CMS (Sveltia CMS)

## Objetivo

Documentar cómo dejar el panel `/admin` editando contenido real, y cómo
probarlo en local.

---

# Por qué Sveltia CMS y no Decap CMS

Se empezó con **Decap CMS** (ver `docs/STACK_DECISIONS.md`), usando Netlify
como intermediario del login con GitHub. Al probarlo en la práctica, ese login
tiraba "Page not found": Netlify discontinuó **Netlify Identity**, la función
de la que depende ese método, y ya no tiene arreglo por ese lado (confirmado
en el foro oficial de soporte de Netlify — no es un error de configuración
nuestro).

**Sveltia CMS** es el sucesor de facto de Decap CMS: mismo `config.yml`, mismas
colecciones y campos, mantenido activamente. Además soporta un método de login
que Decap no tiene — pegar un **Personal Access Token** de GitHub — sin OAuth
App, sin Netlify, sin ningún proxy propio. Es el que se usa acá.

---

# Qué ya está listo

- Todo el contenido (`Actividades`, `Biblioteca`, `Carreras`, `Herramientas`)
  vive en Astro Content Collections (`src/content.config.ts` + JSON en
  `src/content/<colección>/`).
- El panel vive en `public/admin/` (`index.html` + `config.yml`), sin ninguna
  dependencia nueva en `package.json` — Sveltia CMS se carga vía CDN.
- El repo real ya existe: `gasparbrignone/atp-platform`, rama `main`, ya
  configurado en `config.yml`.

---

# Cómo entrar al panel y editar contenido

## 1. Generar un Personal Access Token de GitHub

1. En GitHub: foto de perfil → **Settings** →, al final del menú izquierdo,
   **Developer settings** → **Personal access tokens** → **Fine-grained
   tokens** → **Generate new token**.
2. **Repository access**: "Only select repositories" → elegir
   `atp-platform`.
3. **Permissions** → **Repository permissions** → **Contents**: `Read and
   write`.
4. Generar y copiar el token. Vale solo para vos: no compartirlo por chat ni
   email. Se puede revocar en cualquier momento desde la misma pantalla de
   GitHub.

## 2. Entrar al panel

1. Abrir `/admin/` del sitio publicado (o `http://localhost:4321/admin/` en
   local, con `npm run dev` corriendo).
2. Botón **"Sign In with Token"** → pegar el token del paso 1.
3. Ya se puede editar cualquiera de las 4 colecciones; al guardar, Sveltia
   crea un commit real en `gasparbrignone/atp-platform`.

---

# Probar en local sin publicar nada

`npm run dev` y abrir `http://localhost:4321/admin/` alcanza — el login con
token funciona igual en local que en producción, porque habla directo con la
API de GitHub (no depende de dónde esté alojado el panel).

Sveltia CMS no usa `decap-server` ni `local_backend` (eso era específico de
Decap) — si en algún momento se quiere editar contra el filesystem local sin
tocar GitHub, Sveltia tiene su propio flujo ("Work with Local Repository",
usando la API de archivos del navegador) documentado en
[sveltiacms.app](https://sveltiacms.app).

---

# Alternativa a futuro: login con botón (sin token manual)

Si más adelante se prefiere un botón de "Iniciar sesión con GitHub" en vez de
pegar un token a mano, Sveltia CMS mantiene su propio proxy de OAuth
desplegable en Cloudflare Workers (gratis): `sveltia/sveltia-cms-auth` en
GitHub. Es opcional — el método de token ya es completamente funcional y no
requiere esto.
