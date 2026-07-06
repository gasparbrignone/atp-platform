# UI_COMPONENTS.md

# Sistema de Componentes UI — Plataforma ATP

## Objetivo

Este documento define el sistema oficial de componentes reutilizables de la plataforma ATP.

Todos los componentes de la aplicación deberán construirse respetando estas especificaciones.

No se deberán crear componentes duplicados.

Siempre que una funcionalidad nueva necesite una interfaz, primero deberá evaluarse si puede reutilizar un componente existente.

---

# Filosofía

Los componentes son bloques de construcción.

Cada componente debe:

* tener una única responsabilidad;
* ser reutilizable;
* ser accesible;
* ser responsive;
* respetar el sistema de diseño;
* utilizar exclusivamente los Design Tokens.

---

# Convenciones generales

Todos los componentes deberán:

* soportar modo claro y oscuro;
* ser completamente responsive;
* respetar WCAG AA;
* utilizar animaciones consistentes;
* mantener estados visuales claros.

Todo componente interactivo deberá contemplar:

* Default
* Hover
* Focus
* Active
* Disabled
* Loading
* Error (cuando aplique)

---

# Layout

## AppLayout

Responsabilidad:

Estructura principal de todas las páginas.

Debe incluir:

* Navbar
* Contenido principal
* Footer

Debe encargarse únicamente de la composición.

---

## Container

Responsabilidad:

Controlar el ancho máximo del contenido.

Nunca debe contener lógica.

---

## Section

Responsabilidad:

Agrupar bloques de contenido.

Debe aplicar automáticamente espaciado vertical consistente.

---

# Navegación

## Navbar

Debe ser el componente de navegación principal.

Funciones:

* navegación entre secciones;
* acceso rápido;
* acceso a "Sumate a ATP";
* menú móvil.

El modo oscuro no tiene toggle manual: sigue únicamente la preferencia del sistema (`prefers-color-scheme`).

Características:

* sticky;
* fondo con blur sutil;
* transición suave al hacer scroll;
* altura constante.

---

## Mobile Menu

Versión móvil del menú.

Debe abrirse mediante animación.

Debe bloquear el scroll del fondo.

Debe poder cerrarse:

* tocando fuera;
* botón cerrar;
* tecla Escape.

Implementado con `<dialog>` nativo (foco atrapado y semántica modal gratis — ver `docs/STACK_DECISIONS.md` → "Soporte de navegadores" para el piso de compatibilidad y las limitaciones conocidas de iOS Safari).

---

## Footer

Debe contener:

* logo;
* descripción breve;
* enlaces rápidos;
* redes sociales;
* información institucional.

---

# Botones

## Button

Único componente oficial para botones.

Variantes:

* Primary
* Secondary
* Outline
* Ghost
* Danger

Debe soportar:

* iconos;
* loading;
* disabled;
* tamaño pequeño;
* tamaño normal;
* tamaño grande.

---

# Tarjetas

## Card

Componente base.

Nunca utilizar una tarjeta personalizada si puede extender Card.

Debe admitir:

* título;
* contenido;
* acciones;
* imagen opcional;
* badge opcional.

---

## ActivityCard

Especialización de Card.

Información:

* imagen;
* fecha;
* hora;
* título;
* descripción;
* botón de inscripción.

Debe permitir destacar actividades importantes.

---

## BookCard

Especialización de Card.

Información:

* portada;
* título;
* autor;
* materia;
* año;
* tipo;
* botón descargar.

Debe ser fácilmente escaneable.

---

## ToolCard

Representa herramientas digitales.

Debe incluir:

* icono;
* nombre;
* descripción;
* botón acceder.

---

## CareerCard

Representa una carrera.

Debe mostrar:

* nombre;
* imagen o ilustración;
* breve descripción;
* botón explorar.

---

## NewsCard

Representa una noticia.

Debe incluir:

* imagen;
* fecha;
* título;
* resumen.

---

# Hero

Debe ser el componente principal del inicio.

Debe comunicar inmediatamente:

* quién es ATP;
* qué ofrece;
* qué acción realizar.

Debe incluir:

* título;
* descripción;
* CTA principal;
* CTA secundaria;
* imagen opcional.

No debe ocupar excesiva altura en dispositivos móviles.

Implementado como un componente 100% genérico, configurable por props (`title`, `subtitle`, `description`, `primaryAction`, `secondaryAction`, `image`, `alignment`, `backgroundVariant`) — no contiene ningún texto de ATP. Cada página que use Hero pasa su propio contenido.

---

# Carrusel

## Carousel

Componente reutilizable.

Debe utilizarse para:

* actividades;
* novedades;
* destacados.

Características:

* navegación táctil;
* soporte para teclado;
* indicadores;
* autoplay opcional;
* pausa al interactuar.

Nunca ocultar información esencial exclusivamente dentro de un carrusel.

La navegación táctil usa CSS scroll-snap nativo (el navegador maneja el gesto), no JS a mano. JS solo mueve el track (botones/indicadores/autoplay). Cada slide pasado al slot por defecto debe declarar su propio ancho y las clases `shrink-0 snap-center` — el Carousel es agnóstico al contenido (actividades, novedades, etc.) y por eso no impone un ancho de slide.

