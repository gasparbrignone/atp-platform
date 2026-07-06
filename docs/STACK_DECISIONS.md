# STACK_DECISIONS.md

# Decisiones de Arquitectura y Stack Tecnológico

## Objetivo

Este documento registra las decisiones técnicas fundamentales del proyecto ATP Platform y las razones detrás de cada una.

Su propósito es preservar la coherencia arquitectónica a lo largo del tiempo y evitar cambios innecesarios cuando participen distintos desarrolladores o agentes de IA.

Las decisiones aquí documentadas deben considerarse la arquitectura oficial del proyecto.

---

# Principio general

Antes de proponer reemplazar una tecnología o modificar la arquitectura, debe responderse la siguiente pregunta:

> **¿La nueva propuesta resuelve un problema real que la arquitectura actual no puede resolver?**

Si la respuesta es no, la arquitectura existente debe mantenerse.

La estabilidad tiene prioridad sobre las novedades.

---

# Framework principal

## Decisión

Utilizar **Astro** como framework principal.

## Motivos

Astro permite construir sitios extremadamente rápidos mediante generación estática.

Es ideal para un proyecto donde la mayor parte del contenido es informativo y cambia con frecuencia, pero no requiere procesamiento en tiempo real.

Además:

* genera muy poco JavaScript;
* ofrece excelente SEO;
* facilita el despliegue en GitHub Pages;
* permite incorporar componentes interactivos únicamente cuando son necesarios (Islands Architecture);
* mantiene una excelente experiencia tanto para usuarios como para desarrolladores.

## No utilizar

No migrar a otro framework únicamente porque sea más popular o reciente.

Una migración solo se justificará si existe una limitación técnica real.

---

# Lenguaje

## Decisión

Utilizar TypeScript.

## Motivos

* Mayor seguridad.
* Menor cantidad de errores.
* Mejor autocompletado.
* Código más mantenible.
* Mejor experiencia para futuros colaboradores.

## Regla

Evitar el uso de `any`.

El tipado estricto es parte de la calidad del proyecto.

---

# Estilos

## Decisión

Utilizar Tailwind CSS junto con el sistema de Design Tokens.

## Motivos

* Consistencia.
* Rapidez de desarrollo.
* Reutilización.
* Fácil mantenimiento.
* Excelente integración con Astro.

Los estilos deben construirse mediante componentes reutilizables.

---

# Sistema de diseño

## Decisión

Todo el diseño debe apoyarse en:

* `DESIGN.md`
* `DESIGN_TOKENS.md`
* `UI_COMPONENTS.md`

## Motivos

Separar claramente:

* identidad visual;
* implementación;
* componentes.

Esto evita inconsistencias a medida que el proyecto crece.

---

# Contenido

## Decisión

Separar completamente el contenido del código.

## Motivos

La mayor parte de las actualizaciones del sitio serán cambios de contenido y no cambios de programación.

Los administradores no deberían modificar componentes para actualizar:

* actividades;
* biblioteca;
* noticias;
* herramientas.

---

# CMS

## Decisión

Utilizar un CMS compatible con una arquitectura estática y GitHub Pages.

La opción utilizada es **Sveltia CMS** (sucesor de facto de Decap CMS, mismo
`config.yml`). Se empezó con Decap CMS; se migró a Sveltia porque el login
vía Netlify (Netlify Identity) quedó discontinuado por Netlify — ver
`docs/CMS_SETUP.md` para el detalle. Sveltia además permite login con un
Personal Access Token de GitHub, sin depender de ningún proveedor externo.

## Motivos

* gratuito;
* basado en Git;
* simple de administrar;
* sin backend propio;
* fácil de mantener.

## Regla

Evitar desarrollar un panel de administración personalizado salvo que aparezca una necesidad concreta que el CMS no pueda resolver.

---

# Hosting

## Decisión

GitHub Pages, con dominio propio: **atpfcm.com.ar** (comprado en nic.ar).
Al ser un dominio propio en la raíz (no un project site tipo
`usuario.github.io/repo`), no hace falta configurar `base` en Astro — los
links internos absolutos del sitio no se rompen. DNS/CNAME y la puesta en
marcha del hosting quedan para la Fase 17 (Despliegue); `site` ya está
configurado en `astro.config.mjs` para que el resto de la Fase 11 (SEO)
pueda generar URLs absolutas correctas.

## Motivos

* gratuito;
* confiable;
* suficiente para un sitio estático;
* integración directa con GitHub;
* mantenimiento mínimo.

---

# Base de datos

## Decisión

No utilizar una base de datos en la primera versión.

## Motivos

Actualmente toda la información puede almacenarse como contenido estructurado.

Agregar una base de datos aumentaría la complejidad sin aportar beneficios proporcionales.

## Futuro

Si aparecen funcionalidades que realmente requieran persistencia dinámica (usuarios, autenticación, etc.), la decisión podrá revisarse.

---

# Formularios

## Decisión

Continuar utilizando Google Forms.

## Motivos

Es una herramienta conocida por ATP.

Permite administrar inscripciones rápidamente.

No requiere infraestructura adicional.

La arquitectura deberá permitir reemplazarla en el futuro sin modificar la interfaz.

---

# Biblioteca

## Decisión

Los archivos permanecerán almacenados en Google Drive.

La plataforma actuará como un catálogo inteligente.

## Motivos

No es necesario duplicar almacenamiento.

Google Drive ya forma parte del flujo de trabajo de ATP.

El valor agregado estará en la experiencia de búsqueda y organización.

