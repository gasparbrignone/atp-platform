# TECH.md

# Arquitectura Técnica — Plataforma ATP

## Objetivo

Este documento define la arquitectura técnica de la plataforma ATP.

Toda decisión de ingeniería debe respetar estas especificaciones.

El objetivo es construir una plataforma:

* rápida
* escalable
* mantenible
* gratuita
* preparada para crecer durante muchos años

La simplicidad debe prevalecer sobre la complejidad.

---

# Principios técnicos

Toda decisión debe optimizar, en este orden:

1. Mantenibilidad.
2. Simplicidad.
3. Rendimiento.
4. Escalabilidad.
5. Experiencia del usuario.
6. Experiencia del desarrollador.

---

# Tecnologías principales

## Framework

Astro.

La plataforma se desarrollará utilizando Astro como framework principal.

Motivos:

* Excelente rendimiento.
* Generación de sitio estático.
* Ideal para GitHub Pages.
* Excelente SEO.
* Componentes reutilizables.
* Soporte para islas de interactividad.
* Escalable.

---

## Lenguaje

TypeScript.

Debe utilizarse tipado estricto.

Evitar `any`.

---

## Estilos

Tailwind CSS.

Toda la interfaz debe construirse utilizando el sistema de diseño definido en los documentos correspondientes.

No escribir CSS repetitivo.

No utilizar estilos inline salvo casos excepcionales.

---

## Componentes

Toda la interfaz debe construirse mediante componentes reutilizables.

Evitar componentes gigantes.

Cada componente debe tener una única responsabilidad.

---

# Arquitectura general

La plataforma debe dividirse en cuatro capas.

## Presentación

Layouts.

Páginas.

Componentes.

---

## Contenido

Colecciones.

Archivos Markdown.

JSON cuando corresponda.

---

## Lógica

Utilidades.

Funciones.

Hooks cuando sean necesarios.

Servicios.

---

## Configuración

Tokens.

Configuraciones.

Constantes.

Tipos.

---

# Organización del proyecto

La estructura debe mantenerse ordenada.

Ejemplo:

```text
src/

components/

layouts/

pages/

content/

lib/

services/

styles/

types/

config/

assets/

public/
```

Evitar carpetas con múltiples responsabilidades.

---

# Componentes

Todos los componentes deben ser reutilizables.

Ejemplos:

Navbar

Footer

Button

Card

BookCard

ActivityCard

Carousel

Hero

SearchBar

FilterPanel

Modal

Badge

Toast

Calendar

Nunca crear componentes duplicados.

---

# Contenido

Todo el contenido debe vivir fuera del código.

Nunca escribir información directamente dentro de un componente.

Toda la información debe poder modificarse sin editar lógica.

---

# Biblioteca

La biblioteca utilizará una colección de contenido.

Cada recurso deberá contener metadatos estructurados.

Ejemplo:

* título
* autor
* carrera
* materia
* año
* edición
* tipo
* enlace
* portada
* etiquetas

Esto permitirá implementar filtros y búsquedas sin modificar la interfaz.

---

# Actividades

Cada actividad deberá definirse como contenido.

Debe incluir:

Título.

Descripción.

Imagen.

Fecha.

Hora.

Formulario.

Estado.

Categoría.

La interfaz nunca debe depender de datos hardcodeados.

---

# Noticias

Las noticias seguirán el mismo enfoque.

Cada noticia será una entrada independiente.

---

# CMS

La plataforma debe contar con un sistema de administración sencillo.

Objetivos:

Permitir agregar contenido sin modificar código.

Gestionar:

Actividades.

Noticias.

Biblioteca.

Herramientas.

Carreras.

El CMS debe ser compatible con una arquitectura estática y despliegue en GitHub Pages.

---

# Imágenes

Todas las imágenes deben optimizarse automáticamente.

Generar múltiples tamaños cuando corresponda.

Priorizar formatos modernos.

Implementar carga diferida para contenido fuera de pantalla.

---

# Buscador

La búsqueda debe realizarse localmente.

No depender de servidores externos.

Debe permitir filtrar por:

Materia.

Carrera.

Autor.

Tipo.

Año.

Palabras clave.

La respuesta debe ser inmediata.

---

# Internacionalización

Preparar la arquitectura para múltiples idiomas.

Idioma inicial:

Español.

Idioma futuro:

Portugués.

Todo el contenido debe poder traducirse sin modificar componentes.

---

# Analíticas

La plataforma debe permitir medir:

Visitas.

Descargas.

Clics.

Búsquedas.

Participación.

Las herramientas elegidas deberán priorizar:

Privacidad.

Bajo impacto en rendimiento.

Facilidad de integración.

---

# SEO

Cada página debe generar automáticamente:

Título.

Descripción.

Open Graph.

Twitter Cards.

Canonical.

Datos estructurados cuando correspondan.

Las URLs deben ser limpias y legibles.

---

# Progressive Web App

La aplicación debe estar preparada para funcionar como PWA.

Debe incluir:

Manifest.

Íconos.

Pantalla de inicio.

Tema.

Funcionamiento offline para recursos estáticos cuando sea posible.

---

# Modo oscuro

El modo oscuro debe implementarse mediante el sistema de tokens.

No mediante inversiones automáticas de color.

---

# Accesibilidad

Todo el desarrollo debe cumplir WCAG AA.

Priorizar:

HTML semántico.

ARIA cuando corresponda.

Contraste adecuado.

Navegación mediante teclado.

Estados de foco visibles.

---

# Rendimiento

Objetivos mínimos:

Performance Lighthouse > 95.

Accessibility > 95.

Best Practices > 95.

SEO > 95.

Optimizar especialmente:

JavaScript.

Imágenes.

Fuentes.

CSS.

---

# Gestión del estado

Mantener el estado lo más local posible.

Evitar estados globales innecesarios.

La simplicidad es prioritaria.

---

# Formularios

Los formularios inicialmente utilizarán Google Forms.

La arquitectura debe permitir reemplazarlos posteriormente sin modificar la interfaz.

---

# Integraciones externas

Toda integración deberá encapsularse.

Nunca distribuir lógica de servicios externos por múltiples componentes.

---

# Seguridad

Nunca almacenar secretos en el repositorio.

Validar entradas del usuario cuando corresponda.

Evitar dependencias innecesarias.

Mantener las librerías actualizadas.

---

# Control de versiones

El proyecto utilizará Git.

Cada cambio debe ser pequeño, coherente y fácil de revisar.

Evitar modificaciones masivas innecesarias.

---

# Calidad del código

Todo el código debe ser:

Legible.

Modular.

Tipado.

Documentado cuando sea necesario.

Sin duplicaciones.

Sin código muerto.

Sin archivos sin uso.

---

# Convenciones

Utilizar inglés para:

Carpetas.

Archivos.

Variables.

Funciones.

Interfaces.

Tipos.

Mantener consistencia en todo el proyecto.

---

# Estrategia de crecimiento

Toda nueva funcionalidad debe poder agregarse sin reestructurar el proyecto.

La arquitectura debe favorecer la evolución continua.

---

# Criterio de decisión

Ante dos soluciones técnicamente válidas, siempre elegir la que:

* requiera menos mantenimiento;
* reduzca la complejidad;
* facilite futuras modificaciones;
* mejore el rendimiento;
* aproveche mejor las capacidades de Astro.

---

# Regla final

La plataforma debe sentirse como un producto profesional.

No como un proyecto estudiantil improvisado.

Cada decisión técnica debe contribuir a construir una base sólida que permita a ATP seguir creciendo durante muchos años sin necesidad de rehacer la aplicación.
