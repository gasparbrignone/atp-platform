# SECURITY_CHANGELOG.md

Registro cronológico de cambios con impacto de seguridad. No incluye
secretos. Para el *por qué* de cada decisión importante, ver
`docs/SECURITY_DECISIONS.md`. Fechas tomadas de `git log` cuando hubo
commit asociado.

Si una sesión de trabajo hace un cambio de código sin impacto de seguridad
relevante, no se agrega entrada acá — no queremos ruido.

---

## 2026-09-02

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
