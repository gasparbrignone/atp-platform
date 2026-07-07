# ROADMAP.md

# Hoja de Ruta de Desarrollo — Plataforma ATP

## Objetivo

Este documento define el orden oficial de construcción de la plataforma ATP.

Las funcionalidades deberán implementarse de manera incremental.

No se debe comenzar una nueva fase sin haber finalizado correctamente la anterior.

Cada fase debe dejar el proyecto en un estado funcional, estable y desplegable.

---

# Principios

Durante todo el desarrollo se deben respetar las siguientes reglas:

* mantener el proyecto siempre compilando;
* evitar código temporal;
* evitar funcionalidades incompletas;
* mantener el rendimiento;
* priorizar calidad sobre velocidad.

---

# Fase 0 — Inicialización

## Objetivos

Crear la base del proyecto.

Configurar todas las herramientas necesarias.

### Tareas

* Crear proyecto Astro.
* Configurar TypeScript.
* Configurar Tailwind CSS.
* Configurar aliases.
* Configurar linting.
* Configurar formateo.
* Configurar GitHub Pages.
* Configurar estructura inicial.
* Configurar modo claro y oscuro.
* Configurar Design Tokens.
* Configurar PWA.
* Configurar SEO base.

### Resultado esperado

Proyecto completamente funcional.

Sin contenido.

Con arquitectura preparada.

---

# Fase 1 — Sistema de Diseño

## Objetivos

Construir todos los componentes reutilizables.

### Componentes mínimos

Button

Input

Card

Badge

Navbar

Footer

Hero

Section Header

Container

Grid

Modal

Toast

Search Bar

Carousel

Skeleton

Empty State

Loader

### Resultado esperado

Todos los componentes reutilizables disponibles.

Ninguna página todavía.

---

# Fase 2 — Layout General

## Objetivos

Construir la estructura del sitio.

### Incluye

Navbar.

Footer.

Menú móvil.

Navegación.

Layout principal.

Rutas.

Tema.

Responsive.

### Resultado esperado

La navegación completa funciona.

Las páginas aún pueden contener contenido temporal.

---

# Fase 3 — Página de Inicio

## Objetivos

Construir la Home.

### Secciones

Hero.

Actividades.

Novedades.

Biblioteca destacada.

Carreras.

Herramientas.

CTA.

Footer.

### Resultado esperado

Home completamente funcional.

Sin datos reales aún.

---

# Fase 4 — Biblioteca

## Objetivos

Construir la biblioteca digital.

### Funcionalidades

Buscador.

Filtros.

Tarjetas.

Detalle.

Descarga.

Etiquetas.

### Resultado esperado

Biblioteca completamente navegable.

---

# Fase 5 — Actividades

## Objetivos

Implementar el módulo de actividades.

### Funcionalidades

Listado.

Detalle.

Carrusel.

Inscripción.

Actividades destacadas.

Actividades vencidas.

### Resultado esperado

Sistema completo de actividades.

---

# Fase 6 — Noticias

## Objetivos

Construir el módulo de novedades.

### Funcionalidades

Listado.

Carrusel.

Detalle.

Contenido destacado.

### Resultado esperado

Sistema completo de noticias.

---

# Fase 7 — Carreras

## Objetivos

Crear las páginas de cada carrera.

### Carreras

Medicina.

Enfermería.

Fonoaudiología.

Terapia Ocupacional.

Cada una tendrá:

Recursos.

Herramientas.

Información.

Accesos rápidos.

---

# Fase 8 — Herramientas

## Objetivos

Construir el catálogo de herramientas.

Ejemplos

Atlas.

Microscopios.

Recursos interactivos.

Calculadoras.

Enlaces.

---

# Fase 9 — Contenido Institucional

## Objetivos

Crear páginas permanentes.

Incluye

Sumate a ATP.

Decisión de producto: Quiénes somos, Historia, Valores y Contacto quedan
fuera de alcance. No se van a construir.

---

# Fase 10 — CMS

## Objetivos

Integrar el sistema de administración.

Debe permitir editar:

Actividades.

Biblioteca.

Herramientas.

Carreras.

Sin modificar código.

Noticias, Páginas y Enlaces quedan fuera: no existen esos módulos en el sitio
(Noticias se sacó por decisión de producto en Fase 6; Páginas/Enlaces
corresponden a la Fase 9, que también quedó reducida por decisión de producto).

## Estado

Integrado **Decap CMS** (decisión ya tomada en `docs/STACK_DECISIONS.md`).
Migrados los 4 módulos de contenido a Astro Content Collections (JSON +
`src/content.config.ts`) — requisito para que Decap pueda editarlos. Panel en
`/admin` (sin dependencia npm, vía CDN) con las 4 colecciones configuradas.

Pendiente de acción externa del usuario (no es código, ver
`docs/CMS_SETUP.md`): crear el repositorio real de GitHub y un proveedor de
autenticación OAuth. Mientras tanto, el panel se puede probar completo en
local con `npx decap-server`.

---

# Fase 11 — SEO

## Objetivos

Optimizar todo el sitio.

Incluye

Meta Tags.

Open Graph.

Twitter Cards.

