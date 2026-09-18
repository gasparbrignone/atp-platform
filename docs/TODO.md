# TODO.md

# ATP Platform — Lista Maestra de Tareas

> **Estado del proyecto:** En producción, desarrollo activo (última actualización de este documento: 2026-09-14).
>
> Este documento centraliza el estado real de las tareas del proyecto. Debe mantenerse actualizado durante todo el ciclo de vida de la plataforma — ver "Gatillo de actualización" al final.
>
> Para el detalle día a día de qué cambió y por qué (bugs de producción, decisiones tomadas sobre la marcha), la fuente más confiable es `docs/SECURITY_CHANGELOG.md` y `docs/GOOGLE_SHEETS_FORM_SETUP.md` — este documento da el panorama general, no reemplaza esos registros.

---

# Leyenda

* ⬜ Pendiente
* 🟨 En progreso / parcial
* ✅ Completado
* ⛔ Bloqueado
* 🚀 Futuro
* 🚫 Fuera de alcance (decisión de producto)

---

# Prioridad Máxima (MVP) — ✅ Cumplida

Todo lo listado originalmente como indispensable para la primera versión ya está en producción.

## Documentación

* ✅ Redactar `CLAUDE.md`
* ✅ Redactar `PROJECT.md`
* ✅ Redactar `TECH.md`
* ✅ Redactar `DESIGN.md`
* ✅ Redactar `DESIGN_TOKENS.md`
* ✅ Redactar `FEATURES.md`
* ✅ Redactar `CONTENT.md`
* ✅ Redactar `CONTENT_SCHEMA.md`
* ✅ Redactar `UI_COMPONENTS.md`
* ✅ Redactar `ROADMAP.md`
* ✅ Redactar `STACK_DECISIONS.md`
* ✅ Redactar `CONTRIBUTING.md`
* ✅ Redactar `MASTER_PROMPT.md`
* ✅ Sistema de documentación de seguridad (`SECURITY.md`, `SECURITY_DECISIONS.md`, `SECURITY_CHECKLIST.md`, `SECURITY_CHANGELOG.md`) — no estaba en el plan original, se agregó en el camino y hoy es la documentación mejor mantenida del proyecto.

---

# Branding

* ✅ Incorporar logo oficial en SVG.
* ✅ Incorporar favicon.
* ✅ Preparar íconos para PWA.
* ✅ Definir imágenes Open Graph.
* ✅ Revisar identidad visual completa.
* ⬜ Crear imágenes específicas para compartir en redes sociales (más allá del Open Graph genérico).

---

# Configuración inicial — ✅ Cumplida

