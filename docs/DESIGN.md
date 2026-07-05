# DESIGN.md

# Sistema de Diseño — Plataforma ATP

## Objetivo

Este documento define las reglas del sistema de diseño de la plataforma de ATP.

Todas las decisiones visuales, de interfaz y experiencia de usuario deben respetar este documento.

El objetivo es lograr una identidad consistente, moderna, limpia y fácilmente reconocible.

La plataforma debe transmitir la sensación de ser un producto digital de alta calidad, sin perder la cercanía propia de una agrupación estudiantil.

---

# Filosofía visual

La interfaz debe transmitir:

* claridad
* organización
* confianza
* modernidad
* cercanía
* simpleza
* dinamismo

Nunca debe sentirse:

* corporativa
* burocrática
* recargada
* infantil
* agresiva
* improvisada

Cada pantalla debe respirar.

El espacio en blanco forma parte del diseño.

---

# Inspiración

La referencia principal es el lenguaje visual utilizado por Apple.

También pueden tomarse referencias de:

* Apple.com
* iOS
* Airbnb
* Linear
* Notion
* Arc Browser

No se deben copiar interfaces.

Se debe adoptar la filosofía de diseño.

---

# Principios de diseño

Toda pantalla debe cumplir estas reglas.

## Menos es más

Antes de agregar un elemento nuevo preguntarse:

¿Realmente ayuda al estudiante?

Si no aporta valor, eliminarlo.

---

## Priorizar la información importante

La atención del usuario debe dirigirse naturalmente hacia:

* actividades
* recursos
* biblioteca
* herramientas
* botones de acción

Nunca competir visualmente con demasiados elementos.

---

## Consistencia

Los mismos componentes deben verse y comportarse siempre igual.

Un botón nunca debe cambiar de estilo según la página.

Una tarjeta nunca debe reinventarse.

Los patrones deben repetirse.

---

# Mobile First

El diseño comienza en celular.

Luego se adapta a tablet.

Finalmente a escritorio.

Nunca al revés.

---

# Responsive

Diseñar considerando como mínimo:

320 px

375 px

390 px

430 px

768 px

1024 px

1280 px

1536 px

---

# Paleta de colores

## Color principal

ATP Rosa

HEX:

#F969D7

Debe utilizarse para:

* botones principales
* llamados a la acción
* elementos destacados
* enlaces importantes

Nunca abusar del color.

Debe conservar fuerza visual.

---

## Color secundario

ATP Azul

HEX:

#2E5699

Utilizar para:

* navegación
* títulos
* elementos institucionales
* componentes secundarios

---

## Neutros

Se recomienda construir una escala completa de grises.

Ejemplo:

50

100

200

300

400

500

600

700

800

900

Evitar negro puro.

Evitar blanco absoluto cuando no sea necesario.

---

# Tipografía

Fuente oficial:

Montserrat

Utilizar diferentes pesos.

Jerarquía recomendada:

ExtraBold

Bold

SemiBold

Medium

Regular

Evitar Light.

---

# Escala tipográfica

Debe construirse mediante tokens.

No repetir tamaños manualmente.

Ejemplo:

Display

H1

H2

H3

H4

Body Large

Body

Body Small

Caption

---

# Espaciado

El diseño debe utilizar una escala consistente.

Nunca colocar márgenes arbitrarios.

Toda separación debe responder al sistema.

---

# Bordes

Los componentes deben tener esquinas redondeadas.

No utilizar radios extremos.

El objetivo es transmitir modernidad sin parecer caricaturesco.

---

# Sombras

Sombras muy suaves.

Nunca utilizar sombras pesadas.

La profundidad debe ser sutil.

---

# Glassmorphism

Puede utilizarse.

Pero únicamente en:

* navbar
* overlays
* modales
* paneles flotantes

Nunca convertir toda la interfaz en vidrio.

---

# Blur

El desenfoque debe utilizarse únicamente para mejorar la percepción de profundidad.

Nunca como efecto decorativo.

---

# Botones

Debe existir un sistema único.

Tipos:

Primario

Secundario

Ghost

Outline

Danger

Disabled

Todos los botones deben compartir:

altura

