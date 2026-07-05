# DESIGN_TOKENS.md

# Sistema de Tokens de Diseño — ATP Platform

## Objetivo

Este documento define todos los valores visuales reutilizables de la plataforma.

Ningún componente debe utilizar valores "hardcodeados" cuando exista un token equivalente.

Todos los colores, tamaños, espaciados, radios, sombras, animaciones y estilos deben construirse a partir de este sistema.

---

# Filosofía

Los tokens garantizan:

* Consistencia visual.
* Facilidad de mantenimiento.
* Escalabilidad.
* Reutilización.
* Uniformidad entre componentes.

Modificar un token debe actualizar automáticamente toda la interfaz.

---

# Colores

## Marca

```text
--color-primary: #F969D7;
--color-secondary: #2E5699;
```

Estos son los colores de marca "puros" y solo deben usarse como **relleno sólido** (fondo de un botón, un badge, etc.), siempre acompañados de su token `-foreground` correspondiente. Para usarlos como texto, borde, ícono o anillo de foco sobre el fondo de la página, ver "Colores de contraste (foreground y strong)" más abajo.

---

## Escala de grises

```text
--gray-50
--gray-100
--gray-200
--gray-300
--gray-400
--gray-500
--gray-600
--gray-700
--gray-800
--gray-900
```

Utilizar una escala uniforme.

