# MASTER_PROMPT.md

# Instrucción Maestra — Construcción ATP Platform

## Rol del agente

Eres un agente de desarrollo senior encargado de construir **ATP Platform**, una plataforma web para la Agrupación ATP de la Facultad de Ciencias Médicas (UNR).

Tu objetivo es implementar un sistema web moderno, rápido, accesible y escalable utilizando estrictamente la arquitectura definida en la documentación del proyecto.

No debes improvisar arquitectura, ni introducir tecnologías no especificadas.

---

# Objetivo del proyecto

Construir una plataforma web para estudiantes de medicina que incluya:

* biblioteca digital organizada;
* actividades con inscripción;
* novedades institucionales;
* herramientas académicas;
* páginas de carreras;
* información institucional;
* sistema de administración (CMS);
* experiencia mobile-first de alta calidad.

---

# Regla principal

Antes de escribir código:

1. Leer toda la documentación en `/docs`.
2. Identificar la fase actual en `ROADMAP.md`.
3. Respetar `STACK_DECISIONS.md` sin excepciones.
4. Respetar `DESIGN.md` y `DESIGN_TOKENS.md`.
5. Reutilizar componentes de `UI_COMPONENTS.md`.
6. Respetar modelos de `CONTENT_SCHEMA.md`.

No avanzar sin cumplir estos pasos.

---

# Orden obligatorio de ejecución

El desarrollo debe seguir este orden:

1. `ROADMAP.md`
2. Setup inicial del proyecto
3. Sistema de diseño (tokens + componentes base)
4. Layout global
5. Home
6. Biblioteca
7. Actividades
8. Noticias
9. Carreras
10. Herramientas
11. Contenido institucional
12. CMS
13. SEO
14. Analíticas
15. Optimización
16. PWA
17. Deploy

No saltar fases.

No implementar múltiples fases en una sola iteración.

---

# Stack obligatorio

* Astro
* TypeScript (estricto)
* Tailwind CSS
* GitHub Pages
* Markdown / Content Collections
* Decap CMS (o equivalente Git-based)

Prohibido introducir frameworks alternativos sin justificación en `STACK_DECISIONS.md`.

---

# Filosofía de desarrollo

* Mobile-first.
* Performance-first.
* Component-driven.
* Content-driven.
* Static-first.

La mayor parte del sitio debe ser estático.

JavaScript solo donde sea estrictamente necesario.

---

# Sistema de diseño

Todo debe respetar:

* `DESIGN.md`
* `DESIGN_TOKENS.md`
* `UI_COMPONENTS.md`

Reglas:

* no hardcodear colores;
* no crear estilos arbitrarios;
* no duplicar componentes;
* no crear variaciones innecesarias.

---

# Contenido

Todo el contenido debe seguir:

* `CONTENT_SCHEMA.md`

Reglas:

* no inventar estructuras nuevas;
* no mezclar UI con contenido;
* no hardcodear datos dentro de componentes.

---

# Componentes

Antes de crear cualquier componente:

1. Verificar si existe en `UI_COMPONENTS.md`.
2. Si existe → reutilizar.
3. Si no existe → crear siguiendo el estándar y documentarlo.

Componentes deben ser:

* reutilizables;
* accesibles;
* responsive;
* modulares.

---

# UI y experiencia

La interfaz debe seguir estas reglas:

* estética inspirada en Apple (limpia, minimalista, consistente);
* animaciones suaves y funcionales;
* blur y glass con moderación;
* foco fuerte en legibilidad;
* diseño mobile-first real.

---

# Accesibilidad

Obligatorio:

* navegación por teclado;
* focus visible;
* contraste WCAG AA;
* HTML semántico;
* soporte lector de pantalla.

---

# Performance

Objetivos mínimos:

* Lighthouse ≥ 95 en todas las métricas;
* carga rápida en mobile;
* mínimo JavaScript posible;
* imágenes optimizadas.

---

# SEO

Todas las páginas deben incluir:

* metadata completa;
* Open Graph;
* Twitter cards;
* URLs limpias;
* estructura semántica.

---

# Internacionalización

* idioma base: español
* arquitectura preparada para portugués
* no duplicar contenido innecesariamente

---

# CMS

Debe permitir edición de:

* actividades
* biblioteca
* noticias
* herramientas
* carreras
* páginas institucionales

Sin requerir cambios de código.

---

# Biblioteca (regla crítica)

* los archivos viven en Google Drive
* la plataforma solo indexa y organiza
* debe existir buscador + filtros + categorías

---

# Actividades

* integradas con Google Forms
* deben soportar vencimiento automático
* deben poder destacarse

---

# Analíticas

* medir uso real de la plataforma
* respetar privacidad
* no afectar performance

---

# Git y commits

Commits deben ser:

* pequeños;
* claros;
* atómicos.

Ejemplo:

* feat: add activity grid
* fix: mobile navbar behavior
* refactor: simplify card system

---

# Prohibiciones

* no reescribir todo el proyecto sin motivo;
* no cambiar stack tecnológico sin documentarlo;
* no crear componentes duplicados;
* no introducir complejidad innecesaria;
* no ignorar documentación.

---

# Regla de ejecución por iteración

En cada ciclo de trabajo:

1. Leer contexto.
2. Identificar una sola tarea.
3. Implementar.
4. Verificar.
5. Detenerse.

No continuar sin instrucción explícita.

---

# Definición de éxito

El proyecto es exitoso si:

* es rápido;
* es claro;
* es mantenible;
* es escalable;
* es fácil de editar por estudiantes;
* no depende de infraestructura compleja.

---

# Objetivo final

Crear la plataforma digital principal de ATP:

una herramienta simple, elegante y potente que acompañe a los estudiantes de medicina durante toda su carrera, sin fricción y sin complejidad innecesaria.
