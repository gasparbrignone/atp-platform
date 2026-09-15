# INDEX.md

# Índice General de Documentación — Plataforma ATP

## Objetivo

Este documento funciona como mapa central de toda la documentación del proyecto ATP Platform.

Su finalidad es ayudar a desarrolladores y asistentes de IA a encontrar rápidamente qué archivo consultar según el tipo de tarea.

---

# Uso del índice

Antes de realizar cualquier cambio en el proyecto:

1. Identificar el tipo de tarea.
2. Consultar el documento correspondiente.
3. Seguir sus reglas antes de implementar.

**Antes que nada**, si el cambio es "no trivial" (nueva funcionalidad, nueva dependencia, nueva ruta/endpoint, cambio de CI/CD, cambio de CMS, cambio de deployment), leer primero `SECURITY.md` + `docs/SECURITY_DECISIONS.md` + `docs/SECURITY_CHECKLIST.md` — este gate está definido en `CLAUDE.md` y es prioritario sobre el resto de esta lista.

---

# Documentación principal

## CLAUDE.md (raíz del repo, no en `docs/`)

**Propósito:** Reglas de desarrollo permanentes para agentes de IA que trabajan en este repo (principios de calidad, arquitectura, performance, accesibilidad, seguridad, optimización de tokens).

**Consultar:** siempre, al empezar cualquier tarea de código.

---

## SECURITY.md (raíz del repo, no en `docs/`)

**Propósito:** Postura de seguridad técnica actual del sistema completo — qué protege qué, qué riesgos se aceptaron conscientemente y por qué.

**Consultar cuando:** se toca autenticación, secretos, CSP, endpoints públicos, o cualquier cambio no trivial (ver gate arriba).

---

## docs/SECURITY_DECISIONS.md

**Propósito:** Registro vivo y fechado de decisiones de seguridad — problema, alternativas consideradas, decisión, motivo, riesgo residual, y si sigue vigente o fue superada. El documento mejor mantenido del proyecto.

**Consultar cuando:** antes de repetir un patrón de seguridad ya evaluado, o para entender por qué algo se hizo de una forma que no parece la más obvia.

---

## docs/SECURITY_CHECKLIST.md

**Propósito:** Checklist de verificación previo a cerrar un cambio no trivial (secretos, exposición de datos, CI/CD, CSP, blast radius, no repetir un hallazgo histórico).

**Consultar cuando:** justo antes de dar un cambio por terminado, si aplica el gate de arriba.

---

## docs/SECURITY_CHANGELOG.md

**Propósito:** Bitácora cronológica de qué cambió y cuándo, en pareja con `SECURITY_DECISIONS.md` (que explica el "por qué").

**Consultar cuando:** se necesita reconstruir el orden temporal de los cambios de seguridad.

---

## PROJECT.md

**Propósito:** Describe la visión general del proyecto.

**Consultar cuando:**

* se necesita entender qué es ATP Platform;
* se quiere comprender el objetivo del producto;
* se trabaja en decisiones estratégicas de alto nivel.

---

## TECH.md

**Propósito:**

Define la arquitectura técnica del proyecto.

**Consultar cuando:**

* se implementa nueva funcionalidad;
* se definen decisiones de ingeniería;
* se evalúa estructura del sistema;
* se trabaja sobre integración de tecnologías.

---

## STACK_DECISIONS.md

**Propósito:**

Registra las decisiones técnicas y sus justificaciones (por qué Astro, por qué Sveltia, por qué GitHub Pages, por qué Cloudflare R2 para la Biblioteca, etc.).

**Consultar cuando:**

* se propone cambiar una tecnología;
* se evalúa reemplazar el framework o librerías;
* se cuestiona una decisión arquitectónica existente.

---

## docs/CMS_SETUP.md

**Propósito:** Cómo entrar y publicar contenido en el CMS real (Sveltia CMS, login con token de GitHub).

**Consultar cuando:** alguien necesita acceso al panel `/admin`, o se toca `public/admin/config.yml`.

---

## docs/GOOGLE_SHEETS_FORM_SETUP.md

**Propósito:** Espejo saneado (secretos reemplazados por placeholders) del backend real del sitio — un Google Apps Script que corre fuera de este repo. Documenta cada acción del panel de staff, registros, certificados, check-in por QR, y las decisiones/bugs de producción de cada una.

**Consultar cuando:** se toca cualquier cosa de `/staff/`, formularios públicos, certificados, campañas de mail, o check-in por QR — **antes de tocar código, porque el código real vive fuera de este repo y solo se puede editar leyendo y luego pegando el script completo en el editor de Apps Script**.

---

## DESIGN.md

**Propósito:**

Define la identidad visual del proyecto.

**Consultar cuando:**

* se diseña la interfaz;
* se definen estilos generales;
* se trabaja en estética o UI global.

---

## DESIGN_TOKENS.md

**Propósito:**

Define todos los valores de diseño reutilizables.

**Consultar cuando:**

* se aplican colores, espaciados o tipografía;
* se crean componentes visuales;
* se ajusta consistencia visual.

---

## UI_COMPONENTS.md

**Propósito:**

Define el sistema de componentes reutilizables.

**Consultar cuando:**