---

# Buscador

## Decisión

Implementar búsqueda completamente local.

## Motivos

* mayor velocidad;
* sin dependencias externas;
* menor costo;
* funcionamiento incluso con conexiones lentas.

---

# Internacionalización

## Decisión

Idioma inicial:

Español.

Arquitectura preparada para incorporar portugués.

## Motivos

Actualmente el público principal es hispanohablante, pero ATP también desarrolla actividades dirigidas a estudiantes brasileños.

Preparar la arquitectura desde el inicio evita futuras reestructuraciones.

---

# Diseño

## Decisión

Inspirarse en Apple.

## Motivos

Se busca transmitir:

* simplicidad;
* elegancia;
* claridad;
* modernidad;
* excelente experiencia de usuario.

No se pretende copiar la estética de Apple, sino adoptar sus principios de diseño.

---

# Mobile First

## Decisión

Diseñar primero para dispositivos móviles.

## Motivos

La mayoría de los usuarios accederá desde teléfonos celulares.

El escritorio debe considerarse una adaptación, no el punto de partida.

---

# Modo oscuro

## Decisión

Implementar modo claro, oscuro y automático.

## Motivos

Mejora la experiencia de usuario y se integra con las preferencias del sistema operativo.

---

# SEO

## Decisión

Optimizar el SEO desde la primera versión.

## Motivos

ATP quiere posicionarse como referencia para búsquedas relacionadas con:

* Medicina UNR;
* recursos académicos;
* biblioteca digital;
* herramientas para estudiantes.

El SEO no debe agregarse al final del proyecto.

Debe formar parte de la arquitectura.

---

# Rendimiento

## Decisión

El rendimiento es un requisito funcional.

## Objetivos

Lighthouse:

* Performance ≥ 95.
* Accessibility ≥ 95.
* Best Practices ≥ 95.
* SEO ≥ 95.

Si una funcionalidad compromete significativamente estos objetivos, debe replantearse.

---

# Accesibilidad

## Decisión

Cumplir WCAG AA.

## Motivos

La accesibilidad forma parte de la calidad del producto.

No es una mejora opcional.

---

# Soporte de navegadores

## Decisión

No se fija una lista de versiones exactas, pero el proyecto se apoya en HTML nativo moderno (por ejemplo `<dialog>` con `showModal()` para el menú móvil) en vez de reimplementar esos widgets a mano. Eso fija un piso implícito:

* Chrome/Edge 37+
* Firefox 98+
* Safari 15.4+ (macOS y iOS)

Todas anteriores a 2022; en la práctica, cualquier navegador actualizado los cubre.

## Motivos

Usar `<dialog>` nativo da foco atrapado, cierre con Escape y semántica modal correcta gratis, en vez de reconstruir eso (peor, con más código y más riesgo de bugs de accesibilidad) para soportar navegadores que ya casi nadie usa.

## Regla

Antes de usar una API web nueva, verificar que esté soportada en ese piso. Si un navegador objetivo no la soporta, implementar un fallback liviano (degradar funcionalidad, no reconstruir todo el widget) o documentar la limitación acá.

## Casos conocidos

* **iOS Safari — bloqueo de scroll de fondo**: `overflow: hidden` en `<html>`/`<body>` no bloquea de forma confiable el scroll táctil en iOS Safari (bug de WebKit, no relacionado con `<dialog>`). El menú móvil usa en su lugar la técnica de fijar el `<body>` con `position: fixed` en el scroll actual (ver `MobileMenu.astro`).
* **Navegadores sin `showModal()`**: el menú móvil detecta su ausencia y degrada a un panel no modal (sin atrapa-foco ni cierre nativo con Escape, pero sí utilizable) en vez de romperse.

---

# Componentes

## Decisión

Toda la interfaz debe construirse mediante componentes reutilizables.

## Motivos

* menor duplicación;
* mayor consistencia;
* mantenimiento sencillo;
* escalabilidad.

---

# Animaciones

## Decisión

Utilizar animaciones sutiles inspiradas en Apple.

## Motivos

Las animaciones deben mejorar la comprensión de la interfaz, no llamar la atención sobre sí mismas.

---

# Analíticas

## Decisión

Incorporar analíticas respetando la privacidad y con un impacto mínimo en el rendimiento.

## Objetivos

Comprender:

* qué buscan los estudiantes;
* qué recursos utilizan;
* qué actividades generan más interés.

Las métricas deben servir para mejorar el producto, no para recopilar datos innecesarios.

---

# Inteligencia Artificial

## Decisión

Toda IA utilizada para colaborar en el proyecto debe respetar esta documentación.

No debe proponer cambios de arquitectura sin una justificación técnica clara.

Antes de modificar el stack, deberá analizar:

* `CLAUDE.md`;
* `PROJECT.md`;
* `TECH.md`;
* este documento.

---

# Revisión de decisiones

Las decisiones aquí registradas no son inmutables.

Podrán revisarse cuando exista una razón objetiva, por ejemplo:

* limitaciones técnicas demostrables;
* cambios importantes en el ecosistema;
* nuevos requisitos funcionales.

Las preferencias personales o las modas tecnológicas no constituyen una razón suficiente para modificar la arquitectura.

---

# Regla final

La arquitectura de ATP Platform debe evolucionar de forma consciente.

Cada nueva decisión técnica debe responder a una necesidad real, documentarse en este archivo y contribuir a que la plataforma siga siendo rápida, simple, mantenible y útil para la comunidad estudiantil durante muchos años.
