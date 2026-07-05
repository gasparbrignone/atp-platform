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

---

# Documentación principal

## PROJECT.md

**Propósito:**

Describe la visión general del proyecto.

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

Registra las decisiones técnicas y sus justificaciones.

**Consultar cuando:**

* se propone cambiar una tecnología;
* se evalúa reemplazar el framework o librerías;
* se cuestiona una decisión arquitectónica existente.

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

Describe las funcionalidades del sistema.

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

Define la estructura de datos de todos los contenidos.

**Consultar cuando:**

* se crean modelos de datos;
* se implementa el CMS;
* se define estructura de actividades, libros, noticias, etc.

---

## ROADMAP.md

**Propósito:**

Define el orden de construcción del proyecto.

**Consultar cuando:**

* se planifica el desarrollo;
* se decide qué implementar primero;
* se valida el progreso por fases.

---

## CONTRIBUTING.md

**Propósito:**

Define reglas de colaboración y desarrollo.

**Consultar cuando:**

* se trabaja en código nuevo;
* se revisan estándares de calidad;
* se realizan pull requests o commits.

---

## TODO.md

**Propósito:**

Lista de tareas del proyecto.

**Consultar cuando:**

* se busca qué implementar a continuación;
* se revisa el estado general del desarrollo;
* se planifica trabajo incremental.

---

## MASTER_PROMPT.md (futuro)

**Propósito:**

Instrucciones operativas para agentes de IA.

**Consultar cuando:**

* se inicia el proyecto desde cero;
* se utiliza Claude Code u otro agente para desarrollo automatizado.

---

# Flujo recomendado de consulta

Cuando se inicia una tarea:

1. Consultar `ROADMAP.md` para saber la fase actual.
2. Consultar `TECH.md` para entender arquitectura.
3. Consultar `UI_COMPONENTS.md` para reutilización de UI.
4. Consultar `CONTENT_SCHEMA.md` para estructuras de datos.
5. Consultar el documento específico del área afectada.

---

# Regla general

Nunca comenzar a implementar sin haber identificado primero el documento relevante.

La documentación no es opcional: es parte del sistema.

---

# Objetivo del sistema

Este conjunto de documentos existe para asegurar que ATP Platform:

* sea coherente;
* sea mantenible;
* sea escalable;
* tenga una arquitectura clara;
* y pueda ser desarrollada por múltiples personas o agentes sin perder consistencia.

La calidad del proyecto depende directamente de qué tan bien se respete esta documentación.
