# SECURITY_DECISIONS.md — Registro de decisiones de seguridad

Cada entrada documenta una decisión de seguridad real, con su motivo y el
riesgo que queda pendiente. El objetivo es que nadie (ni una futura sesión
de trabajo, ni una persona nueva en el equipo) revierta accidentalmente
una decisión ya tomada por no conocer el contexto.

No incluye valores de secretos. Fechas basadas en `git log` real cuando el
cambio tocó código; en las decisiones sin commit asociado (evaluación de
riesgo, no cambio de código) se usa la fecha de la conversación donde se
tomó.

---

### 2026-08-29 — Escapar HTML, firmar el link de baja y frenar spam en el Apps Script

**Contexto:** primera auditoría de seguridad del proyecto.

**Problema:** el Apps Script metía campos de formulario sin escapar
directamente en el HTML de los mails salientes (riesgo de que alguien
inyecte un link/botón falso con el remitente real de ATP), el link de
"darme de baja" no estaba firmado (cualquiera podía dar de baja a otra
persona sabiendo su email + el nombre de una actividad), y no había ningún
freno contra un script golpeando el endpoint en loop.

**Decisión:** agregar `escapeHtml` a todo campo antes de insertarlo en un
mail, firmar el link de baja con HMAC-SHA256 (`signUnsubscribe`), y agregar
`isRateLimited` (5/hora por email, 40/10min global) en `doPost`.

**Alternativas consideradas:** ninguna registrada — eran correcciones
directas de vulnerabilidades encontradas, sin trade-off real.

**Riesgo residual:** el rate limiting es best-effort (Apps Script no
expone IP, así que no distingue atacantes reales de tráfico legítimo
agregado) — ver decisión del 2026-09-02 sobre el endpoint de check-in,
que en su momento quedó sin este mismo freno.

**Qué NO hacer en el futuro:** no volver a interpolar un campo de
formulario directo en HTML de un mail sin pasar por `escapeHtml`.

---

### 2026-09-02 — Content-Security-Policy vía meta tag por página (Astro)

**Contexto:** ítem pendiente de la auditoría de agosto — headers de
seguridad y CSP habían quedado en pausa.

**Problema:** sin CSP, un XSS (aunque no se encontró ninguno) tendría
impacto total; sin headers básicos, exposición innecesaria a clickjacking,
sniffing de MIME type, y filtración de referrer.

**Decisión:** 4 headers vía Cloudflare Transform Rule (HSTS,
X-Content-Type-Options, Referrer-Policy, Permissions-Policy) +
`frame-ancestors` (Cloudflare, porque una `<meta>` CSP no puede setearlo) +
CSP completa vía `security.csp` de Astro (meta tag con hash automático por
página). Se movieron 3 `style="..."` inline (Hero, Sumate, filtro de
Biblioteca) a clases CSS porque una CSP sin `'unsafe-inline'` los
bloqueaba.

**Alternativas consideradas:** CSP vía header HTTP en vez de `<meta>` —
descartada porque GitHub Pages no permite headers custom por archivo, y
Cloudflare solo puede setear el mismo header fijo para todo el sitio (no
puede variar el hash por página, que es lo que necesita una CSP estricta
sin `'unsafe-inline'`).

**Motivo:** Astro calcula el hash exacto de cada script/estilo propio en
build time — permite una CSP estricta sin tener que mantenerla a mano.

**Riesgo residual:** `script-src`/`connect-src` incluyen `script.google.com`
como origen completo (no acotado al path del script propio) — ver Known
Limitations en `SECURITY.md`. El panel `/admin/` no tiene CSP (fuera del
build de Astro).

**Qué NO hacer en el futuro:** no agregar `style="..."` ni `on*="..."`
inline en ningún componente nuevo — rompe la CSP. Usar clases CSS o
`data-*` + selector en su lugar.

---

### 2026-09-02 — Sveltia CMS sin versión fijada ni SRI en `unpkg.com`

**Contexto:** tercer hallazgo evaluado como parte de la revisión de
cadena de suministro.

**Problema:** `public/admin/index.html` carga
`https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js` sin versión ni
integrity hash — si `unpkg.com` o el paquete en npm fueran comprometidos,
la próxima carga del panel ejecutaría ese código, con capacidad de
publicar contenido arbitrario en el sitio (usando la sesión/PAT de quien
esté logueado en ese momento).

**Decisión:** mantener así — **evaluado y aceptado con prioridad 30/100**.

