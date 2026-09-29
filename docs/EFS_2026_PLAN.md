# EFS 2026 · Plan técnico (v2, post auditoría)
## Inscripción paga con Mercado Pago, entrada con QR, acreditación instantánea, credenciales y talleres

**Versión:** 2.0 · **Fecha:** 29/09/2026
**Estado:** nada desarrollado todavía. Esta versión incorpora tres auditorías externas (ChatGPT, Gemini, Claude), una verificación del código real y las decisiones del dueño del proyecto.
**Autor del plan:** Claude (asistente de desarrollo). **Dueño del proyecto:** el administrador de ATP, que no es programador.

> **Para quien audita (segunda ronda):** el documento es autocontenido. §0.1 resume qué cambió respecto de v1 y por qué; §0.2 lista las recomendaciones que no se adoptaron y su motivo. Por seguridad, no incluye claves, tokens ni URLs privadas.

---

## Índice

0. Resumen ejecutivo, cambios v1 → v2 y decisiones tomadas
1. Contexto, restricciones y objetivos
2. Sistema existente (detalle técnico)
3. Requisitos
4. Arquitectura
5. Modelo de datos
6. Reglas que el sistema nunca rompe (invariantes)
7. Flujos paso a paso
8. Matriz de escenarios y fallas
9. Acreditación: velocidad, cola física y modos de falla
10. Aislamiento: no romper lo existente
11. Seguridad y datos personales
12. Plan de pruebas
13. Despliegue, congelamiento y vuelta atrás
14. Etapas y cronograma
15. Decisiones pendientes
16. Preguntas para una segunda ronda de auditoría
17. Apéndices

---

## 0. Resumen ejecutivo

**El evento:** EFS (Encuentro de Formación en Salud), sábado 17/10/2026 de 8 a 18 h, en la Facultad de Ciencias Médicas de la UNR (Rosario).
- Unos 300 asistentes esperados, **sin tope de inscripción**.
- $5.000 ARS por persona, cobrados con Mercado Pago (Checkout Pro) en la cuenta personal del organizador.
- **Sin pago en efectivo.**

**Base técnica:** se reutiliza la plataforma existente de la organización: sitio estático, Google Apps Script sobre Google Sheets y un Worker de Cloudflare. Sobre esa base se agrega:

1. Un **Worker del EFS** como única puerta pública:
   - inscripción;
   - avisos de pago de Mercado Pago;
   - verificación al volver del pago;
   - staff y panel.

   El Worker habla con Apps Script de servidor a servidor.
2. **La entrada (QR) se emite solo con el pago aprobado y verificado** contra la API de Mercado Pago. Llega por tres vías: la página de retorno, el mail con la imagen adjunta y un link de respaldo.
3. **Acreditación instantánea:**
   - los celulares del staff validan contra una lista descargada;
   - un Durable Object mantiene el estado en vivo y la deduplicación entre puestos;
   - la planilla se actualiza por lotes.
4. **Credenciales impresas con QR** y asignación del taller en la misma mesa de acreditación. El cupo por taller se controla online y hay un respaldo en papel.
5. **Desarrollo por etapas:** primero pago + entrada + acreditación; después talleres; al final, lo accesorio.

### 0.1 Cambios v1 → v2

| # | Cambio | Origen | Motivo |
|---|---|---|---|
| 1 | El formulario ya no hace POST directo al Apps Script para redirigir a Mercado Pago: pasa por el Worker del EFS | Auditoría de Claude | Una página de HtmlService no puede redirigir la ventana principal: el sandbox no incluye `allow-top-navigation`, y además se sirve desde un dominio de Google con aviso de "creado por un usuario". El Worker permite además un freno por IP, reintentos y errores dentro del formulario |
| 2 | Mails del EFS por GmailApp desde la cuenta de Workspace; Resend solo como desborde | Las tres auditorías + decisión del dueño | Resend gratis: 100 mails/día. Workspace: 1.500/día. **Bloqueante:** confirmar que el script corre bajo Workspace |
| 3 | QR disponible sin depender del mail: página de retorno + imagen adjunta (CID) + link `efsarg.com.ar/entrada/#CODIGO` | Claude | "Nadie que pagó se queda sin QR" no puede depender de un solo canal. Gmail no muestra imágenes `data:` |
| 4 | Validación estricta del pago: `approved`, `transaction_amount == precio` (bruto, exacto), `currency_id = ARS`, `collector_id` propio, `live_mode = true`, `operation_type = regular_payment`, referencia existente | Las tres | v1 decía "≥" y confundía el bruto con el neto |
| 5 | Un pago sin inscripción asociada **no** genera entrada: es una anomalía y se resuelve a mano | ChatGPT | Evita convertir un error contable en una entrada válida |
| 6 | El candado cubre solo la sección crítica (buscar DNI, escribir, `flush`), nunca las llamadas a Mercado Pago ni el mail. Se usa `getDocumentLock()`, no `getScriptLock()` | ChatGPT, Gemini, Claude + verificación | El código existente usa `getScriptLock()` en el envío de campañas y de certificados; un candado distinto evita competir con ellos |
| 7 | El QR pasa a ser un código aleatorio (`EFS26-` + 8 caracteres base32), sin firma HMAC | Las tres | El celular valida por pertenencia a la lista, no por firma; v1 se contradecía y la firma de 4 caracteres era débil |
| 8 | La asignación de taller con cupo es **solo online**. Sin red: taller "pendiente" + planilla de papel por taller | ChatGPT | Dos celulares sin red podrían dar el mismo último lugar |
| 9 | Webhook: el Worker responde 200 y reenvía en segundo plano; la red de seguridad es el barrido cada 10 min, no reintentos complejos | Claude (sobre ChatGPT y Gemini) | Más simple; el barrido ya garantiza la detección |
| 10 | Autenticación Worker → Apps Script con un secreto propio, distinto de la clave de staff | ChatGPT | El Web App es público |
| 11 | Sincronización del Durable Object a la planilla **por lotes** cada 30–60 s, con un id por operación | Claude + ChatGPT | 300 llamadas sueltas chocan con el límite de ejecuciones simultáneas; los ids hacen seguros los reintentos |
| 12 | Protección contra fórmulas en la planilla: todo texto del usuario se guarda como texto | ChatGPT | Un nombre `=HYPERLINK(...)` se ejecutaría como fórmula |
| 13 | Aviso de privacidad en el formulario; los celulares guardan solo nombre + últimos 3 dígitos del DNI | ChatGPT + Claude | Ley 25.326 y minimización de datos |
| 14 | Sin cupo total ni reservas de 30 min | Decisión del dueño (sin tope) | Desaparecen P11, la contradicción 30 min/72 h y el ataque de reservas masivas |
| 15 | Sin efectivo (`excluded_payment_types: ticket`) | Las tres + decisión del dueño | El efectivo tarda días en acreditarse |
| 16 | La preferencia vence al cierre de la inscripción, y se da por vencida en cuanto se emite la entrada | Claude + ChatGPT | Evita pagos después del cierre y pagos dobles sobre el mismo link |
| 17 | La búsqueda de pagos es por rango de fechas y paginada, filtrando `EFSP-` en el código (o por `external_reference` exacto) | ChatGPT + Claude | La API no busca por prefijo |
| 18 | Invariantes explícitas (§6) y modos de falla del día del evento (§9.4) | ChatGPT | Hacen verificable el diseño |
| 19 | Mesa de problemas separada de los puestos de escaneo; talleres publicados de antemano para que la gente llegue decidida | Gemini + Claude | Elegir taller en la mesa puede llevar de 30 a 60 s por persona |
| 20 | Pausa entre lecturas **por código** (3 s), no global de 2,5 s; evaluar `qr-scanner` (Nimiq) contra jsQR | Claude | El siguiente QR se lee al instante |
| 21 | Objetivos de tiempo separados por operación, medidos en P50/P95/P99 | ChatGPT | El promedio esconde los peores casos |
| 22 | Por etapas: Nivel 1 (abrir la inscripción), Nivel 2 (evento), Nivel 3 (opcional) | Las tres | 18 días para una sola persona |
| 23 | La revocación usa una columna propia, `EstadoEntrada`, y no `Dado de baja` | Verificación del código | `Dado de baja` es la baja de mails; mezclar significados rompe campañas y recordatorios |
| 24 | Reglas de forma para las hojas nuevas (§10.2) | Verificación del código | `sendReminders` recorre **todas** las hojas por posición de columna, y el panel lista cualquier hoja con columna `Email` |
| 25 | Frases menos absolutas: prometemos detección y recuperación, no infalibilidad | ChatGPT | Honestidad técnica |

