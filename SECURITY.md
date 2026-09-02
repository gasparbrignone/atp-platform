# SECURITY.md — Security Source of Truth

Este documento describe la postura de seguridad real del proyecto ATP
(`atpfcm.com.ar`), tal como existe hoy. No es un checklist genérico: cada
afirmación acá está respaldada por código, configuración o documentación
del propio repo. Donde algo no se pudo verificar directamente (por ejemplo,
configuración que solo existe en un panel externo como GitHub o Cloudflare),
se marca explícitamente como `NOT VERIFIABLE` en vez de asumirse.

**Cualquier sesión de trabajo (humana o de IA) que vaya a hacer un cambio no
trivial en este proyecto debería leer este archivo primero**, junto con
[docs/SECURITY_DECISIONS.md](docs/SECURITY_DECISIONS.md) (por qué se decidió
cada cosa) y [docs/SECURITY_CHANGELOG.md](docs/SECURITY_CHANGELOG.md) (qué
cambió y cuándo). Ver también la sección "Seguridad" de `CLAUDE.md`.

Última actualización: 2026-09-02.

---

## Arquitectura de seguridad, en una imagen

```
Visitante (navegador)
  │
  ├─ atpfcm.com.ar (estático) ── Cloudflare (proxy, headers, DNS) ── GitHub Pages
  │     └─ CSP vía <meta> por página (generada por Astro en build time)
  │
  ├─ Formularios (fetch, mode: no-cors) ──► Google Apps Script Web App
  │     └─ único "backend" real del sitio — vive en un Google Sheet
  │
  └─ /staff/escanear/ (JSONP) ──► mismo Apps Script, acción `checkin`

Editor de contenido (staff con PAT)
  └─ /admin/ (Sveltia CMS) ──► API de GitHub ──► push directo a `main`
        └─ push a `main` dispara el deploy automático a producción
           (sin paso de aprobación humana intermedio — ver "Known Limitations")

CI/CD (GitHub Actions)
  ├─ deploy.yml: build + deploy a GitHub Pages, en cada push a `main`
  └─ migrate-drive-books.yml: descarga PDFs de Drive, sube a GitHub Releases,
        commitea el resultado de vuelta a `main` (con RELEASES_PAT)
```

## Trust boundaries

| Límite | Quién confía en quién | Validación real |
|---|---|---|
| Visitante → sitio estático | El navegador ejecuta lo que Astro generó en build time | N/A — no hay lógica de servidor del lado del sitio en sí |
| Visitante → Apps Script | El script confía en los parámetros del request, no en el origen | Rate limiting básico (`isRateLimited`/`bumpCounter`), HMAC en el link de baja, escaping de HTML en mails, secreto compartido para el check-in |
| Staff (CMS) → GitHub | GitHub confía en el PAT que Sveltia manda | Scope del PAT documentado en `docs/CMS_SETUP.md` (fine-grained, un repo, `Contents: Read and write`) |
| `main` → producción | El workflow de deploy confía en cualquier commit que llegue a `main` | **Ninguna aprobación humana intermedia hoy** — es el hallazgo más importante de toda la revisión de seguridad (ver Known Limitations) |
| CI → servicios externos | `migrate-drive-books.yml` confía en `gdown` (PyPI, sin versión fijada) y en `gh` (oficial) | Sin pin de versión en `gdown` — ver Known Limitations |

## Activos críticos

| Activo | Por qué importa |
|---|---|
| `main` (rama de producción) | Cualquier push dispara deploy automático — es el activo de mayor impacto de todo el sistema |
| El Google Sheet de inscripciones/charlas | Contiene DNI, teléfono, email de personas reales |
| Los secretos del Apps Script (`STAFF_CHECKIN_SECRET`, `UNSUBSCRIBE_SECRET`) | Viven solo ahí, nunca en este repo |
| Cuenta de GitHub del owner | Es el techo de todo lo demás — comprometida, compromete todo |

---

## Secretos existentes (sin valores)