**Alternativas consideradas:** fijar versión exacta + Subresource
Integrity — descartada por el dueño del proyecto dado el perfil de riesgo
(organización estudiantil, bajo volumen de tráfico, panel usado solo por
personal de confianza).

**Motivo:** el costo de mantenimiento (actualizar el hash SRI en cada
versión nueva de Sveltia) no se justificó frente a la probabilidad
estimada del escenario.

**Riesgo residual:** compromiso de `unpkg.com` o del paquete
`@sveltia/cms` en npm = capacidad de publicar contenido arbitrario en
`atpfcm.com.ar` sin que se note al toque. Bajo probabilidad, alto impacto
si ocurriera.

**Qué NO hacer en el futuro:** no asumir que esto está "arreglado" — es una
decisión de riesgo aceptado, no un ítem resuelto. Si el perfil de riesgo
del proyecto cambia (más tráfico, más colaboradores con acceso al CMS),
revisar esta decisión de nuevo.

---

### 2026-09-02 — Retención indefinida de DNI en el Sheet de charlas

**Contexto:** evaluación de política de datos personales.

**Decisión:** los DNI recolectados para certificados de charlas/
capacitaciones se conservan indefinidamente en el Google Sheet, sin fecha
de borrado automático.

**Motivo:** decisión del dueño del proyecto, no documentado un motivo
técnico específico más allá de la simplicidad operativa.

**Riesgo residual:** cuanto más tiempo pasa, más DNI acumulados hay para
perder si el Sheet o la cuenta de Google se comprometen — y la estructura
exacta de esas columnas está documentada públicamente en
`docs/GOOGLE_SHEETS_FORM_SETUP.md` (ver esa decisión más abajo), lo que
reduce el trabajo de reconocimiento de un atacante que ya tuviera acceso.

**Qué NO hacer en el futuro:** no asumir que "ya se decidió" significa "no
hace falta reconsiderarlo nunca" — es una decisión de negocio/legal más que
técnica, y vale la pena revisarla si crece el volumen de datos.

---

### 2026-09-02 — Código completo del Apps Script documentado en el repo público

**Contexto:** el repo `gasparbrignone/atp-platform` es público; su
documentación (`docs/GOOGLE_SHEETS_FORM_SETUP.md`) incluye el código fuente
completo del backend real del sitio (Apps Script), porque es la única forma
de que quien lo mantenga pueda volver a pegarlo en el editor de Google.

**Decisión:** mantenerlo documentado en texto plano, público, tal cual.

**Motivo:** la seguridad de ese script está diseñada para no depender de
que el código sea secreto (HMAC, escaping, rate limiting) — ocultar el
código sería seguridad por oscuridad, no seguridad real. Se verificó
explícitamente (dos rondas de revisión adversarial) que ningún mecanismo
de protección depende de que el atacante no conozca el código.

**Riesgo residual:** reduce el trabajo de reconocimiento de un atacante a
cero para encontrar la superficie de ataque exacta (qué endpoints existen,
qué parámetros aceptan) — es lo que hizo explotable el hallazgo del
check-in sin rate limit (ver próxima entrada). El código público no es el
problema; una debilidad real en ese código sí lo es.

**Qué NO hacer en el futuro:** cada vez que se agregue una acción nueva a
`doGet`/`doPost` en el Apps Script, asumir que un atacante va a leer ese
código el mismo día que se publique el commit — diseñarla ya pensando en
eso, no como una capa de seguridad futura.

---

### 2026-09-02 — Rate limiting en el check-in por QR, rediseñado dos veces

**Contexto:** la revisión adversarial encontró que `doGet?action=checkin`
no tenía ningún freno (a diferencia de `doPost`), a pesar de que Apps
Script no expone la IP de quien llama.

**Problema (primer intento):** un límite global de pedidos (`isRateLimited`
compartido por todos los escaneos) frenaba por igual un ataque de fuerza
bruta y el uso real del sistema — el dueño del proyecto reportó eventos
reales con 500+ escaneos legítimos en pocos minutos entre varios puntos de
escaneo simultáneos, volumen que ese límite habría bloqueado.

**Decisión final:** solo los intentos con la clave **incorrecta** acumulan
una demora progresiva (hasta 8s) antes de responder — un escaneo con la
clave correcta nunca la toca, sea cual sea el volumen.