### 0.2 Recomendaciones no adoptadas

| Recomendación | De | Motivo |
|---|---|---|
| Guardar el webhook en el Durable Object antes de responder 200, con reintentos exponenciales | ChatGPT | El barrido cada 10 min ya garantiza la detección (ver §4, D4). Se evita complejidad en la etapa más apurada |
| HMAC truncado a 4 bytes en el QR | Gemini | Si se valida por pertenencia a la lista, la firma no agrega nada; un código aleatorio de 40 bits alcanza |
| Firma Ed25519 | Consultada en v1 | Solo serviría para aceptar entradas fuera de la lista, pero la revocación igual exige la lista. Descartada |
| QR en el mail como `data:` base64 | Gemini | Gmail no la muestra. Se usa CID |
| Control de cupo con CacheService como semáforo | Gemini | No es atómico. Además ya no hay cupo total |
| Elegir el taller al inscribirse o en una mesa separada | Gemini, Claude | El dueño decidió mantenerlo en la mesa de acreditación. Se mitiga (§9.3), y la app permite pasar a mesa separada el mismo día sin cambiar código |
| Cola previa formal antes del Apps Script | ChatGPT (pregunta de v1) | El Worker reintenta ante saturación; con 300 personas no hace falta |

### 0.3 Decisiones ya tomadas por el dueño

- Talleres: se eligen **en la mesa de acreditación**, como estaba previsto.
- **Sin efectivo.**
- Mails: **GmailApp de Workspace**. Cuenta confirmada: la de Workspace de la organización, dueña de la planilla y del script.
- **Sin tope** de inscriptos.
- La clave del escáner de staff de la plataforma **no se cambia**. El EFS usa una clave propia.

---

## 1. Contexto, restricciones y objetivos

### 1.1 Objetivos del negocio

Así están formulados como objetivos. La garantía técnica es "si algo falla, se detecta y se recupera".

1. **Dinero:** todo pago aprobado se refleja en una entrada o en una anomalía visible que se resuelve a mano. Nadie entra sin pagar (salvo cortesías registradas).
2. **Entrada:** quien pagó tiene su QR por al menos dos vías independientes. Si todo falla, la mesa de problemas lo resuelve en el momento.
3. **No romper lo existente:** las actividades de la organización que no son del EFS siguen funcionando igual.
4. **Velocidad:** la respuesta en pantalla al escanear el QR personal es instantánea (< 0,3 s) y no depende de la red.

### 1.2 Restricciones

- **Presupuesto cero:** planes gratuitos de Google Workspace, Cloudflare y GitHub Pages.
- **Mantenimiento por una sola persona**, no programadora:
  - Apps Script se pega a mano y se publica como "Nueva versión";
  - el código de `EFS.gs` además vive en un repositorio, para ver las diferencias y volver atrás.
- **Cobro:** cuenta **personal** de Mercado Pago.
  - Lo que se acredita es el bruto menos la comisión de Mercado Pago, que depende del plazo de liberación elegido.
  - Por el volumen (~$1,5 M en pocos días) pueden aplicarse retenciones automáticas de Ingresos Brutos de Santa Fe.
  - La conciliación compara **montos brutos**; las diferencias con el neto no son anomalías.
  - Se recomienda consultar la situación impositiva con un contador.
- **Plazo:** 18 días hasta el evento.
- **Conectividad en el hall:** desconocida. Se mide esta semana (§14, etapa 0).

---

## 2. Sistema existente (detalle técnico)

### 2.1 Sitio del EFS: `efsarg.com.ar`

- Sitio estático (HTML/CSS/JS sin framework) en GitHub Pages.
- Contenido en JSON (`assets/data/evento.json`, `actividades.json`), editable con Pages CMS.
- Sección de inscripción con estados "próximamente / abierta / cerrada". Hoy no tiene backend.

### 2.2 Plataforma de la organización: `atpfcm.com.ar`

- Sitio Astro estático (TypeScript, Tailwind), con el dominio en Cloudflare.
- Páginas relevantes:
  - formulario de charlas con certificado (`ActivityCertificateRegistrationForm.astro`);
  - `/staff/escanear/` (escáner);
  - `/staff/panel/` (panel de administración);
  - `/staff/certificados/`.
- Anti-bots: Cloudflare Turnstile. La Site Key es pública; la clave secreta está en Apps Script.

### 2.3 Backend: Google Apps Script sobre una planilla

**Despliegue:** un único Web App, "Ejecutar como: Yo", "Acceso: Cualquier usuario", con una URL `/exec` pública. El script está vinculado a la planilla.

**Planilla:**
- una hoja por actividad;
- `Errores` (registro de excepciones);
- `Campañas enviadas`;
- hojas de ventas puntuales ("Reserva Llaveros", "Reserva Agenda…").

**Hojas "charla"** (actividades con QR y certificado). Encabezados, en este orden:
`Fecha, Nombres, Apellidos, DNI, Teléfono, Email, Carrera, Año, RegistrationId, Asistencias, Dado de baja, ActivityId, CertificadoEnviado, CertificadoError`
- `Asistencias` es un JSON con los encuentros marcados.
- Se reconocen como charla por la presencia de las columnas `RegistrationId` y `Asistencias`.

**Hojas de inscripción simple** (formato anterior), por posición de columna: B = nombre, C = email, E = "Quiere recordatorio" (booleano), F = "Dado de baja" (booleano), G = sesiones (JSON), H = recordatorios enviados, I = ActivityId.

**`doPost(e)`: orden actual.** Lee `e.parameter` (`x-www-form-urlencoded`):
1. `action=adminLoginAttempt`
2. `action=adminStageCampaign`
3. `action=adminSendCertificateNow`
4. **Freno anti-spam (CacheService):**
   - 5 envíos por email por hora;
   - **40 globales cada 10 minutos**, para todas las personas → `rate_limited`.
5. Turnstile.
6. `formType=charla` → `handleCharlaRegistration`
7. `formType=llaveros` → `handleKeychainReservation`
8. Por defecto: inscripción simple + mail.

