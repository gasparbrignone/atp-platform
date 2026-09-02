# SECURITY_CHECKLIST.md

Checklist para usar antes de dar por terminado un cambio no trivial
(nueva funcionalidad, nueva dependencia, nueva ruta/endpoint, cambio de
CI/CD, cambio de CMS, cambio de deployment). No hace falta pasarlo por
cambios puramente visuales/de estilo sin nuevos datos, endpoints ni
dependencias.

Adaptado a la arquitectura real de este proyecto — no es un checklist
genérico. Ver `SECURITY.md` para el contexto de cada ítem.

- [ ] **Secretos**: ¿el cambio introduce un secreto nuevo (API key, token,
  contraseña)? Si sí — nunca en el código del cliente, nunca commiteado,
  documentado en `SECURITY.md` (sin el valor) y en
  `docs/SECURITY_DECISIONS.md` si implica una decisión de scope/rotación.
- [ ] **Datos sensibles**: ¿el cambio expone al navegador algo que antes
  no llegaba ahí (JSON endpoint nuevo, campo nuevo en una respuesta,
  variable de entorno sin prefijo server-only)? Recordar: `import.meta.env`
  sin prefijo definido como público llega al bundle del cliente en Astro —
  confirmar que cualquier variable nueva sea intencional si es pública.
- [ ] **Cliente no confiable**: si el cambio toca el Apps Script, ¿toda
  validación importante (quién puede hacer qué, qué datos se aceptan) pasa
  server-side (en el propio script), no solo en el formulario del
  navegador?
- [ ] **Autorización server-side**: si el cambio agrega una acción nueva a
  `doGet`/`doPost` del Apps Script, ¿tiene el mismo nivel de protección que
  las existentes (rate limiting, validación de parámetros) o menos?
  (Precedente real: `action=checkin` se agregó sin el mismo freno que
  `doPost` tenía — no repetir ese patrón.)
- [ ] **Validación de inputs**: todo campo que un formulario manda al
  Apps Script, ¿pasa por `escapeHtml` antes de terminar en un mail? ¿Por
  `isSafeUrl` si termina como `href`?
- [ ] **Dependencias revisadas**: si se agregó una dependencia npm nueva —
  ¿hace falta de verdad, o unas pocas líneas propias evitan sumarla? ¿Tiene
  mantenimiento activo? ¿El lockfile quedó commiteado?
- [ ] **CI/CD revisado**: si se tocó algo en `.github/workflows/`, ¿los
  permisos (`permissions:`) siguen siendo los mínimos necesarios? ¿Cualquier
  Action de terceros nueva está pineada a un SHA exacto, no a un tag
  mutable? ¿Cualquier `pip install`/`npm install -g` nuevo tiene versión
  fijada? (Precedente real: `gdown` en `migrate-drive-books.yml` no la
  tiene — no repetir ese patrón en workflows nuevos.)
- [ ] **CSP revisada**: si se agregó una llamada a un servicio externo
  nuevo (script, fetch, iframe, imagen), ¿está agregado el origen
  correspondiente en `security.csp` de `astro.config.mjs`? ¿Se acotó al
  path específico cuando el servicio lo permite (no solo al host)?
- [ ] **Headers revisados**: si el cambio afecta cómo se sirve el sitio
  (nuevo tipo de archivo, nueva ruta pública), ¿sigue siendo coherente con
  los headers ya configurados en Cloudflare?
- [ ] **Integraciones de terceros revisadas**: cualquier servicio externo
  nuevo (analytics, CDN, API pública) — ¿es realmente necesario? ¿Qué
  información suya recibe (IP, comportamiento, datos)? Documentar en
  `SECURITY.md` si queda integrado.
- [ ] **Superficie de ataque**: ¿el cambio agrega una ruta/endpoint nuevo
  sin autenticación? Si sí, ¿está diseñado asumiendo que un atacante va a
  encontrarlo (porque el repo es público) desde el primer día?
- [ ] **Blast radius**: si el cambio agrega o modifica una credencial
  (token, secret), ¿qué pasa si se filtra mañana? ¿El scope es el mínimo
  posible? Si otorga `Contents: write` sobre este repo, recordar que eso
  equivale hoy a "puede deployar a producción sin revisión" — ver
  `SECURITY.md` → Known Limitations.
- [ ] **Regresión de seguridad**: si el cambio toca código relacionado con
  un hallazgo histórico (ver `docs/SECURITY_DECISIONS.md`), ¿se está
  reintroduciendo el mismo problema de otra forma?