| Nombre | Propósito | Dónde se usa | Quién debería tener acceso | Scope | Riesgo si se compromete | Rotación |
|---|---|---|---|---|---|---|
| **PAT del CMS** | Login de Sveltia CMS (`/admin/`) | Navegador del staff → API de GitHub | Solo quien publica contenido | Fine-grained, repo único (`atp-platform`), `Contents: Read and write` (documentado en `docs/CMS_SETUP.md`) | Alto — permite modificar cualquier archivo del repo salvo `.github/workflows/**`; como cualquier push a `main` deploya, equivale a comprometer el sitio en producción | Revocar en GitHub → generar uno nuevo → pegarlo en el login del CMS. Sin downtime. |
| **`RELEASES_PAT`** | Permite que `migrate-drive-books.yml` pushee a `main` (el `GITHUB_TOKEN` por defecto no dispara otros workflows a propósito) y gestione GitHub Releases | Secret de GitHub Actions, usado solo en ese workflow | Solo ese workflow | `NOT VERIFIABLE` — no hay documentación de qué scope tiene | Alto, mismo orden que el PAT del CMS (push a `main` = deploy) | Revocar + generar nuevo + actualizar el secret en GitHub Actions. Sin downtime. |
| **`YOUTUBE_API_KEY`** | Pedir los últimos videos del canal de YouTube en build time | Secret de GitHub Actions, `src/lib/youtube.ts`, server-only | Solo el workflow de deploy | Restringida en Google Cloud Console a solo YouTube Data API v3 | Bajo — ya acotada a una sola API | Rotar en Google Cloud Console + actualizar el secret |
| **`STAFF_CHECKIN_SECRET`** | Protege el endpoint de check-in por QR (`/staff/escanear/`) | Constante dentro del código del Apps Script — nunca en este repo | Solo staff en eventos | Un único endpoint (`action=checkin`) | Medio-bajo — requiere además un `registrationId` válido (viaja en cada QR) para hacer algo | Editar la constante en el editor de Apps Script + publicar "Nueva versión" |
| **`UNSUBSCRIBE_SECRET`** | Firma HMAC del link de "darme de baja" en cada mail | Constante dentro del código del Apps Script — nunca en este repo | Nadie necesita conocerlo, solo el script | Un único endpoint (`action=unsubscribe`) | Medio — permitiría dar de baja mails de cualquier persona a partir de su email + nombre de actividad (ambos adivinables) | Igual que arriba. **Efecto secundario:** invalida todos los links de baja ya enviados. |

**Ningún valor real de estos secretos debe aparecer nunca en este archivo, en el resto del repo, en logs, ni en ningún doc.**

---

## CI/CD

| Workflow | Dispara con | Permisos declarados | Secrets que usa | Puede modificar | NO puede modificar |
|---|---|---|---|---|---|
| `deploy.yml` | push a `main`, o manual | `contents: read`, `pages: write`, `id-token: write` | `YOUTUBE_API_KEY` | El sitio publicado (vía `actions/deploy-pages`) | El repo en sí (permiso de contents es solo lectura en este job) |
| `migrate-drive-books.yml` | push a `main` que toque `src/content/books/**.json`, o manual | `contents: write` | `RELEASES_PAT` (como `GH_TOKEN`) | Archivos de `src/content/books/*.json`, Releases de GitHub, y (indirectamente) dispara `deploy.yml` al pushear | — |

Ambos usan Actions de terceros **pineadas a un commit SHA exacto**
(`actions/checkout`, `actions/setup-python`, `actions/setup-node`,
`actions/deploy-pages`, `withastro/action`) — confirmado leyendo los
archivos.

**Punto débil verificado en `migrate-drive-books.yml`:** instala `gdown` con
`pip install gdown`, **sin versión fijada** — a diferencia de todo lo demás
en la cadena de CI de este repo. Ver Known Limitations.

**Punto débil verificado en el flujo completo (`deploy.yml` +
`migrate-drive-books.yml` + CMS):** no existe ningún paso de aprobación
humana entre "algo se pushea a `main`" y "eso sale a producción". Cualquier
credencial con `Contents: write` sobre este repo (el PAT del CMS o
`RELEASES_PAT`), si se filtra, resulta en compromiso inmediato del sitio en
producción sin que nadie lo revise antes. Es el hallazgo de mayor impacto de
toda la revisión de seguridad de este proyecto.