**`doGet(e)`: acciones actuales.** Todas responden JSONP:
- `unsubscribe`;
- `checkin` y `checkinRoster` (con la clave de staff);
- `adminLoginPoll`, `adminLogout`, `adminListActivities`, `adminListRegistrations`, `adminPreviewCampaign`, `adminSendCampaign`, `adminListCertificateActivities`, `adminListAttendees` y `adminCheckCertificateStatus` (con sesión de admin).

**Inscripción a charla, hoy:**
1. El navegador genera un UUID.
2. Envía con `fetch(..., {mode:'no-cors'})`, sin leer la respuesta.
3. Muestra el QR (generado en el navegador) de inmediato.
4. El servidor hace un upsert por DNI y conserva el `RegistrationId` original.
5. Manda un mail por GmailApp con el QR como `<img>` que apunta a `api.qrserver.com`.

**Check-in (`handleCheckin`):**
- Clave de staff, con demora progresiva solo ante errores.
- `findAndMarkAttendance` guarda la hoja en caché 6 h, lee el rango completo y compara con `trim`.
- Resultados posibles: `ok` / `duplicate` / `wrong_activity` / `not_found`, más el total del encuentro.
- `checkinRoster` devuelve `{id, name, sessions}` de la actividad.

**Certificados:**
- Son elegibles quienes tienen al menos una asistencia.
- El PDF se genera en el navegador del admin (pdf-lib) y se envía por **Resend**, que en el plan gratuito permite 100 por día: 300 certificados tardan 3 días.

**Mails:** todo, salvo los certificados, sale por GmailApp desde la cuenta que ejecuta el script.

**Otros:**
- disparador diario `sendReminders`;
- panel con contraseña + TOTP;
- campañas de mail.

### 2.4 Escáner y Worker de check-in existentes

**`/staff/escanear/`:**
- jsQR cada 90 ms, con el frame a 640 px.
- Pausa global de 2,5 s después de cada lectura.
- Verde solo cuando confirma el servidor.
- Camino rápido: Worker, con 2,5 s de timeout. Respaldo: Apps Script por JSONP, con 30 s de timeout.
- Precalentamiento del padrón con 25 s de timeout.

**`atp-checkin-worker`:**
- Un Durable Object por (actividad, encuentro).
- Carga el padrón una sola vez desde `checkinRoster`.
- Marca en memoria y sincroniza de a uno con `waitUntil`, con 1 reintento.

**Latencias medidas:**

| Camino | Tiempo |
|---|---|
| Apps Script, recorriendo todas las hojas | ~11 s |
| Apps Script con caché | varios s |
| Apps Script bajo carga | 17–20 s |
| Worker con el padrón en memoria | ~500 ms |
| Carga inicial del padrón | 3–20 s |

### 2.5 Decisiones de seguridad vigentes

- El código es público; la seguridad no depende de que esté oculto.
- Los secretos nunca van al repositorio.
- La clave de staff es única y compartida, y **no se rota** (decisión del dueño); tiene demora progresiva ante errores.
- `api.qrserver.com` se aceptó para las charlas.
- El login del admin va solo por POST.
- Se escapa el HTML en los mails.

### 2.6 Límites de las plataformas

| Servicio | Límite relevante |
|---|---|
| Apps Script | 30 ejecuciones simultáneas por usuario; 6 min por ejecución; `LockService` espera hasta 30 s; UrlFetch 100.000/día (Workspace) |
| GmailApp | 1.500 destinatarios/día en Workspace (100 en cuenta común). La cuota se renueva 24 h después del primer envío |
| Resend (gratis) | 100/día, 3.000/mes |
| Cloudflare Workers (gratis) | 100.000 pedidos/día; Durable Objects con SQLite |
| Mercado Pago | Espera 200/201 en ≤ 22 s y reintenta los webhooks; `GET /v1/payments/{id}`; `/v1/payments/search` paginado, con `external_reference` exacto (sin prefijo) |
| Web App | Respuesta con un redirect 302 a `script.googleusercontent.com`. HtmlService no puede navegar la ventana principal |

### 2.7 Hallazgos verificados en el código (después de la auditoría)

1. **`sendReminders`** recorre **todas** las hojas y lee por posición:
   - columna C = email, E = quiere recordatorio (`=== true`), F = dado de baja;
   - solo manda mail si la columna E vale exactamente el booleano `true`.

   → Regla: **ninguna hoja del EFS puede tener el booleano `true` en la columna E**. En "EFS 2026" la columna E es `Teléfono` (texto), así que queda a salvo.
2. **El panel** (`getEligibleActivitySheet`, `adminListActivities`, campañas) toma como actividad cualquier hoja con una columna llamada exactamente `Email`.
   - "EFS 2026" va a aparecer, y es lo buscado: certificados y campañas.
   - → Regla: **las hojas internas del EFS no pueden tener una columna llamada `Email`**; usan `correo`.
3. **Candado:** el envío de campañas y el de certificados usan `LockService.getScriptLock()` con `waitLock(30000)`. → El EFS usa `getDocumentLock()`, un candado independiente.
4. **`Dado de baja`** es la baja de mails (campañas y recordatorios). El panel cuenta como "activos" a quienes no la tienen. → La revocación de una entrada usa la columna `EstadoEntrada`.
5. El menú "avisar cambio" de la planilla usa las columnas C y F por posición. Solo aplica a la pestaña que el admin elige a mano; en una hoja charla la columna C es `Apellidos`. → No usar ese menú en "EFS 2026" (va a la guía operativa).

---

## 3. Requisitos

### Funcionales

- **R1.** Formulario en efsarg.com.ar:
  - nombre, apellido, DNI, correo (repetido), teléfono, carrera, año y universidad;
  - aviso de privacidad y casilla de aceptación;
  - aviso de "una inscripción por persona".
- **R2.** Pago de $5.000 con Checkout Pro, sin efectivo. El precio vive solo en el servidor.
- **R3.** La entrada se emite solo con un pago que cumple la validación completa (§6, I-3).
- **R4.** El QR se entrega por tres vías: página de retorno, mail con imagen adjunta (CID) y link de respaldo.
- **R5.** Panel del EFS:
  - inscriptos, pagos y anomalías;
  - reenviar la entrada;
  - "buscar el pago de esta persona en Mercado Pago y procesarlo ahora";
  - cortesías;
  - conciliación con un botón.
- **R6.** Conciliación automática diaria con reporte por mail (Nivel 2; en el Nivel 1 alcanza el botón).
- **R7.** "Mi entrada": DNI + correo → reenvío (Nivel 2).
- **R8.** Acreditación: el QR personal responde en < 0,3 s sin depender de la red. Búsqueda por apellido (local) y por DNI (online).
- **R9.** En la misma mesa: se escanea la credencial impresa y se asigna el taller, con cupo controlado online.
- **R10.** Puerta del taller: control visual (autoadhesivo de color) y, en el Nivel 3, escaneo de la credencial.
- **R11.** Certificados con el sistema existente, a partir de la acreditación.
- **R12.** Cierre de la inscripción por fecha y hora, del lado del servidor.

### No funcionales

- **N1.** Cero regresiones.
- **N2.** Idempotencia en pagos, mails y operaciones del día del evento.
- **N3.** Tolerancia a caídas temporales sin perder pagos.
- **N4.** Acreditación sin red.
- **N5.** Gratis y mantenible por una persona.
- **N6.** Trazabilidad: bitácora de pagos en la que solo se agregan filas.

---

## 4. Arquitectura