Evitar negro absoluto (#000000) salvo casos excepcionales.

Evitar blanco puro (#FFFFFF) como fondo principal cuando un blanco ligeramente cálido mejore la lectura.

---

## Estados

```text
--color-success: #2E9E5B;
--color-warning: #D98E04;
--color-error: #D32F2F;
--color-info: #1D63C4;
```

Todos los estados deben mantener suficiente contraste en modo claro y oscuro.

`error` e `info` están calibrados (más oscuros que un rojo/azul "puro") para que el texto blanco sobre su relleno sólido llegue a 4.5:1 — no ajustarlos sin volver a verificar contraste.

---

## Colores de contraste (foreground y strong)

Cada color de marca/estado tiene dos formas de uso, y **no son intercambiables**:

### `-foreground` — texto sobre un relleno sólido

```text
--color-primary-foreground
--color-secondary-foreground
--color-success-foreground
--color-warning-foreground
--color-error-foreground
--color-info-foreground
```

Es el color de texto ya verificado para pintarse **encima** de un fondo sólido de esa marca/estado (ej. el texto de un botón `primary`, o el texto de un badge `warning`). Como el fill y su foreground forman una pareja autocontenida, **no cambian entre modo claro y oscuro** — el par ya es accesible en cualquier contexto.

Importante: `--color-primary-foreground` es un gris oscuro, no blanco. El rosa de marca (#F969D7) es demasiado claro para que el texto blanco alcance 4.5:1 sobre él; el resto de los colores sí usan blanco.

### `-strong` — texto, borde o ícono directamente sobre el fondo de página

```text
--color-primary-strong
--color-error-strong
```

Existen solo donde hacen falta: el rosa de marca y el rojo de error, usados como texto/borde/ícono/anillo de foco *sin relleno detrás* (ej. un botón `outline`, el borde de un input inválido, el anillo de foco global), no alcanzan 3:1 (borde) ni 4.5:1 (texto) contra el fondo de la página en al menos uno de los dos temas.

Por eso `-strong` **sí está temizado a propósito** (ver `tokens.css`, no es una inversión automática):

* `primary-strong`: más oscuro en modo claro (`#C6299E`), y el rosa de marca original en modo oscuro (donde sí contrasta bien).
* `error-strong`: igual al `error` base en modo claro, más claro en modo oscuro (`#FF6B6B`).

`secondary`, `success` e `info` no tienen variante `-strong` porque, calculado el contraste, funcionan correctamente como borde/texto en ambos temas sin necesitar un valor alternativo.

### Regla de uso

* ¿El color es el **fondo** de un elemento? → usar el color base + su `-foreground`.
* ¿El color es el **texto/borde/ícono** y el fondo detrás es la página (no un relleno propio)? → usar la variante `-strong` si existe; si no existe para ese color, el color base ya es seguro para ese uso.

---

## Superficies semánticas

```text
--color-background
--color-surface
--color-surface-alt
--color-text
--color-text-secondary
--color-border
```

Son la base neutra de toda la interfaz (fondo de página, fondo de una tarjeta, texto principal, texto secundario, bordes por defecto). Se construyen a partir de la escala de grises y **sí cambian de valor completo entre modo claro y oscuro** (no son un color fijo con opacidad): en modo claro salen de los extremos claros de la escala, en modo oscuro de superficies oscuras diseñadas a propósito (nunca negro puro), siguiendo la regla de "Modo oscuro" de este documento.

Ningún componente debe usar `--gray-*` directamente para fondo/texto/borde de la interfaz general — `--gray-*` es la materia prima; estos tokens semánticos son la capa que los componentes deben consumir.

---

# Tipografía

Fuente oficial

Montserrat

Nunca mezclar tipografías.

---

## Pesos

```text
Regular
Medium
SemiBold
Bold
ExtraBold
```

Evitar Thin y Light.

---

## Escala tipográfica

```text
Display XL

Display L

H1

H2

H3

H4

Body Large

Body

Body Small

Caption

Overline
```

Utilizar una escala modular.

No definir tamaños arbitrarios.

---

# Altura de línea

Mantener una lectura cómoda.

Utilizar valores consistentes para cada nivel tipográfico.

---

# Espaciado

Utilizar una escala de 4 px.

```text
4

8

12

16

20

24

32

40

48

56

64

80

96

128
```

Nunca utilizar márgenes o paddings aleatorios.

Implementación: se expone como una única variable `--spacing: 0.25rem` (el multiplicador de 4px), no como una variable nombrada por paso. Cada valor de la lista es ese multiplicador × un entero (ej. `24px = --spacing × 6`); usar solo los enteros que caen en los valores de arriba.

---

# Radios

Definir radios consistentes.

```text
XS

SM

MD

LG

XL

2XL

Full
```

Uso recomendado

XS

Inputs

SM

Botones

MD

Cards

LG

Modales

XL

Hero

Full

Badges o elementos completamente redondeados

Evitar radios excesivos.

---

# Sombras

Definir una escala.

```text
Shadow XS

Shadow SM

Shadow MD

Shadow LG

Shadow XL
```

Las sombras deben ser suaves.

Nunca utilizar sombras negras intensas.

---

# Blur

Escala

```text
XS

SM

MD

LG

XL
```

Utilizar principalmente para:

Navbar

Modales

Glass Panels

---

# Bordes

Definir un sistema.

```text
Border Thin

Border Default

Border Strong
```

Evitar bordes innecesarios.

---

# Opacidad

Utilizar únicamente valores del sistema.

```text
0

5

10

20

40

60

80

100
```

---

# Capas (Z-Index)

Crear una jerarquía.

```text
Base

Dropdown

Sticky

Overlay

Modal

Toast

Tooltip
```

Nunca utilizar números aleatorios.

Se exponen como utilidades `z-base`, `z-sticky`, `z-modal`, etc. (una por capa). Un `<dialog>` nativo mostrado con `showModal()` (como el menú móvil) no necesita ninguna de estas: el navegador ya lo renderiza por encima de todo a través del "top layer", sin importar el z-index de sus ancestros.

---

# Duraciones de animación

```text
Fast

Normal

Slow
```

Referencia:

150 ms

250 ms

350 ms

Evitar animaciones superiores a 500 ms.

Estas duraciones se aplican de forma global: si el sistema operativo tiene activado "reducir movimiento" (`prefers-reduced-motion`), todas las animaciones y transiciones del sitio se acortan automáticamente a un valor casi instantáneo. Los componentes no necesitan implementar esto por su cuenta.

---

# Curvas de animación

Utilizar easing suaves.

Preferir aceleraciones similares a las utilizadas por Apple.

Evitar animaciones lineales.

---

# Escalas de transformación

Hover

Tap

Focus

Nunca superar transformaciones exageradas.

---

# Grid

Utilizar una grilla consistente.

12 columnas en escritorio.

Adaptativa en móviles.

---

# Contenedor

Definir anchos máximos reutilizables.

Nunca extender contenido de lectura excesivamente.

```text
--container-content: 80rem (1280px)
```

Es el ancho máximo de lectura por defecto (usado por el componente `Container`). Nuevos anchos de contenedor deben agregarse como `--container-<nombre>`, nunca como un valor arbitrario en un componente.

---

# Breakpoints

Mobile

Tablet (768px)

Laptop (1024px)

Desktop (1280px)

Wide (1536px)

Todos los componentes deben responder correctamente en cada uno.

Estos umbrales coinciden exactamente con la escala `md / lg / xl / 2xl` del framework de estilos — no existen tokens de breakpoint custom por separado. `Mobile` es la base sin prefijo (mobile-first); no se define un breakpoint adicional por debajo de Tablet.

---

# Botones

Definir un único sistema.

Variantes

Primary

Secondary

Outline

Ghost

Danger

`Disabled` no es una variante: es un estado (`disabled`) combinable con cualquiera de las variantes de arriba, igual que `loading`.

Todos deben compartir:

Altura

Padding

Tipografía

Radio

Animaciones

---

# Inputs

Todos los campos deben compartir:

Altura

Padding

Focus

Borde

Tipografía

Mensajes de error

---

# Cards

Todas las tarjetas deben compartir:

Padding

Radio

Sombras

Espaciado interno

Animaciones

---

# Navbar

Debe utilizar tokens propios.

Altura

Padding

Blur

Color

Transparencia

---

# Footer

Mantener consistencia con el resto del sistema.

---

# Iconografía

Biblioteca oficial

Lucide (paquete `@lucide/astro`)

Todos los iconos deben utilizar tamaños del sistema.

Nunca tamaños arbitrarios.

Lucide no incluye logos de marca (Instagram, YouTube, WhatsApp, etc. — los quitó de su set por ser un ícono genérico/neutral). Para redes sociales, usar el ícono genérico más cercano en vez de mezclar SVGs de otra librería: `Camera` para Instagram, `Play` para YouTube, `MessageCircle` para WhatsApp (ver `SocialLinks.astro`).

---

# Emojis

Los emojis complementan la comunicación.

No reemplazan iconografía.

No utilizar más de un emoji por elemento de interfaz.

---

# Skeleton Loaders

Crear un único estilo reutilizable.

Todos los placeholders deben compartir animación.

---

# Estados

Todos los componentes deben contemplar:

Default

Hover

Pressed

Focused

Disabled

Loading

Error

Success

---

# Feedback

Toda acción importante debe tener respuesta visual.

Ejemplos

Inscripción

Descarga

Búsqueda

Guardado

Error

---

# Accesibilidad

Todos los tokens deben respetar WCAG AA.

Mantener contraste suficiente.

Focus visible.

Tamaños táctiles adecuados.

Ver "Colores de contraste (foreground y strong)" arriba: es el mecanismo concreto que garantiza que los colores de marca/estado cumplan WCAG AA en cualquier combinación de fondo, tema y uso (relleno vs. texto/borde).

---

# Modo oscuro

Todos los tokens deben tener su equivalente.

Nunca invertir colores automáticamente.

Diseñar ambos modos.

Caso concreto: `--color-primary-strong` y `--color-error-strong` tienen un valor distinto por tema (ver arriba) porque invertir o mantener el mismo valor en ambos modos rompía el contraste en alguno de los dos — la razón por la que este documento exige diseñar cada modo a propósito en vez de invertir colores.

---

# Convención de nombres

Utilizar nombres consistentes.

Ejemplos

```text
color-primary

color-primary-foreground

color-primary-strong

color-surface

spacing

radius-lg

shadow-sm

text-body

duration-fast
```

Evitar nombres ambiguos.

---

# Regla fundamental

Si un valor visual se repite más de una vez en el proyecto, debe convertirse en un token.

No duplicar estilos.

No hardcodear medidas.

No romper el sistema de diseño.