* se crea o modifica UI;
* se construyen componentes nuevos;
* se evalúa reutilización de componentes existentes.

---

## FEATURES.md

**Propósito:**

Describe las funcionalidades del sistema, por prioridad.

**Consultar cuando:**

* se implementan nuevas funcionalidades;
* se define comportamiento del sistema;
* se planifica el desarrollo de módulos.

---

## CONTENT.md

**Propósito:**

Define cómo debe escribirse, organizarse y estructurarse el contenido.

**Consultar cuando:**

* se agregan o editan textos;
* se define organización editorial;
* se revisa consistencia del contenido.

---

## CONTENT_SCHEMA.md

**Propósito:**

Describe, en criollo, qué representa cada colección de contenido real y por qué está armada así. Para el esquema técnico exacto (campos, tipos, obligatorio/opcional), la fuente de verdad es siempre `src/content.config.ts` — este documento nunca debe copiarlo campo por campo, porque se desincroniza.

**Consultar cuando:**

* se agrega un campo a una colección existente;
* se evalúa crear una colección nueva;
* se necesita entender qué colecciones existen hoy y para qué sirve cada una.

---

## docs/ANALYTICS_SETUP.md

**Propósito:** Runbook de GoatCounter (analíticas sin cookies) + Microsoft Clarity (grabación de sesión) — qué está conectado y qué falta configurar a mano.

**Consultar cuando:** se agrega una nueva fuente externa al CSP, o se necesita saber qué se mide y qué no.

---

## docs/YOUTUBE_SETUP.md

**Propósito:** Runbook de la clave de la API de YouTube (grilla de últimos videos del home).

**Consultar cuando:** la clave vence o hay que rotarla.

---

## docs/SEARCH_CONSOLE_SETUP.md

**Propósito:** Diagnóstico puntual (2026-07-08) de por qué el sitio no aparecía en Google al principio, y los pasos manuales de Search Console. Es un documento de un momento puntual, no arquitectura permanente.

**Consultar cuando:** se investiga un problema de indexación/SEO.

---

## ROADMAP.md

**Propósito:**

Define el orden de construcción del proyecto, fase por fase, con notas de cierre reales cuando una fase termina.

**Consultar cuando:**

* se planifica el desarrollo;
* se decide qué implementar primero;
* se valida el progreso por fases.

---

## CONTRIBUTING.md

**Propósito:**

Define reglas de colaboración y desarrollo, para humanos y para varios asistentes de IA (Claude Code, ChatGPT, Gemini CLI, Codex).

**Consultar cuando:**

* se trabaja en código nuevo;
* se revisan estándares de calidad;
* se realizan pull requests o commits.

---

## TODO.md

**Propósito:**

Estado real del desarrollo — qué está hecho, qué está en curso, qué quedó fuera de alcance.

**Consultar cuando:**

* se busca qué implementar a continuación;
* se revisa el estado general del desarrollo;
* se planifica trabajo incremental.

---

## MASTER_PROMPT.md

**Propósito:**

Prompt de arranque usado para construir el proyecto desde cero (fase 0). Es un artefacto histórico del inicio del proyecto, no una regla de trabajo vigente hoy — el proyecto ya no está en esa etapa. Se conserva como referencia de cómo se planteó originalmente el proyecto completo.

**Consultar cuando:** se necesita reconstruir la intención original de una fase temprana, o se arranca un proyecto nuevo con la misma metodología.

---

# Flujo recomendado de consulta

Cuando se inicia una tarea:

1. Si el cambio es no trivial, leer primero `SECURITY.md` + `docs/SECURITY_DECISIONS.md` (ver gate arriba).
2. Consultar `TODO.md` para saber el estado real actual.
3. Consultar `TECH.md`/`STACK_DECISIONS.md` para entender arquitectura y por qué se eligió lo que hay.
4. Consultar `UI_COMPONENTS.md` para reutilización de UI (y verificar contra `src/components/` si algo no cierra — este doc se desincroniza).
5. Consultar `src/content.config.ts` directamente para estructuras de datos reales (no `CONTENT_SCHEMA.md` para el detalle técnico).
6. Consultar el documento específico del área afectada.

---

# Regla general

Nunca comenzar a implementar sin haber identificado primero el documento relevante.

La documentación no es opcional: es parte del sistema.

Pero un documento que dice algo que el código contradice NO es la fuente de verdad — avisar y corregir el documento, no forzar el código a coincidir con un documento desactualizado.

---

# Objetivo del sistema

Este conjunto de documentos existe para asegurar que ATP Platform:

* sea coherente;
* sea mantenible;
* sea escalable;
* tenga una arquitectura clara;
* y pueda ser desarrollada por múltiples personas o agentes sin perder consistencia.

La calidad del proyecto depende directamente de qué tan bien se respete esta documentación.

---

# Gatillo de actualización de este índice

Actualizar este archivo cuando:

* se crea, borra o renombra un documento en `docs/` o en la raíz del repo;
* se descubre que la descripción de un documento acá ya no coincide con su propósito real;
* una auditoría de documentación (como la de 2026-09-14) encuentra un documento faltante en esta lista.

No hace falta tocarlo por cambios de contenido dentro de un documento ya listado — solo cuando cambia el mapa en sí.
