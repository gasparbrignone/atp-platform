# UI_COMPONENTS.md

# Sistema de Componentes UI — Plataforma ATP

## Objetivo

Este documento describe el inventario real de componentes reutilizables de la plataforma ATP (`src/components/`), para que una tarea nueva reutilice antes de crear.

**Fuente de verdad para la lista exacta**: `src/components/*.astro` y `src/components/*.tsx`. Este documento se desincronizó una vez (auditoría 2026-09-14: ~13 componentes reales sin documentar, ~14 documentados que nunca se construyeron) — ante cualquier duda, mirar la carpeta real antes de asumir que algo existe o no.

---

# Filosofía

Los componentes son bloques de construcción.

Cada componente debe:

* tener una única responsabilidad;
* ser reutilizable;
* ser accesible;
* ser responsive;
* respetar el sistema de diseño;
* utilizar exclusivamente los Design Tokens.

---

# Convenciones generales

Todos los componentes deberán:

* soportar modo claro y oscuro;
* ser completamente responsive;
* respetar WCAG AA;
* utilizar animaciones consistentes;
* mantener estados visuales claros.

Todo componente interactivo deberá contemplar:

* Default
* Hover
* Focus
* Active
* Disabled
* Loading
* Error (cuando aplique)

---

# Layout

## BaseLayout (`src/layouts/BaseLayout.astro` — no es `AppLayout`, y no vive en `src/components/`)

Estructura principal de todas las páginas públicas: Navbar + contenido + Footer + metadata SEO/Open Graph/PWA. Las páginas de `/staff/` NO usan este layout (tienen su propio HTML mínimo) — por diseño, para que Microsoft Clarity y el resto del tracking público nunca corran en el panel de staff.

## Container

Controla el ancho máximo del contenido. Sin lógica.

## Section

Agrupa bloques de contenido, espaciado vertical consistente.

## Grid

Grilla responsive reutilizable (usada, por ejemplo, para las tarjetas de la Biblioteca).

---

# Navegación

## Navbar

Navegación principal: acceso a secciones, "Sumate a ATP", menú móvil. Sticky, fondo con blur sutil. El modo oscuro no tiene toggle manual — sigue únicamente `prefers-color-scheme`.

## MobileMenu

Versión móvil del menú. Implementado con `<dialog>` nativo (foco atrapado y bloqueo de scroll gratis) — comparte el controlador de apertura/cierre con `Modal` (`src/lib/dialogController.ts`), ver más abajo. Se cierra tocando fuera, con el botón, o con Escape.

## Breadcrumbs

Migas de pan — no estaba documentado antes.

## Footer

Logo, enlaces rápidos, redes sociales, información institucional.

---

# Botones

## Button

Único componente oficial para botones y para links que se ven como botón (renderiza `<a>` cuando recibe `href`, `<button>` si no — nunca crear un "LinkButton" separado).

Variantes reales: **Primary, Secondary, Outline, Ghost, Danger, Glass** (`glass` se agregó después del sistema de diseño inicial — pensada para UI sobre una foto, ej. el Hero de "Sumate a ATP").

Soporta iconos (`icon-start`/`icon-end`), loading, disabled, 3 tamaños.

---

# Tarjetas

## Card

Componente base. Admite título, contenido, acciones, imagen opcional, badge opcional (slots nombrados). Nunca crear una tarjeta a medida si se puede extender `Card`.

**No existen `BookCard`/`ToolCard`/`CareerCard`/`NewsCard` como componentes separados** — se documentaron en algún momento pero nunca se construyeron. Biblioteca, Herramientas y Carreras arman su tarjeta componiendo `Card` directamente en la página (ver `src/pages/biblioteca.astro`), no con un componente propio por tipo de contenido.

## ActivityCard

La única especialización real de `Card` que existe hoy.

---

# Patrón "tarjeta completa clickeable" (stretched link)

Cuando una tarjeta tiene una sola acción principal (ej. "Descargar" en Biblioteca), el botón de esa acción extiende su área de click a toda la tarjeta con un `::after` absoluto (`after:absolute after:inset-0 after:content-['']`), en vez de envolver la tarjeta entera en un `<a>` — evita anidar un link dentro de otro link. Requiere que el contenedor (`Card`) tenga `position: relative`, que ya lo tiene por este mismo motivo. Ver `src/pages/biblioteca.astro` para el ejemplo real (agregado 2026-09-14).

---

# Hero

Componente 100% genérico por props (`title`, `subtitle`, `description`, `primaryAction`, `secondaryAction`, `image`, `alignment`, `backgroundVariant`) — no contiene texto propio de ATP, cada página que lo usa pasa su contenido.

---

# Carrusel

## Carousel

Scroll-snap nativo para el gesto táctil (el navegador lo maneja, no JS a mano); JS solo mueve el track. Sigue el patrón WAI-ARIA APG (role=group por slide, posición anunciada, live region silenciado durante autoplay, botón de pausa persistente por WCAG 2.2.2 — en touch no existe "hover"). Cada slide declara su propio ancho — el Carousel es agnóstico al contenido.

---

# Formularios

## Input / Textarea / Checkbox

Estándar, estilo consistente.

## Select

`<select>` nativo estilizado, sin buscador — decisión consciente para no perder soporte de teclado/lectores de pantalla construyendo un widget custom; se agrega búsqueda el día que un selector concreto lo necesite.

## SearchBar

Búsqueda inmediata, botón limpiar, accesible, navegable por teclado.

## Formularios de dominio específico (no genéricos, viven en `src/components/`)

