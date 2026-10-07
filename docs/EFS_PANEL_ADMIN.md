# Panel de inscripciones del EFS — plan y estado

Fuente de verdad de este trabajo (reemplaza la conversación donde se decidió).
Ver también `EFS_2026_PLAN.md` (el sistema de pago/evento en sí, ya en producción).

## Qué es

Un panel en `efsarg.com.ar/panel/` (repo `EFS`, carpeta `panel/`) para hacer desde
el navegador lo que hasta ahora se hacía a mano en el editor de Apps Script:
ver quién se inscribió, buscar a alguien puntual, reenviar una entrada.

**No es** `efsarg.com.ar/admin/` — esa ruta ya existía (redirección a Pages CMS
para editar contenido del sitio, ver `INSTRUCTIVO.md` del repo EFS). No tocar.

## Por qué está dividido en etapas

Maneja datos de pago y datos personales de gente real. Prioridad: no romper
nada. Cada etapa se construye, se prueba en producción con cuidado (entradas
`EFS26-TEST0001..5`, nunca gente real salvo que se confirme), y se audita
antes de pasar a la siguiente.

## Etapa 1 — Ver, buscar, reenviar (HECHA, en producción)

Construida el 2026-10-07. Usa acciones de backend que ya existían
(`admin_resumen`, `admin_buscar`, `admin_reenviar` — ver `apps-script/EFS.gs`
y `cloudflare/efs-worker/src/index.ts`, función `admin()`). Login: misma
contraseña + Google Authenticator que `/staff/panel/` de ATP.

Archivos: `EFS/panel/index.html`, `EFS/panel/panel.css`, `EFS/panel/panel.js`.

### Auditoría de seguridad (2026-10-07)

Se hizo una auditoría estricta (dos pasadas: Claude + revisión cruzada con
ChatGPT) del panel, el Worker, `EFS.gs` y el login compartido de ATP.
Veredicto: **aceptable con riesgos** — el núcleo de pagos está bien
construido (webhook de Mercado Pago con firma HMAC + ventana anti-replay de
5 min en `index.ts`, procesamiento de pagos genuinamente idempotente en
`efsAplicarPago_`). Los riesgos reales estaban todos en la superficie admin,
nueva de esta etapa.

**Corregido ya (commits `9043cad` en repo EFS, `472a1b8` en `web atp` rama
`efs-2026`):**
- `admin_reenviar` no era idempotente (doble clic o dos pedidos a la vez
  mandaban dos mails reales) → `efsReenvioReciente_()` en `EFS.gs`, 60s de
  ventana con `CacheService`, mismo patrón que `efsAvisar_`.
- El panel ofrecía "Recordarme 30 días" (token en `localStorage`) → sacado;
  solo queda la sesión normal de unas horas (`sessionStorage`).
- La tabla de entradas mostraba DNI y mail completos de las 131+ personas de
  un vistazo → ahora enmascarados (`36****53`, `gi***@gmail.com`); se ven
  completos solo al buscar a alguien puntual en "Buscar pago".
- Login sin timeout ni feedback claro cuando Apps Script está lento (se
  observó hasta ~29s bajo tráfico real, por el barrido automático
  `efsBarrido` corriendo en paralelo) → ahora avisa "puede tardar hasta 30s"
  en vez de quedarse pegado sin explicación.

**Decidido explícitamente, diferido (2026-10-07):** el panel sigue usando la
identidad admin COMPARTIDA con el resto de ATP (campañas, certificados) —
`isValidAdminSession()` en `apps-script-completo.js`. Si se filtra esa
contraseña+TOTP, el radio de daño es toda la plataforma, no solo el EFS. La
alternativa (contraseña + TOTP separados solo para el EFS) está evaluada y
lista para implementar, pero el dueño eligió dejarla para más adelante, no
ahora. **Retomar esto antes de dar acceso al panel a una segunda persona.**

**Quedó para más adelante, no bloqueante:**
- Mover el login detrás del Worker (en vez de JSONP directo a Apps Script) —
  permitiría rate-limit por IP real en el login (hoy Apps Script no ve la
  IP del cliente) y achicaría la política de seguridad del sitio
  (`script-src`) sacando `script.google.com`/`script.googleusercontent.com`.
  No es urgente: el login ya tiene 2FA real.
- Rate limiting del Worker es por instancia/ubicación de Cloudflare, no
  global de verdad (`frenado()` en `index.ts`) — solo importa si un token ya
  se filtró.

**Aviso para auditorías futuras:** `C:\Users\gaspar\Desktop\ATP\apps-script-completo.js`
(copia local fuera del repo, con secretos reales) puede estar desactualizada
respecto del script realmente pegado en producción — el propio archivo lo
advierte en su encabezado. No asumir que coincide sin confirmar con el
dueño.

## Etapa 2 — Cargar cortesías y transferencias desde el panel (NO EMPEZADA)

Hoy se hace editando a mano la hoja "EFS · Transferencias" y corriendo
`efsProcesarTransferencias()` desde el editor. Requiere una acción nueva de
backend (no existe todavía ningún `admin_*` para esto). Antes de arrancar:
ronda de preguntas con el dueño (qué datos pide el panel, si hace falta
aprobar/confirmar antes de emitir, etc.), siguiendo el mismo proceso que la
Etapa 1.

## Etapa 3 — Corregir datos de una entrada ya emitida (NO EMPEZADA)

Lo que se hizo a mano al principio de esta conversación (alguien escribió
mal el mail, había que corregirlo y reenviar). Requiere una acción nueva de
backend con validaciones (mismo formato que `efsValidarDatos_`). Como ya
quedó identificado en la auditoría de la Etapa 1: cuando esto exista, la
corrección de idempotencia de `admin_reenviar` (ya hecha) importa más,
porque "corregir mail + reenviar" van a ser parte del mismo flujo.

## Etapa 4 (opcional) — Reconciliar pagos sueltos desde el panel

Backend ya existe (`admin_procesar`, `admin_conciliar`), falta pantalla.

## Etapa 5 (opcional) — Certificados

`/staff/certificados/` (el sistema general de ATP) ya funciona para "EFS
2026" sin cambios, porque la hoja respeta el formato "hoja charla". Evaluar
si alcanza con eso o si hace falta algo específico del EFS.