---

## Hosting

- **GitHub Pages** sirve el sitio estático generado por Astro (`output:
  'static'`), en un repo **público** (confirmado: `github.com/gasparbrignone/atp-platform` responde 200 sin login).
- **Cloudflare** está delante como proxy (DNS resuelve a rangos de
  Cloudflare, confirmado), agrega headers de seguridad vía una Transform
  Rule, y termina TLS.
- No hay servidor propio, base de datos propia, ni backend propio más allá
  del Apps Script.

## APIs

No hay una API REST propia. Los únicos endpoints dinámicos son:
- El Google Apps Script Web App (inscripciones, check-in, unsubscribe,
  recordatorios) — documentado íntegro en `docs/GOOGLE_SHEETS_FORM_SETUP.md`.
- Dos endpoints estáticos generados por Astro en build time
  (`/actividades-newsletter.json`, `/actividades-sessions.json`) — JSON
  público, sin datos sensibles, pensado para ser consumido por el propio
  Apps Script.

## Apps Script (el backend real)

Ver `docs/GOOGLE_SHEETS_FORM_SETUP.md` para el código completo — está
documentado a propósito, incluyendo la lógica de seguridad, porque **la
seguridad de ese script no depende de que su código sea secreto** (HMAC,
escaping y rate limiting siguen siendo válidos aunque el atacante los
conozca al detalle). Protecciones existentes: `escapeHtml` en todo campo
que llega a un mail, `signUnsubscribe` (HMAC-SHA256), `isRateLimited`/
`bumpCounter` (rate limiting best-effort, sin IP porque Apps Script no la
expone), demora progresiva en intentos fallidos de check-in.

## CMS

Sveltia CMS, `public/admin/` — sin dependencia npm, se carga desde `unpkg.com`
sin versión fijada ni SRI (**decisión consciente, no un descuido** — ver
`docs/SECURITY_DECISIONS.md`). Login con PAT de GitHub, sin OAuth App, sin
intermediario propio. Publica **directo a `main`**, sin editorial workflow.

## GitHub

- Repo público: `gasparbrignone/atp-platform`.
- Branch protection en `main`: activada, según lo reportado en sesiones
  anteriores — `NOT VERIFIABLE` la ruleset exacta desde este entorno.
- Dependabot: alerts + security updates + malware alerts + secret scanning +
  push protection + private vulnerability reporting, según lo reportado en
  sesiones anteriores — `NOT VERIFIABLE` de forma independiente desde acá.
- CodeQL: `NOT VERIFIABLE` si está activado.
- MFA en la cuenta del owner: `NOT VERIFIABLE`.

## Dependencias

- npm: lockfile (`package-lock.json`) presente y commiteado, `npm audit`
  en 0 vulnerabilidades (confirmado 2026-09-02, después de `npm audit fix`).
- GitHub Actions de terceros: pineadas a SHA exacto (confirmado, ver arriba).
- Python (`gdown`, en `migrate-drive-books.yml`): **sin versión fijada** —
  único punto de la cadena de suministro sin la misma disciplina que el
  resto. Ver Known Limitations.

## Security headers