```
INSCRIPCIÓN Y PAGO

 [efsarg.com.ar]  --fetch JSON-->  [Worker EFS (Cloudflare)]  --POST servidor a servidor + secreto-->  [Apps Script: EFS.gs]
   formulario                     · Turnstile (widget propio del EFS)                                  · candado corto: DNI, fila pendiente, flush
                                  · freno por IP                                                       · crea la preferencia en MP (fuera del candado)
   <--- {pago_url} o error -------· reintenta si Apps Script está saturado  <--------------------------· devuelve init_point
   redirige a Mercado Pago

 [Mercado Pago] --webhook--> [Worker EFS] --200 al instante; waitUntil: reenvía a Apps Script (1 reintento)--> efsProcesarPago(id)
                                                                                                            · GET /v1/payments/{id}
 Red de seguridad (en Apps Script, independiente del Worker):                                               · validación completa (I-3)
   · barrido cada 10 min (pendientes recientes + pagos aprobados de las últimas horas)                      · emite la entrada (candado corto)
   · conciliación diaria completa                                                                           · da por vencida la preferencia
   · botón "procesar ahora" en el panel                                                                     · mail (fuera del candado, con reintento)

 Vuelta del pago: efsarg.com.ar/?pago=…&payment_id=…&ref=… --> Worker --> Apps Script efsVerificar(payment_id, ref)
   → si está aprobado y coincide: muestra el QR en pantalla + nombre

EVENTO

 [/staff/efs/ en cada celular] <--lista mínima (código, nombre, 3 dígitos del DNI, estado)-- [Durable Object "EFS 2026"]
   · valida el QR local: < 0,3 s, con o sin red                                              · estado en vivo: acreditados, credenciales, talleres (cupo)
   · manda cada operación con op_id --------------------------------------------------------> · deduplica entre puestos, asigna el taller atómicamente
   · cola local si no hay red                                                                 · cada 30–60 s: lote → Apps Script efsSyncLote → planilla
                                                                                              · cada 60 s: trae las entradas nuevas y revocadas
```

### Decisiones

- **D1. El Worker del EFS es la puerta pública.**
  - El sitio hace `fetch` con JSON al Worker, que tiene CORS limitado a `efsarg.com.ar`.
  - El Worker llama al Apps Script por POST `x-www-form-urlencoded`, con `formType=efs`, `accion`, el secreto Worker→Apps Script y los datos. Sigue el 302 y lee el JSON (`ContentService`).
  - Así el Apps Script queda como está: lee `e.parameter` y no hace falta tocar cómo se leen los datos.
- **D2. Si el Worker se cae:**
  - no se pueden iniciar inscripciones nuevas; el formulario muestra "probá en unos minutos";
  - los pagos ya hechos **no se pierden**: el barrido del Apps Script los detecta aunque no llegue ningún webhook.
  - Posible respaldo en el Nivel 3: un POST directo del navegador al Apps Script (a verificar en el entorno de prueba si se puede leer la respuesta).
- **D3. Código de entrada:**
  - `EFS26-` + 8 caracteres base32 Crockford (sin letras ambiguas), aleatorios del servidor: unos 40 bits, cerca de 10¹² combinaciones contra ~300 válidas;
  - 14 caracteres en modo alfanumérico → QR versión 1–2, módulos grandes y lectura rápida;
  - la unicidad se verifica al emitir.
- **D4. Webhook simple:**
  - el Worker responde 200 y reenvía con `waitUntil` (1 reintento);
  - acepta los avisos `payment` y `merchant_order`, con el id tomado de la URL o del cuerpo;
  - valida `x-signature` si está configurado (no es la seguridad principal: siempre se consulta la API);
  - **la garantía es el barrido**, no el webhook: el webhook solo aporta velocidad.
- **D5. Hojas separadas:**
  - "EFS · Pendientes", "EFS · Pagos", "EFS · Config" y "EFS · Credenciales" son internas y cumplen las reglas de §10.2;
  - "EFS 2026" tiene el formato charla, solo con entradas pagas o cortesías, así que el panel y los certificados funcionan sin cambios.
- **D6. Acreditación local primero** (detalle en §9).
- **D7. Mails:**
  - GmailApp (Workspace) como principal;
  - antes de cada envío se consulta `MailApp.getRemainingDailyQuota()`; si quedan menos de 100, se deriva a Resend (hasta 90 por día) o se encola;
  - la imagen del QR se pide a `api.qrserver.com` **desde el servidor** (UrlFetchApp) y va adjunta con CID; si falla, el mail sale igual con el código en texto y el link.
- **D8. Link de respaldo:** `efsarg.com.ar/entrada/#EFS26-XXXXXXXX`.
  - La página dibuja el QR en el navegador.
  - Lo que va después de `#` nunca llega a ningún servidor.
  - Tiene la misma sensibilidad que el mail.
- **D9. Admin y staff del EFS** usan páginas nuevas que hablan con el Worker, que valida y reenvía:
  - admin: el token de sesión existente se valida en Apps Script con `isValidAdminSession`;
  - staff: una clave de staff **propia del EFS**.
  - No se agregan acciones JSONP con datos personales.

---

## 5. Modelo de datos

### "EFS · Config" (clave / valor)

`precio` (5000) · `moneda` (ARS) · `inscripcion_abierta` (SI/NO) · `cierre` (fecha y hora) · `titulo_cobro` · `collector_id` · `sitio_url` · `mail_responder_a` · `talleres` (JSON `[{id, nombre, hora, cupo, color}]`) · `modo_evento` (SI/NO: activa la sincronización del Durable Object)

Los secretos (token de Mercado Pago, secreto Worker→Apps Script) van en `PropertiesService`, no en la hoja.

### "EFS · Pendientes"

Ninguna columna se llama `Email`, y la columna E nunca contiene un booleano:

`referencia` (`EFSP-` + 10 caracteres) · `alta` · `intento_id` · `nombre` · `dni` (texto; columna E) · `apellido` · `correo` · `telefono` · `carrera` · `anio` · `universidad` · `precio` · `estado` · `motivo` · `preferencia_id` · `pago_id` · `entrada` · `actualizado`

Estados: `pendiente` · `pagado` · `rechazado` · `abandonado` (más de 48 h sin pago) · `anomalia` · `duplicado` · `devuelto`. El detalle va en `motivo`.

### "EFS · Pagos" (bitácora, solo se agregan filas)

`fecha` · `pago_id` · `referencia` · `status` · `status_detail` · `monto_bruto` · `moneda` · `collector_id` · `live_mode` · `origen` (webhook / retorno / barrido / conciliación / panel) · `accion` · `detalle`

### "EFS 2026" (formato charla)

`Fecha, Nombres, Apellidos, DNI, Teléfono, Email, Carrera, Año, RegistrationId (= código de entrada), Asistencias, Dado de baja, ActivityId (= efs-2026), CertificadoEnviado, CertificadoError`, más estas columnas **al final**: `Universidad, Origen (pago/cortesía), PagoId, Referencia, EstadoEntrada (activa/revocada), MailEntrada (fecha o error), Credencial, Taller, AcreditadoEn, AcreditadoPor`

### "EFS · Credenciales"

`credencial` (`EFSC-042-K7QX3`: número visible + 5 aleatorios) · `numero` · `entrada` · `taller` · `vinculada_en` · `puesto` · `op_id`

### Durable Object "EFS 2026"