**Alternativas consideradas:** (1) límite global de pedidos — descartada
por bloquear uso legítimo; (2) lockeo total tras N intentos fallidos
(bloquear incluso pedidos con la clave correcta durante una ventana) —
descartada porque abriría una vía de denegación de servicio deliberada
contra el propio check-in durante un evento real (un atacante podría
mandar intentos fallidos a propósito para trabar el check-in legítimo).

**Motivo:** Apps Script no expone IP, así que cualquier freno tiene que
ser global — la única forma de no penalizar el uso real es que el freno
solo reaccione a intentos fallidos, nunca a intentos correctos.

**Riesgo residual:** sigue siendo un freno best-effort (un atacante con
múltiples conexiones paralelas puede repartir intentos y avanzar más
rápido de lo que la demora por-conexión sugiere) — reduce la velocidad de
fuerza bruta de "ilimitada" a "significativamente más lenta", no la
elimina del todo. La clave real (`STAFF_CHECKIN_SECRET`) se evaluó como
potencialmente adivinable por patrón (organización + año + símbolo) — el
dueño del proyecto decidió **no rotarla** por ahora, confiando en este
freno como mitigación.

**Qué NO hacer en el futuro:** no volver a un límite global de pedidos
"simple" en este endpoint sin antes confirmar el volumen real de uso en
eventos — ya se intentó y hubo que revertirlo.

---

### 2026-09-02 — `api.qrserver.com` como generador del QR dentro del mail de charlas

**Contexto:** el QR que ve la persona en pantalla al inscribirse se genera
en su propio navegador (librería `qrcode`, sin salir a internet); el que
va **dentro del mail** de confirmación se pide a una API pública de
terceros (`api.qrserver.com`), porque Apps Script no tiene forma nativa de
dibujar un QR.

**Problema:** cada apertura de ese mail revela a ese tercero la IP de
quien lo abre, el instante, y el `registrationId` — un tracker de apertura
de facto, operado por un proveedor nunca evaluado formalmente.

**Decisión:** mantener así.

**Alternativas consideradas:** generar el QR sin salir a internet (adjunto
inline vía `GmailApp`) — no implementada.

**Motivo:** el dueño del proyecto evaluó el impacto como bajo, porque solo
él tiene acceso al Google Sheet que mapea `registrationId` → persona real
— sin esa planilla, el tercero no puede identificar a nadie, solo observar
un patrón de apertura sin nombre asociado.

**Riesgo residual:** sigue existiendo una señal de comportamiento (qué IP
abrió un mail de ATP y cuándo) hacia un tercero no vetted, aunque sin
nombre asociado mientras el Sheet permanezca privado.

**Qué NO hacer en el futuro:** si alguna vez se comparte acceso al Sheet
con más personas, revisar esta decisión — el supuesto "solo yo tengo
acceso" es la base de por qué se aceptó este riesgo.

---

### 2026-09-02 — SRI en el script de GoatCounter, protocol-relative URL corregida

**Contexto:** un escaneo externo (Sucuri SiteCheck) marcó el script de
analíticas (`gc.zgo.at/count.js`) por dos motivos: se cargaba con URL
protocol-relative (`src="//gc.zgo.at/..."`, sin `https://` explícito) y sin
Subresource Integrity.

**Decisión:** URL explícita `https://`, más `integrity` (SHA-384) y
`crossorigin="anonymous"`. A diferencia de Sveltia CMS (ver decisión de
arriba, sin SRI a propósito), acá sí se fijó — es un script que casi no
cambia, así que el costo de mantenimiento de actualizar el hash cuando
GoatCounter publique una versión nueva es bajo.

**Riesgo residual:** si GoatCounter actualiza `count.js`, el hash deja de
matchear y el navegador bloquea el script — las analíticas dejan de contar
hasta que alguien note la discrepancia y recalcule el hash. No afecta al
resto del sitio.

**Qué NO hacer en el futuro:** no volver a `src="//..."` protocol-relative
en ningún script nuevo — siempre `https://` explícito, y evaluar SRI caso
por caso (bajo churn del script externo → sí vale la pena, alto churn como
Sveltia → no).

---

### 2026-09-02 — Cloudflare Turnstile en los 3 formularios que postean al Apps Script

**Contexto:** preocupación concreta del dueño del proyecto — un script
automatizado podría golpear el endpoint del Apps Script y cargar cientos
de inscripciones falsas. El rate limiting existente (`isRateLimited`, 40
cada 10 min global) acota esto a horas, no lo impide.