Vía Cloudflare Transform Rule ("Response Header Transform Rule",
`All incoming requests`, `Set static`), confirmado con `curl -I` contra
producción el 2026-09-02:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), payment=(), usb=(), interest-cohort=()`
- `Content-Security-Policy: frame-ancestors 'self'`

## CSP

Configurada en `astro.config.mjs` (`security.csp`) — Astro genera una
`<meta http-equiv="content-security-policy">` distinta por página en build
time, con el hash SHA-256 exacto de cada script/estilo inline propio.
Orígenes externos permitidos explícitamente: `script.google.com` (Apps
Script — formularios + check-in JSONP), `gc.zgo.at` / `atpfcm.goatcounter.com`
(GoatCounter), `i.ytimg.com` / `youtube-nocookie.com` (YouTube).

**Limitación conocida:** `script.google.com` y `connect-src` están
permitidos como **origen completo**, no acotados al path del deployment
propio — `script.google.com` es compartido por *todos* los Apps Script Web
Apps públicos de Google, de cualquier cuenta. Hoy no hay ningún vector de
inyección que aproveche esto (confirmado en dos rondas de revisión), pero
es una barrera más ancha de lo necesario. Ver Known Limitations.

El panel `/admin/` (Sveltia CMS, `public/admin/index.html`) **no** tiene CSP
— es un archivo estático fuera del build de Astro, no le aplica la
generación automática.

## CORS

No hay configuración CORS propia — el sitio no expone ninguna API propia
que necesite CORS. El Apps Script no manda headers CORS (comportamiento por
defecto de Apps Script Web Apps), por lo que los formularios usan `fetch`
con `mode: 'no-cors'` (no pueden leer la respuesta, asumen éxito) y
`/staff/escanear/` usa JSONP en su lugar (necesita leer la respuesta).

## Authentication

- Staff/CMS: PAT de GitHub, sin sesión propia, sin cookies.
- `/staff/escanear/`: una clave compartida (`STAFF_CHECKIN_SECRET`),
  guardada en `sessionStorage` del navegador del staff — no es
  autenticación individual, es un secreto compartido pensado para
  "cualquiera que lo sepa puede tomar asistencia", no para identificar a
  la persona del staff.
- Nada más del sitio requiere login.

## Authorization

No hay roles ni niveles de usuario — todo lo público es público para
cualquiera, y las dos superficies protegidas (`/admin/`, `/staff/escanear/`)
usan un secreto compartido, no un sistema de permisos.

## Rate limiting

- Apps Script `doPost`: `isRateLimited` — máx. 5 envíos/hora por email, 40
  cada 10 min en total.
- Apps Script check-in (`doGet?action=checkin`): demora progresiva (hasta
  8s) solo en intentos con la clave incorrecta — nunca afecta un escaneo
  legítimo, sea cual sea el volumen (agregado 2026-09-02).
- No hay rate limiting del lado de Cloudflare/GitHub Pages — el sitio
  estático no lo necesita (no hay lógica que proteger ahí).

## Data exposure

- Git history completo (297+ commits) es público para siempre mientras el
  repo lo sea — incluye contenido borrado (actividades viejas, calendarios
  académicos viejos). Nada sensible identificado en lo revisado (son
  horarios de cursada, no datos de personas).
- `public/uploads/`: algunos nombres de archivo delatan que se guardaron
  directo desde resultados de un buscador (ver Known Limitations).
- El QR que va **dentro del mail** de charlas se genera vía un tercero
  (`api.qrserver.com`) — funciona como un tracker de apertura de bajo
  impacto (decisión aceptada, ver `docs/SECURITY_DECISIONS.md`).
- Ningún secreto real, API key, ni token encontrado en el bundle JS de
  producción, en source maps (no se generan), ni en el historial de git
  (verificado con búsqueda de patrones en los 297 commits).

## Known limitations (pendientes, no arreglados todavía)

1. **Sin aprobación humana entre `main` y producción** — el hallazgo de
   mayor impacto de toda la revisión. Recomendación pendiente: environment
   protection rule con "required reviewers" sobre el job `deploy`.
2. **`gdown` sin versión fijada** en `migrate-drive-books.yml`.
3. **Scope de `RELEASES_PAT` no documentado** — a diferencia del PAT del
   CMS, no hay ninguna guía de qué permisos debería tener.
4. **CSP `script-src`/`connect-src` no acotada al path exacto** del
   deployment de Apps Script propio.
5. **Nombres de archivo en `public/uploads/`** que delatan origen de
   buscador (riesgo de copyright/proceso, no de seguridad técnica).

## Accepted risks (decisiones conscientes, no descuidos)

Ver `docs/SECURITY_DECISIONS.md` para el detalle de cada una:
- Sveltia CMS cargado desde `unpkg.com` sin versión fijada ni SRI.
- Retención indefinida de DNI en el Google Sheet de charlas.
- QR de mail vía `api.qrserver.com` (tracker de apertura de bajo impacto).
- Código completo del Apps Script documentado en el repo público.
- `STAFF_CHECKIN_SECRET` actual mantenido tal cual, sin rotar (decisión del
  2026-09-02, con el rate limiting nuevo como mitigación aplicada en su
  lugar).