Sitemap.

Robots.

Structured Data.

Canonical.

---

# Fase 12 — Analíticas

## Objetivos

Integrar analíticas.

Medir

Visitas.

Descargas.

Búsquedas.

Botones.

Actividades.

---

# Fase 13 — Optimización

## Objetivos

Optimizar rendimiento.

Reducir JavaScript.

Optimizar imágenes.

Reducir CSS.

Mejorar Lighthouse.

Corregir accesibilidad.

---

# Fase 14 — Internacionalización

## Objetivos

Preparar múltiples idiomas.

Inicialmente

Español.

Arquitectura preparada para portugués.

Decisión de producto (2026-07-06): fase reducida a su mínimo. No se traduce
contenido a portugués ni se agregan rutas por idioma. El único requisito —
no hardcodear el idioma — ya se cumple: `<html lang>` en BaseLayout.astro
toma el valor de `siteConfig.locale`, no un literal fijo. No hay trabajo
pendiente en esta fase; se considera cerrada.

---

# Fase 15 — PWA

## Objetivos

Finalizar experiencia tipo aplicación.

Manifest.

Offline.

Instalación.

Iconos.

Pantalla de carga.

Hecha (2026-07-06). Manifest con íconos PNG reales (192, 512, 512 maskable)
generados a partir de la marca (`favicon.svg`) sobre el color de fondo de
marca, más apple-touch-icon y meta tags de iOS (BaseLayout.astro) — antes
solo había SVG e ico de 32×32, insuficiente para que el navegador ofrezca
instalar. Service worker (`public/sw.js`): network-first con fallback a
caché para navegación, stale-while-revalidate para el resto de assets
propios; sin dependencias externas (sin Workbox) ni lista de precache
generada en build, para no acoplarse a los nombres hasheados de Vite.
Página `/offline.html` autocontenida (estilos inline, sin depender de
otros assets) como fallback cuando no hay red. Pantalla de carga: decisión
de producto de apoyarse en la splash automática de Android (a partir de
íconos + colores del manifest) sin fabricar imágenes de splash específicas
para iOS — evita ~10-30 imágenes por tamaño de dispositivo, de alto
mantenimiento y práctica cada vez más obsoleta.

---

# Fase 16 — QA

## Objetivos

Revisión completa.

### Verificar

Responsive.

Accesibilidad.

SEO.

Rendimiento.

Modo oscuro.

Navegación.

Enlaces.

Buscador.

CMS.

Hecha (2026-07-07). Auditoría real contra producción (enlaces con
crawler propio, responsive 320-1536px, modo oscuro, accesibilidad con
axe-core, rendimiento con Lighthouse). Bugs reales encontrados y
corregidos: Herramientas sin EmptyState con cero elementos; jerarquía
de encabezados rota en Biblioteca/Actividades/Home/Carreras (ninguna
tenía `<h1>`, varias grillas saltaban de h1/h2 a h3) — 0 violaciones de
axe-core en las 7 páginas después del fix; logo sin width/height
explícitos (layout shift); fuente ExtraBold del `<h1>` (elemento LCP en
Lighthouse) sin precargar. Lighthouse pasó de 88/98/100/100 a
94/100/100/100 (rendimiento/accesibilidad/best practices/SEO). El
rendimiento no llegó al 95 porque lo que resta (cache headers de
GitHub Pages, CSS crítico inline) requiere cambios de arquitectura
para una ganancia marginal — no se justifica en un sitio estático
gratuito de este tamaño.

También se detectó (no relacionado al QA en sí) que gran parte del
contenido de Actividades, Herramientas y Biblioteca fue borrado
manualmente vía el panel de administración el mismo día — confirmado
como intencional por el usuario, no se restauró.

---

# Fase 17 — Despliegue

## Objetivos

Publicar la primera versión.

### Verificar

GitHub Pages.

Dominio.

HTTPS.

SEO.

Analytics.

PWA.

---

# Mejoras futuras

Estas funcionalidades no forman parte de la primera versión.

## Biblioteca

Favoritos.

Historial.

Recomendaciones.

---

## Calendario

Sincronización con Google Calendar.

Exportación.

Recordatorios.

---

## ATP

Área privada.

Gestión de voluntarios.

Panel interno.

Documentación.

---

## Comunidad

Comentarios.

Valoraciones.

Encuestas.

---

## Inteligencia Artificial

Buscador inteligente.

Recomendaciones.

Asistente académico.

---

# Regla para Claude Code

Nunca implementar varias fases al mismo tiempo.

Completar una fase.

Verificar funcionamiento.

Realizar refactorización si corresponde.

Recién entonces comenzar la siguiente.

---

# Criterios de finalización

Una fase se considera terminada únicamente cuando:

* compila sin errores;
* no rompe funcionalidades anteriores;
* respeta el sistema de diseño;
* es responsive;
* es accesible;
* mantiene el rendimiento;
* puede desplegarse sin inconvenientes.

---

# Objetivo final

Construir una plataforma robusta, rápida y escalable que se convierta en el principal punto de encuentro digital de ATP y acompañe a los estudiantes durante toda su trayectoria universitaria.