- `entradas` (código → nombre, DNI, estado);
- `acreditaciones` (código → hora, puesto, op_id);
- `credenciales` (credencial → código);
- `talleres` (id → cupo, ocupados, lista);
- `ops` (op_id → resultado, para contestar igual ante un reintento);
- `cola_sync` (op_id, tipo, datos, intentos, estado).

---

## 6. Reglas que el sistema nunca rompe (invariantes)

Cada una tiene su prueba automática (§12).

- **I-1.** Un `pago_id` aprobado genera como máximo una entrada.
- **I-2.** Una referencia genera como máximo una entrada. Un segundo pago aprobado sobre la misma referencia → `duplicado` + aviso para devolverlo.
- **I-3.** Solo se emite una entrada si se cumplen todas estas condiciones:
  - `status = approved`;
  - `transaction_amount == precio` de la fila pendiente;
  - `currency_id = ARS`;
  - `collector_id` igual al configurado;
  - `live_mode = true` (en producción);
  - `operation_type = regular_payment`;
  - la referencia existe en Pendientes.
- **I-4.** Un pago sin referencia válida nunca genera entrada: queda como anomalía.
- **I-5.** Una entrada revocada no vuelve a quedar activa sola.
- **I-6.** El código de entrada es único. El código de credencial es único. Una credencial pertenece a una sola persona, y una persona tiene una sola credencial.
- **I-7.** La ocupación de un taller nunca supera su cupo. Solo el Durable Object asigna, y solo online.
- **I-8.** Toda operación del día del evento lleva un `op_id`. Reintentarla devuelve el mismo resultado sin duplicar efectos.
- **I-9.** El mail se envía después de guardar la entrada. Si el mail falla, la entrada sigue siendo válida.
- **I-10.** Las hojas del EFS cumplen las reglas de forma de §10.2.

---

## 7. Flujos paso a paso

### F1. Inscripción y pago (Nivel 1)

1. El formulario se muestra solo si `evento.json` dice "abierta". Turnstile usa un widget propio de `efsarg.com.ar`.
2. El sitio genera un `intento_id` (UUID) y hace `fetch` al Worker (`/inscribir`).
3. **Worker:**
   1. freno por IP;
   2. verifica Turnstile;
   3. valida formatos;
   4. llama al Apps Script con `formType=efs&accion=iniciar` + el secreto.
   5. Si Apps Script responde error de saturación o timeout, reintenta hasta 2 veces con espera.
4. **Apps Script (`efsIniciar`):**
   1. verifica el secreto, `inscripcion_abierta` y que no se haya pasado el `cierre`;
   2. **candado corto** (`getDocumentLock`, espera de 10 s):
      - si el DNI tiene una entrada activa → `ya_inscripto` (el sitio ofrece "reenviar mi entrada");
      - si el DNI tiene una fila pendiente → la actualiza (datos y correo);
      - si no → crea una fila pendiente;
      - el mismo `intento_id` repetido devuelve la misma referencia;
      - `flush()` y se suelta el candado;
   3. **fuera del candado:** crea la preferencia:
      - precio del servidor;
      - `external_reference`;
      - `payer`;
      - `back_urls` con la referencia;
      - `auto_return=approved`;
      - `notification_url` al Worker;
      - `excluded_payment_types: ticket, atm`, 1 cuota;
      - `binary_mode: true` (aprobado o rechazado al instante, sin pagos "en revisión");
      - `category_id: tickets`, descripción del ítem, `payer.identification` (DNI) y `statement_descriptor` (lista de calidad oficial de Mercado Pago);
      - `expiration_date_to = cierre`;
      - encabezado `X-Idempotency-Key` = referencia + número de intento;
   4. guarda el `preferencia_id` (escritura puntual) y devuelve el `init_point`.
5. El sitio redirige a Mercado Pago. Todos los errores se muestran en el formulario con un texto claro.

### F2. Confirmación del pago (Nivel 1): `efsProcesarPago(pago_id, origen)`

1. `GET /v1/payments/{id}` → fila en "EFS · Pagos".
2. Busca la fila pendiente por `external_reference`. Si no existe → anomalía (I-4) + aviso al admin.
3. Según el estado del pago:
   - **`approved` y cumple I-3:**
     1. candado corto;
     2. si la referencia ya tiene entrada con el mismo `pago_id` → no hace nada;
     3. si la tiene con otro `pago_id` → `duplicado` + aviso;
     4. si no → genera el código (único), agrega la fila en "EFS 2026" (con `EstadoEntrada = activa`), pasa la fila pendiente a `pagado` y hace `flush`;
     5. fuera del candado: da por vencida la preferencia (`PUT` con `expiration_date_to = ahora`) y envía el mail (D7), registrando `MailEntrada`.
   - **`approved` que no cumple I-3** → `anomalia` + motivo + aviso.
   - **`pending` / `in_process`** → sin cambios.
   - **`rejected` / `cancelled`** → `rechazado` si no hay otro pago aprobado.
   - **`refunded` / `charged_back`, total** → `EstadoEntrada = revocada` + aviso. Si ya estaba acreditado → aviso especial y se resuelve a mano.
   - **Devolución parcial** → anomalía, se resuelve a mano.
4. Los mails fallidos se reintentan en cada barrido.

### F3. Vuelta del pago (Nivel 1)

`efsarg.com.ar/?pago=aprobado&payment_id=…&ref=…`:
1. El sitio llama al Worker, que llama a `efsVerificar`.
2. `efsVerificar` ejecuta F2 para ese pago y devuelve `{estado, codigo, nombre}` **solo si** el pago está aprobado y su `external_reference` coincide con `ref`.
3. La página muestra el QR, el nombre, un botón "guardar imagen" y el aviso "también te llega por mail".
4. Si el pago todavía no figura como aprobado → "estamos confirmando tu pago, en unos minutos te llega el mail".

### F4. Barrido cada 10 min (Nivel 1) y conciliación (botón en el Nivel 1, diaria en el Nivel 2)

**Barrido:**
1. Pendientes de menos de 48 h → `search?external_reference=<exacta>`.
2. Pagos aprobados de las últimas 3 h (`search` por fecha, paginado) → se filtra `EFSP-` en el código.
3. Cada resultado se procesa con F2.
4. Se reintentan los mails pendientes.
5. Las filas pendientes de más de 48 h pasan a `abandonado`.
6. El barrido se apaga cuando termina el día del cierre.

**Conciliación:**
1. Todos los pagos desde la apertura, paginados.
2. Cruce con Pendientes y con "EFS 2026".
3. Reporte por mail al admin:
   - total bruto;
   - cantidad de entradas pagas y de cortesías;
   - pagos aprobados sin entrada (se procesan);
   - entradas sin pago válido;
   - duplicados, devoluciones y anomalías.

### F5. Cortesías (Nivel 2)

Alta desde el panel del EFS, con `Origen = cortesía`. Reciben el mismo mail.

### F6. Mi entrada (Nivel 2)

1. DNI + correo + Turnstile → Worker → Apps Script.
2. Si coinciden con una entrada activa, se reenvía el mail (máximo 3 por hora por DNI).
3. La pantalla responde siempre lo mismo: "si los datos coinciden, te lo mandamos".

### F7. Acreditación + credencial + taller (Nivel 2), en la misma mesa

1. **Preparación del celular:**
   - el staff entra a `/staff/efs/` con la clave del EFS y elige el modo "Acreditación";
   - se descarga la lista mínima, que se actualiza cada 60 s.
