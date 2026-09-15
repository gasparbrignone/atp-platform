# CONTENT_SCHEMA.md

# Esquema de Contenidos — Plataforma ATP

## Objetivo

Este documento explica, en criollo, qué representa cada colección de contenido real y por qué está armada así.

**Este documento NO es la fuente de verdad del esquema exacto.** La fuente de verdad de campos/tipos/obligatoriedad es siempre `src/content.config.ts` — ese archivo además tiene comentarios inline explicando el "por qué" de cada decisión de forma (por ejemplo, por qué un campo es `.nullish()` en vez de `.optional()`, o por qué una URL usa un preprocesador especial). Este documento se desincronizó gravemente una vez (auditoría de 2026-09-14: 10 de 14 modelos documentados acá no existían en código, y hasta los que sí existían tenían campos distintos) precisamente por copiar el esquema campo por campo — no repetir ese error.

---

# Principios generales reales

* Cada colección se carga desde `src/content/<colección>/*.json` — un archivo por entrada.
* El identificador (`entry.id`) es el nombre del archivo, no un campo `id` separado dentro del JSON.
* No hay campos `createdAt`/`updatedAt` — el historial de cambios vive en git (cada commit del repo), no en el contenido en sí.
* No existe un estado de publicación de 3 valores (Draft/Published/Archived). Lo real es más simple: `activities`, `books` y `tools` tienen un campo `published: boolean`; `careers`, `subjects` y `resourceTypes` no tienen ningún campo de publicación — siempre están visibles si existen.
* Nunca eliminar contenido histórico salvo decisión explícita del administrador — esto sigue siendo cierto y aplicable.

---

# Colecciones reales (`src/content.config.ts`)

## activities

Representa cualquier actividad organizada o difundida por ATP — desde un evento puntual hasta una capacitación con certificado.

Conceptos clave (ver `content.config.ts` para los campos exactos):

* `schedule` agrupa fecha/hora/lugar en un sub-objeto — puede ser una actividad **recurrente** (`recurring: true`, se describe por día de la semana, no por fecha fija) o puntual.
* `sessions[]` reemplaza a `schedule` en actividades **compuestas** (varias clases sueltas, cada una con su propia fecha) — ej. una semana de repasos con una clase distinta por día.
* `registration` agrupa cómo se inscribe la gente: un link externo simple, un formulario propio del sitio (`useRegistrationForm`), o — para capacitaciones con certificado — `collectCertificateData`, que activa un formulario que pide los datos que van a figurar en el certificado y entrega un QR de acceso (ver `docs/GOOGLE_SHEETS_FORM_SETUP.md`).
* `status` (`proxima`/`activa`/`finalizada`) controla si se muestra como vigente, no una fecha de fin calculada.
* `featured` la destaca en el home.

**No existe**: `coverImage` con ese nombre (es `image`), `startDate`/`endDate` como campos sueltos, `registrationUrl` a nivel raíz (vive dentro de `registration`), ni `category`.

## books

Representa un recurso académico descargable (la Biblioteca).

Conceptos clave:

* `subject` y `resourceType` son **slugs que apuntan a otras colecciones** (`subjects`/`resourceTypes`), no texto libre ni un enum fijo — así se puede crear una materia o un tipo de recurso nuevo desde el CMS sin tocar código.
* `career` es un array — un libro puede pertenecer a más de una carrera.
* `downloadUrl` es el link real de descarga (hoy: Cloudflare R2, subido directo desde el CMS). `driveUrl` es un campo alternativo — un link de Google Drive que un workflow migra solo a `downloadUrl` en segundo plano (ver `docs/STACK_DECISIONS.md`, sección Biblioteca). Nunca se usa `driveUrl` como link de descarga directamente.
* `cover` existe en el esquema pero **todavía no tiene consumidor en ninguna página** — se preparó el campo y el CMS para cuando haya portadas reales cargadas de forma consistente.

**No existe**: `academicYear`, `edition`, `publisher`, `language`, `fileSize`, `pages`, `tags`.

## careers

Representa una carrera de la Facultad (Medicina, Enfermería, Fonoaudiología, Terapia Ocupacional).

Conceptos clave:

* `tools[]` y `resources[]` son listas embebidas propias de cada carrera (no relacionan contra la colección `tools` suelta) — herramientas/recursos específicos de esa carrera.
* `whatsappGroups[]` es una lista aparte de `resources[]` porque tanto el home como la página de la carrera necesitan mostrarla destacada, no mezclada con links genéricos.
* `instagram` es opcional porque Medicina usa la cuenta general (`@atp.fcm`), no una propia.

**No existe**: `heroImage`, `published`, `color`, `icon` a nivel carrera.

## tools

Representa una herramienta digital suelta (no ligada a una carrera en particular) — atlas, calculadoras, simuladores, plataformas externas.

Conceptos clave:

* `description` admite Markdown en línea (negrita/cursiva/links).
* `content` (opcional) es Markdown completo — cuando está presente, la herramienta tiene su propia página de detalle en vez de ser solo una tarjeta.
* `icon` es un ícono Lucide de un enum fijo; `customIcon` (opcional) lo reemplaza por una imagen propia cuando existe.

## subjects / resourceTypes

Colecciones chicas y editables desde el CMS (solo `name` + `order` opcional) que reemplazan lo que antes eran listas fijas en código — permiten crear una materia o un tipo de recurso nuevo (ej. "Inmunología", o "Cuaderno del alumno") sin pedir un cambio de código.

---

# Modelos que se llegaron a documentar pero nunca se implementaron

La versión anterior de este documento describía 8 modelos más que **no tienen ninguna colección real hoy**: News (Noticias — se sacó explícitamente por decisión de producto, ver `docs/ROADMAP.md`/`docs/TODO.md`), Link, Announcement, TeamMember, SocialNetwork, FAQ, Download, Page, Category, Tag.

No están confirmados como necesarios ni descartados (salvo News, que sí está confirmado fuera de alcance) — si alguno de estos vuelve a ser necesario, tratarlo como una colección nueva a diseñar desde cero contra las necesidades reales del momento, no como "completar" esta lista vieja.

---

# Relaciones reales

* Un **book** pertenece a una `subject` (una sola) y a una o más `career`.
* Una **activity** no se relaciona formalmente con ninguna otra colección hoy (no hay campo que la ligue a `careers`, por ejemplo).
* Una **career** contiene sus propias `tools[]`/`resources[]`/`whatsappGroups[]` embebidas — no referencia la colección `tools` suelta.

---

# Convenciones que siguen aplicando

* Los slugs (nombre de archivo) deben ser únicos y permanentes — nunca reusar el nombre de archivo de una entrada borrada para otra cosa distinta.
* Fechas en formato ISO 8601, nunca texto libre.
* Todo enlace externo debe usar HTTPS.
* Toda imagen de contenido debe tener texto alternativo real (no `alt=""` salvo que sea puramente decorativa).

---

# Gatillo de actualización

Actualizar este documento cuando:

* se agregue o borre una colección en `src/content.config.ts`;
* cambie el propósito conceptual de una colección existente (no hace falta por cada campo nuevo — para eso ya está `content.config.ts` con sus comentarios).

Si se necesita el detalle exacto de campos/tipos, leer `src/content.config.ts` directamente en vez de copiarlo acá — es lo que causó la desincronización original.
