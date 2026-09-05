# SECURITY_CHANGELOG.md

Registro cronológico de cambios con impacto de seguridad. No incluye
secretos. Para el *por qué* de cada decisión importante, ver
`docs/SECURITY_DECISIONS.md`. Fechas tomadas de `git log` cuando hubo
commit asociado.

Si una sesión de trabajo hace un cambio de código sin impacto de seguridad
relevante, no se agrega entrada acá — no queremos ruido.

---

## 2026-09-05 (continuación — primer despliegue real)

- **fix:** `generateTotp` llamaba a `Utilities.computeHmacSha1Signature`,
  que no existe en Apps Script (solo existe `computeHmacSha256Signature`
  y el genérico `computeHmacSignature`) — el login del panel rechazaba
  cualquier contraseña/código, siempre, desde que se implementó. Efecto
  "fail-closed" (nunca dejó entrar a nadie, ni siquiera con credenciales
  correctas), sin impacto de seguridad, pero sí de disponibilidad.
  Detectado recién en el primer despliegue real con secretos verdaderos —
  ninguna simulación anterior en Node lo encontró porque el propio mock
  de `Utilities` repetía el mismo nombre inexistente. Corregido a
  `Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, ...)`.
  Ver decisión completa en `SECURITY_DECISIONS.md`.

## 2026-09-05

- **fix (CRITICAL):** el panel admin nunca llegó a desplegarse con
  secretos reales — antes de ese primer despliegue, una revisión
  adversarial completa (código real leído línea por línea, no el informe
  de quien lo implementó) encontró que contraseña y código TOTP viajaban
  como parámetros de una URL GET (obligado por JSONP). Rediseñado: el
  login ahora es `adminLoginAttempt` (POST, nunca URL) +
  `adminLoginPoll` (GET/JSONP, retira el resultado bajo un `loginId` de
  un solo uso). El token de sesión sigue viajando en la URL de las
  acciones posteriores al login — decisión consciente, riesgo mucho
  menor que el de la contraseña/TOTP. Ver decisión en
  `SECURITY_DECISIONS.md`.
- **fix (HIGH):** `adminListRegistrations`/`adminStageCampaign` no
  validaban el `sheetName` que mandaba el cliente — la exclusión de
  "Errores"/Agenda del dropdown era solo cosmética. Agregado
  `getEligibleActivitySheet` como único punto de acceso a una hoja desde
  el panel; la Reserva de Agenda queda bloqueada de forma permanente
  (sus mails no tienen link de baja).
- **fix (MEDIUM):** el "un solo uso" del `campaignId` (leer + borrar del
  cache) no era atómico — agregado `LockService.getScriptLock()`
  alrededor de esa sección para que dos pedidos casi simultáneos no
  puedan mandar la misma campaña dos veces.
- **feat:** vista previa obligatoria antes de poder mandar una campaña
  (`adminPreviewCampaign`, no destructiva) — arma el asunto y el cuerpo
  exactos que van a salir con los datos reales de una persona activa de
  esa hoja; cualquier cambio después de previsualizar invalida esa vista
  previa y vuelve a exigir una nueva antes de habilitar el envío.
- **feat:** registro de campañas realmente enviadas (pestaña nueva
  "Campañas enviadas": fecha, hoja, asunto, enviados, total) — permite
  confirmar si un envío salió antes de reintentar a ciegas tras un error
  de red.
- Toda la lógica (login correcto/incorrecto, freno de fuerza bruta,
  allowlist de hojas, vista previa con escapado, envío real, un solo uso
  del campaignId con el candado, logout) se simuló end-to-end en Node
  (31 chequeos) antes de tocar el editor de Apps Script real. Ver
  decisión completa en `SECURITY_DECISIONS.md`.

## 2026-09-02

- **feat:** panel admin nuevo (`/staff/panel/`, más `/staff/index.astro`
  como hub de herramientas de staff) — login con contraseña + código TOTP
  de Google Authenticator (RFC 6238, implementado y verificado contra los
  3 vectores de prueba oficiales del estándar), ver inscriptos por
  actividad, mandar campañas de mail con etiquetas `<nombre>`/
  `<apellido>`/`<email>`. Toda la lógica del Apps Script se probó
  end-to-end en Node (mocks de las APIs de Google) antes de pedirle al
  dueño del proyecto que la probara en producción — encontró y corrigió un
  bug real de escaping en el camino. Ver decisiones en
  `SECURITY_DECISIONS.md`. Nuevo helper compartido `src/lib/jsonp.ts`
  (`/staff/escanear/` se refactorizó para usarlo también, sin duplicar la
  lógica).
- **fix:** `/staff/**` excluido también de `sitemap.xml` (antes solo de
  `robots.txt`) — ese archivo público listaba esas URLs igual, aunque los
  crawlers tuvieran la orden de no seguirlas.
- **Verificado end-to-end en producción:** inscripción real → Turnstile →
  guardado en el Sheet → QR en pantalla, todo funcionando. En el camino se
  encontraron y corrigieron 3 problemas más (redirect de Apps Script,
  `data:` en img-src para el QR, logging de Turnstile sin detalle) — los 4
  hallazgos de esta sesión de pruebas quedan abajo.
- **fix:** CSP `connect-src`/`script-src` bloqueaba la redirección interna
  de Google (`script.google.com` → `script.googleusercontent.com`, la
  misma para cualquier respuesta del Apps Script) — los 3 formularios
  guardaban la fila igual del lado del servidor pero mostraban "No pudimos
  enviar la inscripción" del lado del cliente. Se agregó
  `script.googleusercontent.com` a ambas directivas, más
  `static.cloudflareinsights.com` (script propio de Turnstile) a
  `script-src`. Encontrado en la primera prueba real después de publicar
  Turnstile.