2. **Paso 1, escanear el QR personal:**
   - se valida en el celular: **verde + nombre** / amarillo "ya acreditado en este dispositivo" / rojo "no válido o revocado";
   - en paralelo, `acreditar(op_id)` va al Durable Object;
   - si el DO contesta "ya acreditado en el puesto X a las HH:MM" → aviso ámbar visible.
3. **Paso 2, escanear la credencial** (la pantalla ya lo espera):
   - se comprueba el formato;
   - `vincular(op_id, código, credencial)` → DO:
     - "esta credencial ya es de otra persona" → se toma otra;
     - "esta persona ya tiene la credencial N" → se avisa.
4. **Paso 3, taller:**
   - botones grandes con los lugares libres (actualizados cada 5 s y después de cada operación);
   - un toque → `asignar(op_id, …)` → DO → `ok` / `sin_cupo`;
   - al confirmar, se pega el autoadhesivo del color del taller en la credencial;
   - el botón **"Después"** manda a la persona a la mesa de talleres sin frenar la fila.
5. **Sin red:**
   - los pasos 1 y 2 se guardan en la cola local;
   - el paso 3 queda deshabilitado: la persona recibe la credencial sin autoadhesivo y el staff la anota en la **planilla de papel del taller** (cupo numerado);
   - al volver la red se carga desde el panel.

### F8. Puerta del taller

- **Nivel 2:** control visual del autoadhesivo de color.
- **Nivel 3:** escanear la credencial en el modo "Taller X":
  - verde / rojo "otro taller o sin taller" / ámbar "hay lugar, ¿lo sumo?" (online).

### F9. Certificados

La sincronización escribe `Asistencias = ["EFS 2026"]` en las filas acreditadas. "EFS 2026" aparece en `/staff/certificados/` como cualquier hoja charla. Antes de enviar certificados, se compara la cantidad de acreditados del Durable Object con la de la planilla.

---

## 8. Matriz de escenarios y fallas

### 8.1 Pagos (P)

| # | Escenario | Tratamiento | Detección si igual ocurre |
|---|---|---|---|
| P1 | Pago aprobado, webhook OK | Entrada + QR en pantalla + mail | — |
| P2 | Webhook perdido o Worker caído | Retorno / barrido de ≤ 10 min | Conciliación |
| P3 | Paga y cierra el navegador | Webhook o barrido | Conciliación |
| P4 | Webhook repetido, en ráfaga o antes que el retorno | Idempotencia (I-1, I-2) + candado | Pruebas |
| P5 | Paga dos veces | Una sola entrada; el segundo pago es `duplicado` + aviso para devolverlo; la preferencia se da por vencida al emitir | Conciliación |
| P6 | Rechazado | Sin entrada; reintenta con el mismo DNI | — |
| P7 | Monto, moneda, cobrador o modo distintos | `anomalia` sin entrada + aviso | Conciliación |
| P8 | Devolución total o contracargo | Revocación + aviso; si ya estaba acreditado, se resuelve a mano | Barrido (reciente), conciliación (viejas) |
| P9 | Devolución parcial | Anomalía, a mano | Conciliación |
| P10 | Mercado Pago caído al crear la preferencia | Error claro en el formulario; la fila pendiente se reutiliza | `Errores` |
| P11 | Token vencido o revocado | Error + aviso inmediato | Chequeo en cada barrido |
| P12 | Paga otra persona (padre, amiga) | Válido: manda la `external_reference`, nunca el email del pagador | — |
| P13 | Tarjeta en cuotas | `transaction_amount` es el precio; el interés lo paga el comprador (se verifica en prueba) | Pruebas |
| P14 | Pago después del cierre | La preferencia vence al cierre; si igual entra, se acepta (sin tope) + aviso | Conciliación |
| P15 | Referencia inventada | Anomalía (I-4) | Conciliación |
| P16 | Pago aprobado sin fila pendiente | Anomalía, a mano | Conciliación |
| P17 | Compra grupal (uno quiere pagar por cinco) | No se permite; aviso en el formulario | — |
| P18 | El neto acreditado es menor que el bruto | Esperado (comisión y retenciones); la conciliación compara brutos | — |

### 8.2 Inscripción y mail (I)

| # | Escenario | Tratamiento |
|---|---|---|
| I1 | Oleada al abrir | Freno por IP en el Worker; candado corto en `getDocumentLock`; reintentos del Worker; el EFS no pasa por el freno global de 40 cada 10 min |
| I2 | Apps Script al límite de ejecuciones simultáneas | El Worker reintenta; si no, "probá en 1 minuto"; nada queda a medias |
| I3 | El mail no llega | QR en la página de retorno, link de respaldo, reenvío desde el panel, "Mi entrada", reintento automático |
| I4 | Cuota de Gmail cerca del límite | Desborde a Resend + aviso |
| I5 | Mismo DNI, correo distinto | Manda el DNI; la fila pendiente se actualiza; la entrada no cambia de correo sin pasar por el panel |
| I6 | DNI mal tipeado | Validación de formato; búsqueda por apellido en la acreditación |
| I7 | Bots | Turnstile + freno por IP; una fila pendiente sin pago no genera nada |
| I8 | Inscripción después del cierre | La rechaza el servidor |
| I9 | HTML o fórmulas en los campos | Escapado en los mails; guardado como texto en la planilla |
| I10 | Correo que rebota | Aviso al admin para contactar por teléfono |
| I11 | Worker caído | "Probá en unos minutos"; los pagos ya hechos los detecta el barrido |

### 8.3 Acreditación (A)

| # | Escenario | Tratamiento |
|---|---|---|
| A1 | Sin red | Validación local + cola; sin impacto en la velocidad del paso 1 |
| A2 | Mismo QR en dos puestos | Con red, el DO avisa en < 1 s; sin red, al sincronizar. **Sin red no se puede impedir, solo detectar** |
| A3 | QR inventado | No está en la lista → rojo |
| A4 | QR de otra actividad de ATP | Formato distinto → "no es del EFS" |
| A5 | Pagó a último momento | Lista actualizada cada 60 s; si no figura, se consulta al DO; si no, mesa de problemas |
| A6 | Entrada revocada | Figura como revocada → rojo. Un celular sin red puede tener la lista vieja: riesgo aceptado |
| A7 | Sin celular, sin batería o sin el mail | Búsqueda por apellido o DNI; mesa de problemas |
| A8 | QR ilegible | Búsqueda manual; QR versión 1–2 |
| A9 | Se cierra la pestaña | Cola en `localStorage`/IndexedDB (IndexedDB en el Nivel 3) |
| A10 | Un celular del staff se apaga | Celular de reserva; el estado vive en el DO |
| A11 | Cloudflare caído | Paso 1 local; los pasos 2 y 3 en papel; se cargan después |
| A12 | "Pagué y no figuro" | Mesa de problemas: panel → buscar el pago en Mercado Pago → "procesar ahora" |

### 8.4 Credenciales y talleres (T)

| # | Escenario | Tratamiento |
|---|---|---|
| T1 | Dos puestos, último lugar | El DO serializa: uno `ok`, el otro `sin_cupo` (solo online) |
| T2 | Credencial ya vinculada | "Es de X" → otra credencial |
| T3 | La persona ya tiene credencial | Aviso con el número |
| T4 | Credencial perdida | Se desvincula desde el panel y se entrega otra |
| T5 | Cambio de taller | Operación atómica en el DO, con `op_id` |
| T6 | Taller lleno en la puerta | Rojo |
| T7 | Sin red | Taller en la planilla de papel; se carga después |
| T8 | Reintento de una operación | Mismo `op_id` → mismo resultado (I-8) |