Sigue el patrón WAI-ARIA Carousel (APG): la región etiquetada incluye los controles (no solo el track); cada slide recibe `role="group"` + `aria-roledescription="slide"` + posición ("X de N") inyectados en runtime; un live region oculto anuncia el slide activo (silenciado mientras el autoplay rota, para no interrumpir cada pocos segundos); y el autoplay tiene un botón de pausa/reproducción persistente además de pausar con hover/foco — necesario porque en touch no existe "hover" (WCAG 2.2.2).

---

# Formularios

## Input

Debe soportar:

* texto;
* email;
* búsqueda;
* contraseña;
* número.

---

## Textarea

Versión extendida para texto largo.

---

## Select

Selector reutilizable.

Debe soportar búsqueda cuando existan muchas opciones.

Estado actual: la versión base es un `<select>` nativo estilizado (sin buscador), para mantener el soporte de teclado y lectores de pantalla sin construir un widget custom. La búsqueda se agrega más adelante, cuando algún selector concreto lo necesite — no antes.

---

## Checkbox

Estilo consistente.

---

## Switch

Para activar o desactivar opciones.

---

## SearchBar

Uno de los componentes más importantes.

Debe ofrecer:

* búsqueda inmediata;
* botón limpiar;
* accesibilidad;
* navegación por teclado.

---

# Filtros

## FilterPanel

Agrupa todos los filtros.

Debe ser reutilizable para:

* biblioteca;
* actividades;
* herramientas.

Debe permitir combinar múltiples criterios.

---

## FilterChip

Representa un filtro activo.

Debe poder eliminarse con un clic.

---

# Feedback

## Badge

Mostrar estados.

Ejemplos:

Nuevo.

Destacado.

Actualizado.

Importante.

---

## Toast

Mostrar mensajes temporales.

Tipos:

* éxito;
* error;
* información;
* advertencia.

`Toast.astro` solo renderiza el contenedor vacío (una vez, en `BaseLayout`). Para mostrar un mensaje, llamar a `showToast({ message, variant })` desde `src/lib/toast.ts` en cualquier script — no hay una forma declarativa de renderizar un toast individual, porque no existen al momento de build.

---

## Alert

Mensajes persistentes.

---

## EmptyState

Mostrar cuando no existen resultados.

Debe incluir:

* ilustración opcional;
* mensaje;
* acción sugerida.

---

## Skeleton

Utilizado durante la carga.

Nunca utilizar spinners largos cuando sea posible.

---

## Loader

Indicador general de carga.

---

# Modales

## Modal

Debe utilizarse para:

* confirmaciones;
* información ampliada;
* acciones rápidas.

Características:

* accesible;
* animado;
* cierre con Escape;
* cierre al hacer clic fuera;
* bloqueo del scroll.

Implementado con `<dialog>` nativo, igual que Mobile Menu — de hecho comparte la misma lógica de apertura/cierre (`src/lib/dialogController.ts`) en vez de duplicarla. Se abre desde cualquier botón en la página con `data-modal-open="<id>"`, sin necesidad de pasarle un handler por props: útil porque el disparador suele vivir en un componente distinto al modal (ej. una card).

---

# Diálogos

## ConfirmDialog

Utilizar únicamente para acciones importantes.

Ejemplos:

Eliminar.

Salir.

Cancelar.

---

# Calendario

## Calendar

Componente reutilizable.

Debe permitir mostrar:

* fechas;
* eventos;
* actividades;
* mesas.

---

# Biblioteca

## BookGrid

Muestra resultados.

Debe adaptarse automáticamente al ancho disponible.

---

## BookDetail

Información completa de un recurso.

---

# Actividades

## ActivityGrid

Listado de actividades.

---

## ActivityDetail

Vista completa.

---

# Noticias

## NewsGrid

Listado.

---

## NewsDetail

Contenido completo.

---

# Componentes institucionales

## JoinCTA

Componente reutilizable para invitar a participar en ATP.

Debe aparecer en distintas secciones.

Nunca resultar invasivo.

---

## SocialLinks

Mostrar redes oficiales.

Debe reutilizarse en:

Navbar.

Footer.

Contacto.

---

# Accesibilidad

Todos los componentes deben:

* funcionar con teclado;
* tener foco visible;
* soportar lectores de pantalla;
* mantener contraste adecuado.

---

# Responsive

Todos los componentes deben adaptarse automáticamente.

No crear variantes independientes para móvil.

El mismo componente debe responder mediante el sistema de diseño.

---

# Rendimiento

Los componentes deben minimizar JavaScript.

Cuando sea posible utilizar renderizado estático.

La hidratación debe limitarse únicamente a componentes interactivos.

---

# Animaciones

Todos los componentes deben utilizar la misma filosofía de movimiento.

Duraciones:

150 ms

200 ms

250 ms

300 ms

Evitar rebotes exagerados.

---

# Regla fundamental

Antes de crear un componente nuevo, responder esta pregunta:

**¿Puede resolverse reutilizando un componente existente?**

Si la respuesta es sí, reutilizar.

Si la respuesta es no, crear un nuevo componente respetando el sistema de diseño y documentarlo para futuras implementaciones.
