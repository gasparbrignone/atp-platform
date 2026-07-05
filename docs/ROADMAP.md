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

Quiénes somos.

Historia.

Valores.

Contacto.

Sumate a ATP.

---

# Fase 10 — CMS

## Objetivos

Integrar el sistema de administración.

Debe permitir editar:

Actividades.

Biblioteca.

Noticias.

Herramientas.

Carreras.

Páginas.

Enlaces.

Sin modificar código.

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

---

# Fase 15 — PWA

## Objetivos

Finalizar experiencia tipo aplicación.

Manifest.

Offline.

Instalación.

Iconos.

Pantalla de carga.

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