### 8.5 Plataforma existente (N)

| # | Escenario | Tratamiento |
|---|---|---|
| N1 | Error de sintaxis en `EFS.gs` | Un error de sintaxis tumba el proyecto entero, y `try/catch` no lo evita. Se previene así: prueba en el entorno de prueba + análisis sintáctico en Node + el despliegue por versión (guardar código roto no afecta la versión publicada hasta tocar "Nueva versión") |
| N2 | El freno global se llena por el EFS | El EFS se rutea antes del freno y tiene el suyo en el Worker |
| N3 | Recordatorios a la gente del EFS | Regla de la columna E (§10.2); prueba de no regresión |
| N4 | Hojas internas en el panel | Regla de "sin columna `Email`" |
| N5 | Competencia por el candado con campañas o certificados | `getDocumentLock` |
| N6 | Escáner o Worker existentes | No se tocan |
| N7 | Menú "avisar cambio" usado en "EFS 2026" | No usarlo (lee C y F por posición); queda en la guía |

### 8.6 Operación (O)

| # | Escenario | Tratamiento |
|---|---|---|
| O1 | Edición manual de filas | Hojas protegidas; la bitácora solo agrega filas |
| O2 | Se filtra la clave de staff del EFS | Se cambia en el Worker (no afecta a las entradas) |
| O3 | Se filtra el token de Mercado Pago | Solo en `PropertiesService`; se revoca desde Mercado Pago |
| O4 | Cambios de configuración a mitad de la inscripción | Congelamiento (§13) |
| O5 | Staff sin práctica | Ensayo + guía de una página |

---

## 9. Acreditación: velocidad, cola física y modos de falla

### 9.1 Objetivos de tiempo (se miden P50, P95 y P99, no el promedio)

| Operación | Objetivo |
|---|---|
| Decodificar el QR | < 150 ms |
| Validar la entrada localmente | < 50 ms |
| **Mostrar el resultado del paso 1** | **< 300 ms P95**, con o sin red |
| Aviso de duplicado entre puestos | < 1 s con red |
| Vincular la credencial y asignar el taller | < 1 s P95 con red |
| Actualizar la planilla | eventual (≤ 60 s) |

**Escáner:** se compara `qr-scanner` (Nimiq), que decodifica en un Web Worker y usa `BarcodeDetector` si existe, contra el jsQR actual, en celulares reales:
- en iPhone no hay `BarcodeDetector`, así que el respaldo es el camino principal;
- la pausa entre lecturas es **por código** (3 s): el siguiente QR se lee al instante.

### 9.2 Por qué local

El tiempo del paso 1 no puede depender del wifi del hall. El precio de esa decisión: sin red, un duplicado entre puestos se detecta después, no se impide (A2). Para un evento estudiantil pago con QR personal, el riesgo es aceptable.

### 9.3 La cola física (talleres en la misma mesa)

Con la elección del taller en la mesa, el tiempo por persona deja de ser técnico. Estimación:
- **decidido:** 12–20 s;
- **indeciso:** 30–60 s.

**Mitigaciones:**
1. Publicar los talleres, horarios y cupos en el sitio y en el mail de recordatorio del día anterior: "llegá con tu taller elegido y una segunda opción".
2. Un cartel o pantalla en la fila con los lugares libres.
3. **4–5 puestos**, cada uno con un celular y una caja de credenciales numeradas.
4. **Mesa de problemas** aparte (A7, A12, pagos dudosos).
5. Botón **"Después"**: el indeciso se acredita y elige en la mesa de talleres. Si la fila se alarga, el coordinador activa "todos a Después" y la mesa de acreditación pasa a ser solo pasos 1 + 2 (≈ 8 s). **No requiere cambiar código.**

**Capacidad:**
- 300 personas, 4 puestos, 20 s promedio → **unos 25 min**;
- con "Después" activado → **unos 10 min**.

### 9.4 Modos de funcionamiento del día

| Modo | Qué anda | Qué se hace |
|---|---|---|
| Normal | Todo | — |
| Red lenta | Paso 1 instantáneo; pasos 2 y 3 con demora | Seguir; si los talleres tardan, usar "Después" |
| Sin red en un puesto | Pasos 1 y 2 locales | Talleres en papel |
| Cloudflare caído | Paso 1 con la lista ya descargada | Pasos 2 y 3 en papel; se cargan después |
| Apps Script caído | Todo el evento (el DO acumula) | Nada: la planilla se actualiza al volver |
| Celular muerto | — | Celular de reserva (lista descargada antes) |
| Todo caído | — | **Lista impresa** por apellido + planilla de papel por taller |

---

## 10. Aislamiento: no romper lo existente

### 10.1 Cambios al código existente

Solo dos líneas de ruteo:
- en `doPost`, **antes** del freno global: `if (e.parameter.formType === 'efs') return efsRouter(e);`
- en `doGet`: nada (el EFS no usa JSONP).

`efsRouter` está en `EFS.gs` y tiene su `try/catch`, su registro en `Errores` (contexto `efs-…`) y su verificación del secreto del Worker. Reutiliza helpers de solo lectura (`escapeHtml`, `logError`, `safeParseJson`, `isValidAdminSession`) sin modificarlos.

### 10.2 Reglas de forma para las hojas nuevas

1. Ninguna hoja del EFS tiene el booleano `true` en la columna E (por `sendReminders`).
2. Las hojas internas no tienen una columna llamada `Email` (por el panel y las campañas).
3. "EFS 2026" respeta el orden de las 14 columnas de una hoja charla; lo nuevo va al final.
4. Todo texto del usuario se guarda como texto: formato `@` en las columnas y un apóstrofo si el valor empieza con `=`, `+`, `-` o `@`.

### 10.3 Prueba de no regresión

- Se ejecutan los 40+ chequeos existentes, con los mocks de Node, antes y después del cambio. La salida debe ser idéntica.
- Casos nuevos, con las hojas del EFS cargadas con 300 filas:
  - `sendReminders` no manda nada;
  - `adminListActivities` lista "EFS 2026" y no las internas;
  - las campañas y los certificados siguen funcionando;
  - el escáner de charlas no se ve afectado.

---

## 11. Seguridad y datos personales

**Secretos nuevos:**
- token de Mercado Pago y secreto Worker→Apps Script, en `PropertiesService`;
- secreto Worker→Apps Script, clave de staff del EFS, clave secreta de Turnstile del widget del EFS y secreto del webhook (si se usa), en `wrangler secret`.

Ninguno va al repositorio.

**Worker:**
- CORS solo para `efsarg.com.ar`;
- freno por IP en `/inscribir`, `/mi-entrada` y `/verificar`;
- las rutas de staff exigen la clave del EFS, y las de admin, el token de sesión.

**Datos en los celulares:** código, nombre, apellido, últimos 3 dígitos del DNI y estado. Nada más.
- La búsqueda por DNI completo se hace online, contra el DO.
- La lista se borra al cerrar la sesión y al terminar el evento.
- No se registran datos personales en la consola.

**Formulario:**
- aviso de privacidad: responsable, finalidad (inscripción, acreditación, certificado), destinatarios (Mercado Pago para el cobro) y cómo pedir acceso, corrección o baja;
- casilla de aceptación.

**Precio:** solo en el servidor. Se valida I-3.