- **fix:** `public/sw.js` devolvía `undefined` en vez de una `Response`
  cuando un pedido no estaba en caché y además fallaba la red — encontrado
  de paso mientras se investigaba el bug de arriba (no era la causa, pero
  era un bug real e independiente).
- **feat:** agregado Cloudflare Turnstile (anti-bot) a los 3 formularios
  que postean al Apps Script (inscripción simple, charla con certificado,
  agenda) — widget en modo Managed del lado del cliente
  (`src/lib/turnstile.ts`), verificación real del token del lado del
  servidor (`verifyTurnstile` en el Apps Script, antes de cualquier rama de
  `doPost`). CSP actualizada para permitir `challenges.cloudflare.com`. Ver
  decisión en `SECURITY_DECISIONS.md`.
- **fix:** script de GoatCounter (`gc.zgo.at/count.js`) pasado de URL
  protocol-relative a `https://` explícito, con SRI (`integrity` SHA-384) —
  hallazgo de un escaneo externo (Sucuri SiteCheck). Ver decisión en
  `SECURITY_DECISIONS.md`.
- **fix:** rediseñado el rate limiting del check-in por QR — de un límite
  global de pedidos (bloqueaba uso legítimo con muchos escaneos simultáneos)
  a una demora progresiva solo en intentos con clave incorrecta. Commits
  `8be2e0f`, `cd1e8a8`. Ver decisión en `SECURITY_DECISIONS.md`.
- **fix:** resueltas 8 vulnerabilidades reportadas por `npm audit`
  (astro, postcss, nanoid, brace-expansion, browserslist, fast-uri,
  js-yaml, svgo) — todas dentro de los rangos ya declarados en
  `package.json`, sin bump de versión mayor. Commit `0e270c8`.
- **feat:** agregada Content-Security-Policy vía `<meta>` por página
  (Astro `security.csp`), más 3 headers nuevos vía Cloudflare (HSTS,
  X-Content-Type-Options, Referrer-Policy, Permissions-Policy) y
  `Content-Security-Policy: frame-ancestors 'self'`. Se movieron 3
  `style="..."` inline a clases CSS por incompatibilidad con CSP sin
  `'unsafe-inline'`. Commit `720f656`. Ver decisión en
  `SECURITY_DECISIONS.md`.
- **hallazgo (sin cambio de código):** `script-src`/`connect-src` de la
  CSP permiten `script.google.com` como origen completo, no acotado al
  path del Apps Script propio — riesgo bajo hoy (no hay vector de
  inyección conocido), documentado como Known Limitation en `SECURITY.md`.
- **hallazgo (sin cambio de código):** `pip install gdown` en
  `migrate-drive-books.yml` sin versión fijada — único punto de la cadena
  de CI sin la misma disciplina de pinning que el resto. Pendiente de
  corregir.
- **hallazgo (sin cambio de código):** scope de `RELEASES_PAT` no
  documentado en ningún doc del repo, a diferencia del PAT del CMS.
  Pendiente de documentar y, potencialmente, recrear con scope mínimo.
- **hallazgo (sin cambio de código):** ninguna aprobación humana existe
  entre un push a `main` y el deploy a producción — cualquier credencial
  con `Contents: write` sobre este repo, filtrada, resulta en compromiso
  inmediato del sitio. Es el hallazgo de mayor impacto identificado hasta
  ahora. Pendiente de mitigar (recomendación: environment protection rule
  con aprobación manual en el job `deploy`).
- Establecido el sistema de gobernanza de seguridad permanente:
  `SECURITY.md`, `docs/SECURITY_DECISIONS.md`, este changelog, y
  `docs/SECURITY_CHECKLIST.md`.

## 2026-08-29

- **fix:** el Apps Script escapa HTML en todo campo de formulario antes de
  insertarlo en un mail (`escapeHtml`), firma el link de "darme de baja"
  con HMAC-SHA256 (`signUnsubscribe`), y agrega rate limiting básico en
  `doPost` (`isRateLimited`, 5/hora por email, 40/10min global). Commit
  `e730854`. Ver decisión en `SECURITY_DECISIONS.md`.
- **fix:** actualizado el mail de contacto público. Commit `3bff7e2`.

## Sesión previa (fecha exacta de la conversación original no registrada en commits — reportada por el dueño del proyecto)

Auditoría de seguridad inicial. Resuelto en esa sesión, según lo reportado:
rate limiting básico, protección de rama en `main`, Dependabot completo
(alerts + security updates + malware alerts + secret scanning + push
protection + private vulnerability reporting), robots.txt actualizado,
`YOUTUBE_API_KEY` restringida en Google Cloud Console a solo YouTube Data
API v3, GitHub Actions de terceros pineadas a commit SHA exacto, shadcn
actualizado. Decisiones tomadas en esa sesión y mantenidas desde entonces:
SRI de Sveltia CMS sin fijar (30/100 de prioridad), retención indefinida
de DNI. **Nota:** los commits de robots.txt (`d8dad84`), pin de Actions
(`9072129`) y update de shadcn (`effe224`) aparecen en `git log` con fecha
`2026-09-02` — puede haber una diferencia entre cuándo se hizo el trabajo
de auditoría y cuándo se commiteó; se prioriza acá lo que dice `git log`
como fuente verificable.