**Decisión:** agregar el widget de Cloudflare Turnstile (modo Managed,
`data-appearance="interaction-only"`) a los 3 formularios que postean al
Apps Script (`ActivityRegistrationForm.astro`,
`ActivityCertificateRegistrationForm.astro`, `AgendaSaleSection.astro`), y
verificar el token server-side (`verifyTurnstile`, en `doPost`, antes de
cualquiera de las 3 ramas) contra la API de Cloudflare, con
`TURNSTILE_SECRET_KEY` como constante del Apps Script (mismo patrón que
`STAFF_CHECKIN_SECRET`/`UNSUBSCRIBE_SECRET` — nunca en el repo).

**Alternativas consideradas:** CAPTCHA tradicional (imágenes/checkbox
siempre visible) — descartado por el dueño del proyecto por la fricción
que agrega a usuarios reales; Turnstile en modo Managed resuelve la
mayoría de las sesiones sin ninguna interacción visible, escalando a un
desafío solo cuando el tráfico parece automatizado.

**Motivo:** cierra específicamente el escenario que preocupaba (un script
sin navegador real nunca tiene un token válido) sin agregar fricción
perceptible a la inmensa mayoría de quienes se inscriben.

**Detalle de implementación no obvio:** el widget de
`ActivityCertificateRegistrationForm.astro` se puso en el primer paso del
formulario (visible desde que carga la página), no en el paso de revisión
— ese arranca oculto con `hidden` (`display:none`), y Turnstile puede no
inicializar bien un widget sin dimensiones reales en el momento del
render.

**Riesgo residual:** el Site Key es público por diseño (va en
`src/config/site.ts`, en el HTML de cada página con un formulario) — eso
es esperado y no es un problema. La Secret Key vive únicamente en el Apps
Script. Como el resto del sistema, la protección real está en la
verificación server-side, no en que el widget "se vea" en el navegador.

**Qué NO hacer en el futuro:** no agregar un formulario nuevo que postee a
este mismo Apps Script sin el mismo widget + verificación — quedaría como
el único hueco sin cubrir.

---

### 2026-09-02 — Panel admin: contraseña + TOTP en vez de Sign In with Google

**Contexto:** pedido de un panel en el sitio, protegido con login, para
ver inscriptos y mandar campañas de mail con etiquetas tipo `<nombre>`.

**Problema:** una "contraseña" chequeada en JavaScript del navegador no
protege nada (el sitio es estático, cualquiera ve el código fuente) — la
validación real tiene que pasar por el Apps Script. La primera propuesta
fue "Iniciar sesión con Google" (aprovechar el password + 2FA que el
dueño del proyecto ya tiene en su cuenta real, sin construir nada nuevo).
El dueño del proyecto prefirió explícitamente contraseña + código de
Google Authenticator, sin depender de configurar un OAuth Client ID en
Google Cloud Console.

**Decisión:** implementar TOTP (RFC 6238, el estándar que usa Google
Authenticator) desde cero en el Apps Script, en vez de Sign In with
Google. Verificado contra los 3 vectores de prueba oficiales del RFC antes
de escribirlo (ver commit correspondiente) — no es una elección de
"probemos y vemos", el algoritmo se validó matemáticamente primero.

**Alternativas consideradas:** (1) Sign In with Google — descartada por
preferencia explícita del dueño del proyecto, no por un problema técnico:
seguía siendo la opción de menor esfuerzo/riesgo de implementación. (2)
Contraseña sola, sin segundo factor — descartada, un solo secreto
compartido es la misma clase de riesgo que `STAFF_CHECKIN_SECRET`, y acá
el dato en juego (emails de inscriptos + capacidad de mandarles mail) es
mayor. (3) Sesión propia con JWT firmados a mano — descartada a favor de
reusar `CacheService` (mismo mecanismo ya validado del rate limiting) con
un UUID como token: menos código nuevo, menos superficie para un bug de
implementación.

**Motivo:** dado que el dueño del proyecto insistió en este camino después
de entender el trade-off, se evaluó que era viable construirlo con
confianza real (no "hand-rolled crypto" arriesgado) porque: TOTP es un
estándar publicado con vectores de prueba oficiales (no un esquema
inventado), Apps Script ya tiene el primitivo HMAC necesario
(`computeHmacSha1Signature`, la misma familia de función que
`signUnsubscribe` ya usa con éxito), y la sesión reusa `CacheService` en
vez de un esquema de tokens propio.