tipografía

radio

animaciones

espaciado

---

# Tarjetas

La mayoría del contenido utilizará tarjetas.

Ejemplos:

Actividad

Libro

Herramienta

Carrera

Noticia

Todas deben compartir un mismo lenguaje visual.

---

# Iconografía

Utilizar una única biblioteca.

Preferentemente:

Lucide.

Los iconos deben sentirse ligeros y modernos.

Nunca mezclar estilos.

---

# Emojis

ATP utiliza emojis como parte de su identidad.

Los emojis deben ser los de estilo Apple (cuando el sistema operativo los soporte).

Nunca abusar de ellos.

Utilizarlos únicamente cuando mejoren la comunicación.

---

# Animaciones

Las animaciones son parte de la experiencia.

Nunca deben distraer.

Deben sentirse naturales.

Tipos recomendados:

Fade

Scale

Slide

Opacity

Blur

Duración:

150 ms

200 ms

250 ms

300 ms

Evitar animaciones largas.

---

# Microinteracciones

Toda interacción importante debe responder visualmente.

Ejemplos:

Hover

Focus

Tap

Click

Carga

Estados vacíos

Errores

Éxito

---

# Navegación

La navegación debe requerir el menor esfuerzo posible.

El usuario siempre debe saber:

Dónde está.

Qué puede hacer.

Cómo volver.

---

# Barra de navegación

Debe ser simple.

Siempre visible.

Con pocos elementos.

En dispositivos móviles debe priorizar rapidez de acceso.

---

# Hero

La primera pantalla debe comunicar inmediatamente:

Qué es ATP.

Qué puede hacer el estudiante.

Cuál es la acción principal.

No debe ocupar demasiado espacio vertical en celulares.

---

# Carruseles

Los carruseles deben utilizarse únicamente cuando aporten valor.

Nunca ocultar información importante exclusivamente dentro de un carrusel.

---

# Biblioteca

Debe sentirse como una verdadera biblioteca digital.

No como un explorador de carpetas.

El buscador es protagonista.

Los filtros deben ser rápidos.

La descarga debe requerir la menor cantidad posible de clics.

---

# Estados vacíos

Nunca mostrar una pantalla vacía.

Siempre explicar qué ocurre.

Siempre ofrecer una acción.

---

# Estados de carga

Utilizar Skeleton Loaders.

Evitar spinners largos.

La interfaz debe mantenerse estable durante la carga.

---

# Feedback

Toda acción del usuario debe generar una respuesta visual.

Ejemplos:

Guardado.

Error.

Carga.

Descarga.

Inscripción.

---

# Accesibilidad

Cumplir WCAG AA.

Mantener contraste suficiente.

Soporte para teclado.

Estados focus visibles.

HTML semántico.

Todas las páginas incluyen un enlace "Saltar al contenido principal" (invisible hasta recibir foco) como primer elemento del `<body>`, implementado una única vez en `BaseLayout`. Evita que un usuario de teclado tenga que atravesar el Navbar completo en cada página para llegar al contenido.

---

# Modo oscuro

Debe existir soporte completo.

No invertir simplemente los colores.

Diseñar específicamente ambos modos.

El cambio debe respetar la preferencia del sistema operativo.

---

# Imágenes

Optimizar automáticamente.

Mantener proporciones consistentes.

Evitar imágenes pixeladas.

Priorizar formatos modernos.

---

# Ilustraciones

Mantener un estilo limpio y minimalista.

No utilizar ilustraciones infantiles.

---

# Fotografía

Cuando se utilicen fotografías de actividades:

Priorizar imágenes espontáneas.

Mostrar estudiantes reales.

Transmitir comunidad.

Evitar fotografías excesivamente posadas.

---

# Experiencia general

El usuario debe sentir que:

Todo está donde espera.

Todo carga rápido.

Todo responde con fluidez.

Todo es fácil de entender.

La interfaz desaparece y deja que el contenido sea el protagonista.

---

# Principio final

Cada decisión de diseño debe responder una única pregunta:

**¿Esto hace que la experiencia del estudiante sea más simple, más clara y más agradable?**

Si la respuesta es no, esa decisión debe replantearse.