* ✅ Crear repositorio en GitHub.
* ✅ Inicializar proyecto Astro.
* ✅ Configurar TypeScript estricto.
* ✅ Configurar Tailwind CSS.
* ✅ Configurar ESLint.
* ✅ Configurar Prettier.
* ✅ Configurar aliases.
* ✅ Configurar GitHub Pages (deploy automático vía GitHub Actions en cada push a main).
* ✅ Configurar dominio personalizado (atpfcm.com.ar, DNS delegado a Cloudflare, CNAME en public/CNAME).
* ✅ Configurar HTTPS (certificado Let's Encrypt emitido por GitHub Pages, Enforce HTTPS activo).
* ✅ Configurar PWA (manifest con íconos PNG reales, apple-touch-icon, Service Worker con offline fallback).
* ✅ Configurar sitemap.
* ✅ Configurar robots.txt.

---

# Sistema de Diseño — ✅ Cumplida

## Tokens

* ✅ Implementar colores.
* ✅ Implementar tipografía Montserrat.
* ✅ Implementar espaciados.
* ✅ Implementar radios.
* ✅ Implementar sombras.
* ✅ Implementar animaciones.
* ✅ Implementar modo oscuro.

## Layout

* ✅ Container
* ✅ Section
* ✅ Grid

## Componentes base

* ✅ Button (incluye variante `glass`, agregada después del sistema de diseño inicial — ver `docs/UI_COMPONENTS.md`)
* ✅ Input
* ✅ Select
* ✅ Textarea
* ✅ Checkbox
* ✅ Badge
* ✅ Card
* ✅ Modal
* ✅ Toast
* ✅ Skeleton
* ✅ Loader
* ✅ EmptyState
* ✅ SearchBar
* ✅ SectionHeader
* ✅ FilterPanel
* ✅ FilterChip
* ✅ Carousel
* ✅ Hero
* ✅ Navbar
* ✅ MobileMenu
* ✅ Footer
* ✅ SocialLinks
* ✅ Breadcrumbs, PhotoMarquee, PhotoGallery, ToolIconBadge, GlobalSearch, WhatsAppGroupsSection, YouTubeVideoGrid — componentes que se agregaron después del MVP inicial, no estaban en esta lista original.

---

# Home — ✅ Cumplida

* ✅ Hero principal.
* ✅ Carrusel de actividades.
* ✅ Accesos rápidos.
* ✅ Biblioteca destacada.
* ✅ Carreras.
* ✅ CTA "Sumate a ATP".
* ✅ Footer completo.
* 🚫 Carrusel de novedades — depende de la sección "Noticias", fuera de alcance (ver más abajo).

---

# Biblioteca — ✅ Estructura cumplida, contenido en curso

## Estructura

* ✅ Crear colección de libros (`src/content/books/`, ver `src/content.config.ts`).
* ✅ Implementar metadatos (materia y tipo de recurso son colecciones editables desde el CMS, no listas fijas en código).
* ✅ Crear tarjetas.
* ✅ Crear buscador (tolerante a tildes y errores de tipeo).
* ✅ Implementar filtros (carrera, materia, tipo).
* ✅ Optimizar descarga directa — subida arrastrando el archivo desde el CMS a Cloudflare R2, sin pasar por Google Drive (2026-09-14, ver `docs/STACK_DECISIONS.md`).
* ✅ Toda la tarjeta es clickeable, no solo el botón "Descargar" (2026-09-14).
* 🚫 Crear "detalle" de libro aparte — no se construyó una página de detalle propia; la tarjeta + descarga directa cubre la necesidad real.
* ⬜ Implementar etiquetas libres (hoy la organización es por materia/carrera/tipo, no por tags sueltos).

## Contenido

Cargar libros es ahora una tarea continua de curaduría editorial vía el CMS (`/admin`), no una tarea de código con un fin definido — no tiene sentido marcar "importar Anatomía" como completado/pendiente de una vez para siempre. Ver el panel `/admin` para el estado real de qué materias tienen contenido cargado hoy.

---

# Actividades — ✅ Cumplida

* ✅ Crear colección.
* ✅ Crear tarjetas.
* ✅ Mostrar actividades vigentes.
* ✅ Ocultar automáticamente actividades vencidas (campo `status`).
* ✅ Inscripción propia — **no** es un Google Form embebido: es un formulario del sitio que postea a un Google Apps Script + Sheet (ver `docs/GOOGLE_SHEETS_FORM_SETUP.md`). El ítem original decía "Integrar Google Forms"; lo que se construyó es más robusto que eso.
* ✅ Destacar actividades importantes (campo `featured`).
* ✅ Actividades compuestas (varias sesiones/clases con fecha propia cada una).
* ✅ Capacitaciones con certificado: formulario propio, QR de acceso, check-in en el evento, emisión de certificado (ver sección "Panel de Administración" abajo).
* 🚫 Crear "detalle" de actividad aparte — no existe una página `/actividades/[slug]` separada de la tarjeta+modal/inscripción; no se identificó la necesidad.

---

# Noticias — 🚫 Fuera de alcance (decisión de producto)

Se sacó por decisión de producto en la Fase 6 (ver `docs/ROADMAP.md`). No existe colección, página, ni componente para esto hoy. Si vuelve a ser necesario, es un feature nuevo, no una tarea pendiente de terminar.

* 🚫 Crear colección.
* 🚫 Crear carrusel.
* 🚫 Crear listado.
* 🚫 Crear detalle.

---

# Carreras

## Medicina

* ✅ Página principal.
* ✅ Recursos.
* ✅ Herramientas.
* ✅ Enlaces (campo `resources`, genérico).
* ⬜ Calendario académico — no se construyó, no hay componente `Calendar`.

## Enfermería / Fonoaudiología / Terapia Ocupacional

* ✅ Página principal.
* ✅ Recursos.
* ✅ Herramientas.

---

# Herramientas — ✅ Estructura cumplida

* ✅ Colección editable desde el CMS (`src/content/tools/`), con ícono, descripción, y página de detalle propia opcional.
* Ejemplos como "Atlas anatómicos" o "Microscopios virtuales" son contenido a cargar vía CMS, no tareas de código separadas — mismo criterio que "Biblioteca → Contenido" arriba.

---

# Ingresantes — ✅ Cumplida (2026-09-18)

* ✅ Página propia `/ingresantes/` (`src/pages/ingresantes.astro`) con la información oficial del Ingreso 2027 a la FCM, reorganizada en pasos/tabs/acordeones/checklist en vez de texto corrido — reemplaza la entrada que antes vivía enterrada en la colección `tools`.
* ✅ Contenido hardcodeado a propósito (no content collection): es información de una convocatoria puntual, no contenido recurrente — mismo criterio que `KeychainSaleSection.astro`. Ver el comentario "GATILLO DE ACTUALIZACIÓN" al principio del archivo para cuándo revisarla de nuevo (antes del Ingreso 2028).
* ✅ Botón flotante de WhatsApp — solo en esta página (pedido explícito del dueño del proyecto, no sitewide).
* ✅ Redirect de la URL vieja (`/herramientas/ingresar-a-la-fcm/`) configurado en `astro.config.mjs`.
* ✅ Banner llamativo en el home (`IngresantesPromoSection.astro`, justo debajo del Hero) hacia `/ingresantes/` — ocupa el lugar donde antes estaba `KeychainSaleSection` (venta de llaveros, que pasó a ser 100% presencial en la facultad, 2026-09-18).

---

# Institucional

* ✅ Sumate a ATP.
* 🚫 Quiénes somos — fuera de alcance (decisión de producto).
* 🚫 Historia — fuera de alcance (decisión de producto).
* 🚫 Valores — fuera de alcance (decisión de producto).
* 🚫 Contacto — fuera de alcance (decisión de producto); cubierto por los canales de "Sumate a ATP".

---

# CMS — ✅ Cumplida

* ✅ Migrar contenido a Astro Content Collections (Actividades, Biblioteca, Carreras, Herramientas, Materias, Tipos de recurso).
* ✅ Panel `/admin` — **Sveltia CMS** (no Decap: se migró porque Netlify Identity, el mecanismo de login de Decap, fue discontinuado por Netlify — ver `docs/STACK_DECISIONS.md`).
* ✅ Login con Personal Access Token de GitHub — sin OAuth App propia, sin proxy (ver `docs/CMS_SETUP.md`).
* ✅ Repositorio real de GitHub en uso.
* ✅ Subida de libros directo a Cloudflare R2 desde el CMS (2026-09-14).

---

# Redes Sociales — ✅ Cumplida

* ✅ Instagram por carrera (Medicina, Enfermería, Fonoaudiología, Terapia Ocupacional) — links reales en `src/content/careers/*.json`.
* ✅ YouTube ATP Ciencias Médicas — grilla de últimos videos en el home (`docs/YOUTUBE_SETUP.md`).

---

# Panel de Administración (`/staff/`) — ✅ Construido, 🟨 no está siendo usado todavía por el equipo

Mucho más se construyó acá de lo que este documento reflejaba: login con contraseña + Google Authenticator (TOTP), envío de campañas de mail con editor de texto enriquecido, sistema completo de certificados (generación de PDF en el navegador, revisión en lote, envío real vía Resend), check-in por QR con Worker de Cloudflare para que sea casi instantáneo, y un checkbox de "recordarme" para no tener que loguearse cada vez.

* ✅ Instalar CMS (ver sección CMS arriba).
* ✅ Configurar autenticación (contraseña + TOTP, con sesión recordada opcional de 30 días).
* ✅ Editar actividades / ver inscriptos.
* ✅ Editar biblioteca (vía CMS, sección aparte).
* ✅ Editar carreras / herramientas (vía CMS).
* ✅ Envío de campañas de email a inscriptos.
* ✅ Sistema de certificados (generación, revisión, envío) para capacitaciones.
* ✅ Check-in por QR en el evento.
* 🚫 Editar noticias / páginas institucionales — no aplica, esas secciones están fuera de alcance (ver arriba).
* ⬜ **Pendiente real (no de código): capacitar al resto del equipo.** El panel está pensado para 2-3 personas más del staff, con conocimientos técnicos muy básicos — hoy solo lo usa el dueño del proyecto porque no hubo tiempo de explicárselo a los demás. Esto no es una tarea de desarrollo, es una tarea operativa del dueño del proyecto.
* ⬜ Reenvío de un QR individual (buscar por nombre/email/DNI dentro de una actividad y reenviar).
* ⬜ Envío a múltiples actividades a la vez sin duplicar destinatarios entre listas.

---

# SEO — ✅ Cumplida

* ✅ Meta tags.
* ✅ Open Graph.
* ✅ Twitter Cards.
* ✅ Canonical.
* 🟨 Datos estructurados (Organization/WebSite sitewide; Event/Book por tipo de contenido quedan pendientes de que las fechas de actividades sean 100% ISO).
* ✅ Sitemap automático (excluye `/staff/**`).

---

# Analíticas — ✅ Cumplida

* ✅ Integrar herramienta de analíticas (GoatCounter, sin cookies, sin banner de consentimiento).
* ✅ Microsoft Clarity para grabación de sesión/heatmaps (agregado después, no reemplaza a GoatCounter).
* ✅ Medir visitas, descargas, búsquedas, clics en CTA, actividades más consultadas.

---

# Accesibilidad — ✅ Cumplida

* ✅ Navegación con teclado.
* ✅ Focus visible.
* ✅ Contraste WCAG AA (verificado numéricamente).
* ✅ Lectores de pantalla (roles/aria en Carousel, Modal, MobileMenu).
* ✅ Textos alternativos.

---

# Optimización — ✅ Cumplida

* ✅ Optimizar imágenes (hoy sí hay imágenes reales — portadas de libros, fotos de "Sumate a ATP" — con `loading="lazy"` donde corresponde; el ítem original decía que no había ninguna todavía, ya no es así).
* ✅ Optimizar fuentes (TTF → WOFF2, preload del peso principal).
* ✅ Reducir JavaScript (mínima hidratación; algunas islas React puntuales en `/staff/` para el editor de certificados y campañas).
* ✅ Optimizar CSS (Tailwind v4 purga clases no usadas).
* ✅ Lazy Loading donde aplica.
* ✅ Code Splitting (por página/isla, Astro por defecto).

---

# Internacionalización — ✅ Cumplida (mínimo definido)

* ✅ No hardcodear idioma (`<html lang>` toma `siteConfig.locale`) — decisión de producto: Fase 14 reducida a este mínimo, sin traducción a portugués ni rutas por idioma.

---

# Pruebas — ✅ Cumplida

## Funcionales

* ✅ Navegación (0 links internos rotos).
* ✅ Formularios ("Sumate a ATP" usa Formspree real, `formspree.io/f/xwvdjvyz` — ya no es un placeholder; el resto de los formularios públicos van a Google Apps Script).
* ✅ Descargas.
* ✅ Buscador.
* ✅ CMS (panel funcionando en producción, verificado con ediciones reales).

## Responsive

* ✅ 320 / 375 / 390 / 430 / 768 / 1024 / 1280 / 1536px.

## Navegadores

* ✅ Chrome / Edge / Firefox / Safari (motor, vía Playwright — no sustituye una prueba en Safari real de macOS/iOS).

---

# Publicación — ✅ Cumplida

* ✅ Primer despliegue.
* ✅ Verificación HTTPS.
* ✅ Verificación SEO.
* ✅ Verificación PWA.
* ✅ Verificación Analytics.
* ✅ Publicación oficial — el sitio está live en `atpfcm.com.ar` desde hace meses, con deploy automático en cada push a `main` (sin gate de aprobación humana — decisión explícita del dueño, ver `docs/SECURITY_DECISIONS.md`).

---

# Backlog (Post-MVP) — sin cambios, sigue siendo backlog real

## Comunidad

🚀 Sistema de favoritos.

🚀 Recursos recientemente vistos.

🚀 Recomendaciones automáticas.

🚀 Compartir recursos.

🚀 Encuestas.

🚀 Calendario personal.

🚀 Recordatorios.

🚀 Notificaciones web.

🚀 Integración con Google Calendar.

🚀 Área privada para integrantes de ATP.

🚀 Gestión interna de voluntarios.

🚀 Panel de estadísticas avanzado.

🚀 Buscador con inteligencia artificial.

🚀 Recomendaciones académicas personalizadas.

🚀 Chat de ayuda para estudiantes.

---

# Ideas en evaluación

Estas ideas aún no tienen prioridad, pero deben conservarse para futuras revisiones.

* 🚀 Generador automático de cronogramas de estudio.
* 🚀 Simulador de correlatividades para Medicina.
* 🚀 Calculadora de avance en la carrera.
* 🚀 Agenda de mesas de examen personal.
* 🚀 Integración con SIU Guaraní (si fuera técnicamente posible).
* 🚀 Sistema de marcadores para la biblioteca.
* 🚀 Modo "sin distracciones" para estudiar.
* 🚀 Compartir recursos por WhatsApp con un clic.
* 🚀 Descargas múltiples en lote.
* 🚀 Recursos recomendados según la materia que cursa el estudiante.

---

# Definición de "Terminado"

Una tarea solo podrá marcarse como **✅ Completada** cuando:

* funciona correctamente;
* respeta el sistema de diseño;
* es responsive;
* cumple con WCAG AA;
* no reduce el rendimiento del sitio;
* no introduce deuda técnica;
* está integrada con el resto de la plataforma;
* fue revisada manualmente (idealmente en un navegador real, no solo leyendo el código — ver `docs/CONTRIBUTING.md`).

---

# Objetivo final

Construir una plataforma moderna, rápida, accesible y fácil de administrar que se convierta en el principal punto de encuentro digital de los estudiantes de la Facultad de Ciencias Médicas de la Universidad Nacional de Rosario.

La plataforma debe reflejar la identidad de ATP: **hecha por estudiantes, para estudiantes**, con una experiencia de usuario de nivel profesional y una arquitectura preparada para crecer durante muchos años.

---

# Gatillo de actualización

Actualizar este documento:

* cada vez que se termine una tarea real (marcarla ✅ en el momento, no "después");
* cada vez que una decisión de producto saque algo de alcance (marcar 🚫, no borrar el ítem — igual que se hizo con "Noticias");
* cada vez que se detecte, leyendo este archivo, que dice algo que el código ya contradice — no esperar a la próxima auditoría completa.

No hace falta una revisión periódica programada: si nadie lo toca cuando algo cambia, vuelve a desactualizarse como pasó antes.
