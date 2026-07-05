# CONTRIBUTING.md

# Guía de Contribución — ATP Platform

## Objetivo

Este documento define las reglas para colaborar en el desarrollo de ATP Platform.

Se aplica tanto a desarrolladores humanos como a asistentes de IA (Claude Code, ChatGPT, Gemini CLI, Codex, etc.).

El objetivo es mantener un proyecto consistente, fácil de mantener y preparado para crecer durante muchos años.

---

# Filosofía

La plataforma es un producto de largo plazo.

Cada cambio debe dejar el proyecto mejor de lo que estaba.

Antes de escribir código, comprender el problema.

Antes de agregar una dependencia, justificar su necesidad.

Antes de crear un componente, verificar si ya existe uno reutilizable.

---

# Documentación obligatoria

Antes de comenzar cualquier tarea, revisar los siguientes documentos:

1. `CLAUDE.md`
2. `PROJECT.md`
3. `STACK_DECISIONS.md`
4. `TECH.md`
5. `DESIGN.md`
6. `DESIGN_TOKENS.md`
7. `UI_COMPONENTS.md`
8. `CONTENT_SCHEMA.md`
9. `FEATURES.md`
10. `ROADMAP.md`

Ningún cambio importante debe realizarse sin comprender esta documentación.

---

# Flujo de trabajo

Cada tarea debe seguir el siguiente proceso:

1. Comprender el objetivo.
2. Identificar la fase del roadmap correspondiente.
3. Analizar si existen componentes reutilizables.
4. Implementar la solución.
5. Verificar funcionamiento.
6. Revisar accesibilidad.
7. Revisar rendimiento.
8. Eliminar código innecesario.
9. Documentar cambios importantes si corresponde.

Nunca implementar varias funcionalidades distintas en un mismo cambio.

---

# Principios de desarrollo

Todo código debe ser:

* claro;
* modular;
* legible;
* reutilizable;
* tipado;
* fácil de mantener.

La simplicidad tiene prioridad sobre soluciones complejas.

---

# Componentes

Antes de crear un componente nuevo, responder:

> ¿Puede resolverse reutilizando uno existente?

Si la respuesta es sí, reutilizar.

Si la respuesta es no, crear un componente nuevo siguiendo `UI_COMPONENTS.md`.

---

# Estilos

Todo estilo debe respetar:

* `DESIGN.md`
* `DESIGN_TOKENS.md`

No utilizar:

* colores hardcodeados;
* espaciados arbitrarios;
* radios inconsistentes;
* sombras fuera del sistema.

---

# Contenido

Nunca escribir contenido directamente dentro de los componentes.

Toda la información debe provenir del sistema de contenido.

Esto incluye:

* actividades;
* libros;
* noticias;
* carreras;
* herramientas;
* enlaces.

---

# TypeScript

El proyecto utiliza TypeScript estricto.

Evitar:

* `any`
* castings innecesarios
* tipos duplicados

Crear interfaces reutilizables cuando sea necesario.

---

# Accesibilidad

Todo cambio debe verificar:

* navegación mediante teclado;
* foco visible;
* contraste suficiente;
* etiquetas accesibles;
* HTML semántico.

La accesibilidad no es opcional.

---

# Responsive

Todo desarrollo debe probarse primero en móvil.

Luego:

* tablet;
* notebook;
* escritorio.

No crear soluciones exclusivas para escritorio.

---

# Rendimiento

Antes de incorporar una librería, evaluar:

* tamaño;
* impacto en el bundle;
* mantenimiento;
* alternativas nativas.

Evitar dependencias innecesarias.

---

# JavaScript

La plataforma prioriza HTML y CSS.

Agregar JavaScript únicamente cuando aporte una mejora real.

Aprovechar la arquitectura de islas de Astro para hidratar solo los componentes interactivos.

---

# Animaciones

Las animaciones deben:

* ser sutiles;
* comunicar cambios de estado;
* respetar el sistema definido en `DESIGN.md`.

Nunca agregar animaciones únicamente por estética.

---

# SEO

Toda página nueva debe incluir:

* título;
* descripción;
* URL limpia;
* metadatos adecuados.

---

# Contenido multimedia

Optimizar siempre:

* imágenes;
* videos;
* SVG;
* íconos.

No subir recursos más pesados de lo necesario.

---

# Convenciones de nombres

Utilizar inglés para:

* carpetas;
* archivos;
* componentes;
* funciones;
* variables;
* tipos;
* interfaces.

Mantener nombres descriptivos.

Ejemplos:

```text
ActivityCard
BookGrid
SearchBar
CareerSection
```

Evitar abreviaturas ambiguas.

---

# Organización de archivos

Cada archivo debe tener una única responsabilidad.

Evitar archivos excesivamente largos.

Como referencia:

* componentes: preferentemente menos de 300 líneas;
* utilidades: pequeñas y específicas;
* páginas: enfocadas en composición.

---

# Commits

Los commits deben ser pequeños y coherentes.

Utilizar mensajes descriptivos.

Ejemplos:

```text
feat: add activity carousel

fix: improve mobile navigation

refactor: simplify book search

docs: update content schema
```

Evitar commits que mezclen múltiples objetivos.

---

# Pull Requests

Cada Pull Request debe:

* resolver un único problema;
* compilar correctamente;
* respetar el sistema de diseño;
* no introducir regresiones.

Siempre explicar brevemente el propósito del cambio.

---

# Uso de IA

Los asistentes de IA deben:

* leer la documentación antes de proponer cambios;
* respetar la arquitectura existente;
* evitar reescribir código innecesariamente;
* minimizar el consumo de tokens;
* justificar cambios importantes.

No deben modificar el stack tecnológico sin consultar `STACK_DECISIONS.md`.

---

# Refactorización

Refactorizar cuando:

* reduzca complejidad;
* elimine duplicación;
* mejore legibilidad;
* no modifique el comportamiento.

No refactorizar por preferencias personales.

---

# Dependencias

Antes de instalar una nueva dependencia, verificar:

* ¿Existe una solución nativa?
* ¿Ya utilizamos una librería que resuelva este problema?
* ¿La dependencia sigue siendo mantenida?
* ¿Su tamaño está justificado?

Menos dependencias implican menor mantenimiento.

---

# Calidad mínima

Ningún cambio se considera terminado si:

* rompe el diseño;
* rompe el responsive;
* rompe la accesibilidad;
* rompe el SEO;
* rompe el rendimiento;
* genera código duplicado.

---

# Criterios de aceptación

Una contribución se acepta cuando:

* cumple el objetivo funcional;
* respeta la arquitectura;
* mantiene la coherencia visual;
* utiliza componentes reutilizables;
* supera la revisión de calidad;
* no introduce deuda técnica innecesaria.

---

# Cultura del proyecto

ATP Platform no busca acumular funcionalidades.

Busca resolver problemas reales para los estudiantes.

Cada línea de código debe aportar valor.

Cada componente debe existir por una razón.

Cada decisión debe hacer que el proyecto sea más simple, más claro y más fácil de mantener.

---

# Regla final

Si existe una solución más simple, mantenible y coherente con la arquitectura del proyecto, esa es la solución que debe elegirse.

El éxito del proyecto no se mide por la cantidad de código escrito, sino por la calidad de la experiencia que ofrece a los estudiantes y por su capacidad de evolucionar durante muchos años.