**Nada de datos personales en URLs:** la vuelta del pago lleva solo `payment_id` y `ref`.

---

## 12. Plan de pruebas

1. **Node con mocks:**
   - cada invariante de §6 como test;
   - cada escenario simulable de §8;
   - no regresión completa (§10.3);
   - análisis sintáctico de `EFS.gs`.
2. **Entorno de prueba:** copia de la planilla + proyecto de Apps Script aparte + Worker de prueba + usuarios de prueba de Mercado Pago (vendedor y comprador). Casos:
   - aprobado, rechazado, devolución total y parcial, doble pago;
   - webhook 5 veces, webhook antes y después del retorno;
   - Worker apagado (barrido);
   - pago sin fila pendiente;
   - Mercado Pago lento (timeout).
3. **Pago real** con otra cuenta y un precio temporal bajo; después se devuelve.
4. **Carga de inscripción** (entorno de prueba):
   - 300 pedidos en ráfaga;
   - 300 en 5 min;
   - 30 simultáneos sostenidos;
   - Apps Script demorado a propósito.

   Se mide el tiempo del formulario a `init_point` en P50/P95/P99 y la cantidad de errores.
5. **Acreditación:**
   - 300 QR de prueba, 4–5 celulares (Android y iPhone);
   - modo avión;
   - dos celulares con el mismo QR;
   - dos celulares con el último lugar de un taller;
   - reintentos del mismo `op_id`;
   - latencias P50/P95/P99;
   - prueba en el hall real.
6. **Panel y certificados** con "EFS 2026" de prueba.

---

## 13. Despliegue, congelamiento y vuelta atrás

- **Apps Script:**
  - se pega en el entorno de prueba, se prueba y después pasa a producción ("Nueva versión");
  - vuelta atrás: elegir la versión anterior (1 min);
  - `EFS.gs` también vive en un repositorio.
- **Worker EFS:** `wrangler deploy`; vuelta atrás con `wrangler rollback`.
- **Sitio:** GitHub Pages; vuelta atrás con revert.
- **Congelamiento desde la apertura:**
  - código: solo arreglos críticos probados;
  - configuración: precio, `collector_id`, formato del código, proveedor de mail, dominio y talleres (los talleres se congelan desde el 14/10).

---

## 14. Etapas y cronograma

### Etapa 0: esta semana (29/9 – 1/10), bloqueantes

- [x] **Cuenta que ejecuta el Apps Script:** confirmada por el dueño (29/09): es la cuenta de Workspace de la organización, dueña de la planilla. Verificación opcional: `MailApp.getRemainingDailyQuota()` ≈ 1.500.
- [x] Mercado Pago Developers (29/09): aplicación Checkout Pro creada con el plugin oficial de Mercado Pago; usuario de prueba vendedor y comprador (con saldo) creados; `collector_id` anotado. Falta: activar las credenciales de producción desde el panel.
- [ ] Widget de Turnstile para `efsarg.com.ar`.
- [ ] Entorno de prueba: copia de la planilla + proyecto de Apps Script + Worker de prueba.
- [ ] Prueba de red en el hall (4G de 2 o 3 compañías + wifi).

### Nivel 1: abrir la inscripción (objetivo: 6–7/10)

- Formulario → Worker → Apps Script → Mercado Pago.
- F2 + webhook + barrido.
- Página de retorno con QR + mail con CID + link de respaldo.
- Panel mínimo: lista, reenviar, "procesar ahora", conciliación con un botón.
- Pruebas 1–4.

### Nivel 2: antes del evento (7 – 13/10)

- Durable Object del evento, `/staff/efs/` (acreditación, credencial, taller), búsqueda.
- Credenciales en PDF para imprimir.
- Conciliación diaria, "Mi entrada" y cortesías.
- Prueba 5.

### Nivel 3: solo si sobra tiempo

- Escaneo en la puerta de los talleres.
- Cola en IndexedDB.
- Pantalla pública de cupos.
- Respaldo de inscripción directo al Apps Script.

### Fechas

| Fecha | Hito |
|---|---|
| 29/9–1/10 | Etapa 0 |
| 1–6/10 | Nivel 1 + pruebas + pago real → **apertura** |
| 7–13/10 | Nivel 2 + prueba de acreditación |
| 14–15/10 | Ensayo en el hall; talleres congelados; impresión |
| 16/10 | Cierre, conciliación completa, lista final, lista impresa, carga de los celulares |
| 17/10 | Evento |

**Si hay que recortar:** primero el Nivel 3, después "Mi entrada" y las cortesías (a mano desde el panel). Nunca el pago, el barrido, la página de retorno ni la acreditación.

---

## 15. Decisiones pendientes

1. Fecha y hora de **apertura** y de **cierre** de la inscripción.
2. **Talleres:** lista, horarios, cupo y color de cada uno, y si se puede hacer más de uno. Se necesita antes del 13/10.
3. **Certificado:** ¿alcanza la acreditación? (Supuesto de este plan: sí.)
4. **Cortesías:** quiénes y quién las da de alta.
5. **Staff:** cantidad de puestos (recomendado 4–5), mesa de problemas, mesa de talleres y celulares (Android/iPhone).
6. **Devoluciones:** política (por ejemplo, "no se devuelve salvo error de cobro").
7. **Certificados por Resend** (100/día): aceptar que salgan en 3 días o pagar un mes del plan pago.
8. Texto del **aviso de privacidad**.

---

## 16. Preguntas para una segunda ronda de auditoría

1. ¿El Worker como puerta pública (D1) introduce algún punto único de falla que no esté cubierto por D2 y el barrido?
2. ¿Es suficiente el webhook simple + barrido cada 10 min (D4), o ven un caso donde haga falta guardar antes de responder?
3. ¿Hay algún caso donde `transaction_amount` no sea igual al precio en un pago legítimo (cuotas, promociones bancarias, descuentos de Mercado Pago)?
4. ¿Dar por vencida la preferencia al emitir la entrada evita realmente el doble pago en Checkout Pro?
5. ¿El diseño de la mesa de acreditación (§9.3) es realista para 300 personas con 4–5 puestos?
6. ¿Algo del §2.7 o del §10.2 que sugiera otra dependencia oculta del código existente?

---

## 17. Apéndices

### A. Glosario

- **Apps Script:** JavaScript en servidores de Google, vinculado a una planilla.
- **Web App:** su URL pública.
- **Worker / Durable Object:** código en Cloudflare. Un DO es una instancia única con estado que procesa los pedidos de a uno.
- **Checkout Pro:** página de pago de Mercado Pago.
- **Preferencia:** la orden de cobro.
- **`external_reference`:** nuestra referencia, que vuelve en el pago.
- **Webhook:** aviso automático de Mercado Pago.
- **Idempotencia:** repetir una operación no cambia el resultado.
- **CID:** imagen adjunta dentro del mail.
- **`op_id`:** identificador único de una operación, para que los reintentos sean seguros.
- **P95:** el tiempo por debajo del cual queda el 95 % de los casos.

### B. Prototipo previo

Hay un prototipo de la lógica de pago en un Apps Script independiente, con 15 pruebas simuladas que pasan. Se va a portar a `EFS.gs`, adaptado a v2: validación I-3, sin reservas, candado corto y sin crear entradas desde pagos huérfanos.

### C. Qué NO incluye este documento

Claves, tokens, contraseñas, IDs de implementación ni URLs privadas.