* `ActivityRegistrationForm` — inscripción simple a una actividad.
* `ActivityCertificateRegistrationForm` — inscripción a una capacitación con certificado (pide los datos del certificado, entrega QR de acceso).
* `AgendaSaleSection` / `KeychainSaleSection` — venta de merchandising. Ninguna de las dos se renderiza hoy (agenda retirada; llaveros pasó a venderse 100% presencial en la facultad, 2026-09-18) — quedan como referencia del patrón por si hace falta armar otra venta puntual (ver `docs/GOOGLE_SHEETS_FORM_SETUP.md`).
* `DocChecklistItem` — ítem tildable de una checklist de documentación (checkbox + título + detalle + badge de plazo opcional + links opcionales). Usado en `/ingresantes/` (dos veces, documentación Argentina/Extranjero) — la persistencia del tilde entre visitas (`localStorage`) vive en el `<script>` de la página que lo usa, no en el componente.

**No existe un `Switch` como componente separado** — estaba documentado, nunca se construyó.

---

# Filtros

## FilterPanel / FilterChip

`FilterPanel` agrupa filtros combinables (usado en Biblioteca); `FilterChip` representa un filtro activo, eliminable con un clic.

---

# Feedback

## Badge

Mostrar estados (Nuevo, Destacado, etc.).

## Toast

`Toast.astro` solo renderiza el contenedor vacío (una vez, en `BaseLayout`). Para mostrar un mensaje: `showToast({ message, variant })` desde `src/lib/toast.ts` — no hay forma declarativa de renderizar un toast individual. **Nota:** las páginas de `/staff/` no usan `BaseLayout`, así que cada una necesita su propio `<Toast />` — un bug real (toasts silenciosamente no-op en `panel.astro`) salió de olvidar esto.

## EmptyState / Skeleton / Loader

Estándar — nunca dejar una pantalla vacía sin explicación+acción; preferir Skeleton sobre spinners largos.

**No existe `Alert`** (mensajes persistentes) ni **`ConfirmDialog`** como componentes separados — estaban documentados, nunca se construyeron (las confirmaciones reales usan `Modal` directamente cuando hacen falta).

---

# Modales

## Modal

`<dialog>` nativo, misma lógica de apertura/cierre que `MobileMenu` (`src/lib/dialogController.ts`). Se abre con `data-modal-open="<id>"` en cualquier botón de la página — nunca llamando `dialog.showModal()` directo, porque se salta la animación/bloqueo de scroll del controlador.

---

# Componentes sin equivalente hoy (documentados antes, nunca construidos)

`Calendar`, `BookGrid`, `BookDetail`, `ActivityGrid`, `ActivityDetail`, `NewsGrid`, `NewsDetail`, `JoinCTA` — ninguno existe. Biblioteca y Actividades resuelven grilla+detalle componiendo `Grid`+`Card` directo en la página, sin un componente de listado dedicado. `NewsGrid`/`NewsDetail` no aplican: Noticias está fuera de alcance (ver `docs/TODO.md`).

---

# Componentes institucionales

## SocialLinks

Redes oficiales — reutilizado en Navbar, Footer, "Sumate a ATP".

## PhotoMarquee / PhotoGallery

Galerías de fotos (usadas en "Sumate a ATP") — no estaban documentadas antes.

## ToolIconBadge

Ícono de herramienta con estilo consistente — no estaba documentado antes.

## WhatsAppGroupsSection

Lista destacada de grupos de WhatsApp (home + página de carrera) — no estaba documentado antes.

## YouTubeVideoGrid

Grilla de últimos videos del canal de YouTube (ver `docs/YOUTUBE_SETUP.md`) — no estaba documentado antes.

## GlobalSearch

Búsqueda global del sitio — no estaba documentado antes.

---

# Componentes de staff (React, hidratados — `client:load`)

Viven en `src/components/*.tsx`, solo se usan dentro de `/staff/` (nunca en páginas públicas):

* `CampaignEditor` — editor de texto enriquecido (Tiptap) para campañas de email.
* `CertificateFieldEditor` — editor visual de posición de campos sobre el PDF de un certificado.
* `CertificateReviewCarousel` — revisión en lote de certificados generados antes de aprobar el envío.
* `CertificateSendPanel` — panel de envío real de certificados.

No estaban documentados antes; son la única parte del sitio con hidratación React — el resto de la plataforma es Astro estático + `<script>` nativo.

---

# Accesibilidad

Todos los componentes deben:

* funcionar con teclado;
* tener foco visible;
* soportar lectores de pantalla;
* mantener contraste adecuado.

---

# Responsive

Todos los componentes deben adaptarse automáticamente. No crear variantes independientes para móvil.

---

# Rendimiento

Minimizar JavaScript. Renderizado estático cuando sea posible. Hidratación limitada a los componentes de staff listados arriba — nada en el sitio público se hidrata.

---

# Animaciones

Duraciones reales (ver `docs/DESIGN_TOKENS.md`): **150ms / 250ms / 350ms** (`fast`/`normal`/`slow`). No 200ms/300ms — esos valores estaban en una versión vieja de este documento y no corresponden a ningún token real. Evitar rebotes exagerados.

---

# Regla fundamental

Antes de crear un componente nuevo, responder esta pregunta:

**¿Puede resolverse reutilizando un componente existente?**

Si la respuesta es sí, reutilizar.

Si la respuesta es no, crear un nuevo componente respetando el sistema de diseño y documentarlo acá **en el mismo cambio**, no después — así no se repite la desincronización que motivó reescribir este documento.

---

# Gatillo de actualización

Actualizar este documento en el mismo commit/cambio que:

* se cree, borre o renombre un archivo en `src/components/`;
* se agregue o quite una variante real de un componente ya documentado (como pasó con `glass` en `Button`).

No hace falta una revisión periódica — el gatillo es el cambio en sí, no el calendario.