**Verificación antes de producción:** el algoritmo TOTP se probó contra
los 3 vectores oficiales del RFC 6238 en Node antes de escribirlo en Apps
Script. Toda la lógica del panel (login con contraseña/código correctos e
incorrectos, listar actividades desde ambos tipos de hoja, listar
inscriptos, armar y mandar una campaña con etiquetas, reenvío de un
`campaignId` ya usado, logout) se simuló end-to-end en Node con mocks de
`CacheService`/`SpreadsheetApp`/`GmailApp`/`Utilities`/`ScriptApp` antes de
pedirle al dueño del proyecto que lo probara en producción — encontró y
corrigió un bug real en el camino (ver más abajo).

**Riesgo residual:** el freno de fuerza bruta del login (progresivo,
mismo patrón que el check-in) es best-effort — Apps Script no expone IP,
así que es un freno global, no por atacante. `ADMIN_TOTP_SECRET` vive en
dos lugares (el script y el celular del dueño del proyecto) en vez de uno
solo, a diferencia de todos los demás secretos de este proyecto — mayor
superficie que "un solo lugar", aunque ambos bajo control exclusivo del
dueño.

**Qué NO hacer en el futuro:** no agregar una acción nueva al panel sin
pasar por `isValidAdminSession` primero — es el único punto de control de
acceso de todo `/staff/panel/`, tan importante como el check de Turnstile
en los formularios públicos.

---

### 2026-09-02 — Bug encontrado en pruebas: etiqueta sin reemplazar podía desaparecer del mail

**Contexto:** al simular `applyTemplateTags` (panel admin, arriba) con una
etiqueta sin dato correspondiente (ej. `<inventada>`, sin columna en la
hoja), la primera versión dejaba el texto crudo tal cual, sin escapar.

**Problema:** el cuerpo del mail es HTML — una etiqueta sin escapar como
`<inventada>` no se ve como "texto de aviso de error" para quien lee el
mail, el cliente de correo la interpreta como una etiqueta HTML
desconocida y la esconde por completo. La intención original ("que se
note el error en vez de desaparecer en silencio") fallaba en la práctica
exactamente al revés.

**Decisión:** `escapeHtml` se aplica también al caso "sin reemplazar", no
solo al valor real interpolado — así `<inventada>` llega a la bandeja de
entrada como texto literal visible, no como una etiqueta HTML tragada.

**Motivo:** se encontró simulando el envío completo en Node antes de que
el dueño del proyecto lo probara en producción — el mismo tipo de bug que
ya había costado varias rondas de debugging en vivo con Turnstine/CSP.

**Qué NO hacer en el futuro:** cualquier función que interpole texto
dentro de HTML (no solo `applyTemplateTags`) tiene que escapar **todos**
sus caminos de salida, incluido el de "no hay dato, dejo el original" —
"dejar tal cual" en un contexto HTML nunca es neutral.

---

### 2026-09-02 — Blast radius: ninguna aprobación humana entre `main` y producción

**Contexto:** revisión de blast radius de credenciales (PAT del CMS,
`RELEASES_PAT`).

**Problema:** el PAT del CMS está bien scopeado (fine-grained, un repo,
solo `Contents: Read and write`, sin permiso `Workflows`) — pero confirmado
que **ese scope solo, sin nada más**, ya es suficiente para comprometer
producción completa: cualquier push a `main` dispara el deploy automático,
sin ningún paso de revisión humana en el medio.

**Decisión:** identificado y documentado, **implementación pendiente**
(no se activó todavía una environment protection rule con aprobación
manual sobre el job `deploy`).

**Alternativas consideradas:** exigir Pull Request antes de mergear a
`main` (`editorial_workflow` en Sveltia) — descartada por el dueño del
proyecto por la fricción que agregaría al flujo diario de carga de
contenido. Environment protection rule (aprobación manual solo en el paso
de deploy, no en cada commit) — evaluada como la de mejor relación
seguridad/fricción, **pendiente de implementar**.

**Riesgo residual:** hoy, "PAT del CMS filtrado" = "sitio comprometido de
inmediato", sin ninguna barrera intermedia.

**Qué NO hacer en el futuro:** no asumir que el scope acotado del PAT
("solo puede tocar este repo, solo contenido") limita el blast radius real
— en esta arquitectura, no lo hace, porque el mecanismo de deploy no
distingue "contenido" de "código".
