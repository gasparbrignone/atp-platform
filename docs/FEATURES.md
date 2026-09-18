# FEATURES.md

# Funcionalidades de la Plataforma ATP

## Objetivo

Este documento define todas las funcionalidades que debe ofrecer la plataforma ATP.

No describe la implementación técnica ni el diseño visual. Su objetivo es establecer qué capacidades debe tener el sistema para satisfacer las necesidades de los estudiantes y de ATP.

Cada nueva funcionalidad debe responder a un problema real y aportar valor.

---

# Prioridades

Las funcionalidades se dividen en cuatro niveles.

## Prioridad 1 — Esenciales

Son indispensables para el lanzamiento.

## Prioridad 2 — Muy importantes

Aumentan significativamente el valor del producto.

## Prioridad 3 — Futuras

No son necesarias para el lanzamiento, pero la arquitectura debe permitir incorporarlas.

## Prioridad 4 — Experimentales

Ideas que podrán evaluarse más adelante.

---

# Inicio

## Hero principal

El inicio debe comunicar inmediatamente:

* Qué es ATP.
* Qué ofrece.
* Cómo comenzar.
* Cómo participar.

Debe existir una llamada a la acción clara.

---

## Actividades destacadas

El sistema debe mostrar automáticamente las actividades vigentes.

Cada actividad podrá incluir:

* Imagen.
* Título.
* Descripción.
* Fecha.
* Hora.
* Lugar (opcional).
* Enlace de inscripción.
* Estado.

Las actividades vencidas deberán dejar de aparecer en la sección principal.

---

## Carrusel de novedades — 🚫 fuera de alcance

Depende de la sección "Noticias", que se sacó por decisión de producto (ver `docs/ROADMAP.md`, Fase 6/10, y `docs/TODO.md`). No existe hoy.

---

# Biblioteca Digital

La biblioteca constituye uno de los módulos principales.

Debe permitir administrar recursos académicos de forma organizada.

Cada recurso podrá incluir:

* Título.
* Autor.
* Carrera.
* Materia.
* Año.
* Edición.
* Tipo.
* Portada.
* Enlace de descarga.
* Etiquetas.

---

## Buscador

El buscador debe ofrecer resultados instantáneos.

Debe buscar por:

* título;
* autor;
* materia;
* carrera;
* año;
* palabras clave.

La búsqueda no debe requerir recargar la página.

---

## Filtros

Los usuarios podrán combinar múltiples filtros.

Ejemplos:

* carrera;
* materia;
* año;
* tipo de recurso;
* autor.

Los filtros deben actualizar los resultados inmediatamente.

---

## Descargas

Cada recurso deberá poder abrirse o descargarse con la menor cantidad posible de clics.

Implementado: subida directa desde el CMS a Cloudflare R2 (arrastrar el archivo, sin pasar por Google Drive) — ver `docs/STACK_DECISIONS.md`. Google Drive quedó solo como un campo alternativo (`driveUrl`) para cargar rápido y migrar después automáticamente.

---

# Carreras

Cada carrera tendrá un espacio propio.

Inicialmente:

* Medicina.
* Enfermería.
* Fonoaudiología.
* Terapia Ocupacional.

Cada espacio podrá contener:

* herramientas;
* recursos;
* enlaces;
* información específica;
* novedades propias.

---

# Herramientas

La plataforma deberá permitir organizar herramientas digitales.

Ejemplos:

* Atlas anatómicos.
* Microscopios virtuales.
* Preparados anatómicos.
* Calculadoras.
* Simuladores.
* Recursos externos.

Cada herramienta podrá clasificarse por carrera y materia.

---

# Ingresantes — ✅ implementado

La plataforma debe reunir en un solo lugar la información oficial de inscripción a las 4 carreras de la FCM (Medicina, Enfermería, Fonoaudiología, Terapia Ocupacional), reorganizada para que se pueda escanear y entender rápido — no un texto corrido largo como el de la fuente oficial (`fcm.unr.edu.ar/ingresantes/`).

`/ingresantes/` (`src/pages/ingresantes.astro`) cubre:

* las 2 etapas del proceso (preinscripción online, entrega de documentación) como pasos numerados con sus fechas;
* checklist tildable de documentación requerida, separado por "terminé el secundario en Argentina" / "en otro país" (persiste en `localStorage` del navegador, no hay backend);
* cómo legalizar fotocopias;
* requisitos extra según la carrera (Fonoaudiología, Enfermería 2.º ciclo);
* preguntas frecuentes;
* un botón flotante de WhatsApp — solo en esta página, no sitewide (acá es donde más dudas puntuales/urgentes surgen).

Reemplaza a la entrada que antes vivía enterrada en la colección `tools` ("Ingresantes" dentro de `/herramientas/`, como texto plano sin estructura).

---

# Calendario Académico — ⬜ no implementado

El sistema deberá mostrar información académica organizada. Sigue siendo una funcionalidad deseada (Prioridad 3), pero no existe ningún componente ni colección para esto hoy — no confundir con el campo "Materias" (que sí existe y es otra cosa).

Podrá filtrarse por:

* carrera;
* año;
* materia.

Cada evento podrá incluir:

* inicio;
* finalización;
* mesas;
* actividades;
* observaciones.

---

# Noticias — 🚫 fuera de alcance (decisión de producto)

Se sacó por decisión de producto en la Fase 6 (ver `docs/ROADMAP.md`, `docs/TODO.md`). Queda documentado acá solo por si se revisita más adelante; no es un gap a llenar sin que alguien lo pida explícitamente.

---

# Enlaces importantes — 🟨 parcialmente cubierto

No existe una sección sitewide de "enlaces importantes" como se imaginó originalmente. Cada carrera sí tiene su propia lista de enlaces (campo `resources` en `src/content.config.ts`), editable desde el CMS — cubre la necesidad a nivel carrera, no a nivel sitio completo.

---

# Quiénes Somos — 🚫 fuera de alcance (decisión de producto)

Debe existir una sección institucional.

Debe explicar:

* qué es ATP;
* misión;
* valores;
* forma de trabajo.

El tono debe mantenerse cercano.

---

# Sumate a ATP

La plataforma debe invitar constantemente a participar.

Debe existir más de una llamada a la acción.

Los estudiantes deberán poder comunicarse fácilmente mediante:

* formularios;
* Instagram;
* WhatsApp;
* futuros canales.

---

# Contacto

Debe existir un punto único para contactar a ATP.

El usuario nunca debe preguntarse cómo comunicarse.

---

# CMS — ✅ implementado (Sveltia CMS)

Los administradores deberán poder gestionar:

* actividades;
* biblioteca (incluida la subida de archivos, directo a Cloudflare R2);
* carreras;
* herramientas;
* materias y tipos de recurso (colecciones editables, no listas fijas en código).

No deberán modificar código. "Noticias" y "páginas institucionales" no aplican — fuera de alcance (ver arriba).

---

# Búsqueda Global

La plataforma deberá contar con una búsqueda global.

El usuario podrá escribir cualquier término y obtener resultados de:

* biblioteca;
* actividades;
* herramientas;
* noticias;
* enlaces.

---

# SEO

Todas las páginas deberán ser indexables.

Cada contenido deberá generar automáticamente:

* título;
* descripción;
* Open Graph;
* URL amigable.

---

# Analíticas

El sistema deberá permitir conocer:

* recursos más descargados;
* actividades más visitadas;
* búsquedas más frecuentes;
* clics en botones principales.

---

# Accesibilidad

Todas las funcionalidades deberán poder utilizarse:

* mediante teclado;
* con lectores de pantalla;
* en dispositivos móviles;
* en conexiones lentas.

---

# Modo oscuro

Toda funcionalidad deberá funcionar correctamente tanto en modo claro como en modo oscuro.

---

# Progressive Web App

Los usuarios deberán poder instalar la plataforma como una aplicación.

---

# Internacionalización

Toda funcionalidad deberá ser compatible con múltiples idiomas.

Inicialmente:

* Español.

Preparada para:

* Portugués.

---

# Notificaciones (Futuro)

La arquitectura deberá permitir incorporar:

* recordatorios;
* avisos;
* anuncios importantes;
* notificaciones web.

---

# Panel administrativo

El sistema deberá ofrecer una experiencia simple para los administradores.

Las tareas frecuentes deberán requerir la menor cantidad posible de pasos.

---

# Escalabilidad

Toda funcionalidad nueva deberá integrarse sin romper las existentes.

No deberán existir dependencias innecesarias entre módulos.

---

# Criterio de aceptación

Una funcionalidad se considera terminada cuando:

* cumple el objetivo para el usuario;
* es accesible;
* mantiene la coherencia visual;
* respeta el sistema de diseño;
* funciona en dispositivos móviles;
* mantiene el rendimiento del sitio;
* puede mantenerse fácilmente en el futuro.

---

# Visión del producto

La plataforma no debe limitarse a publicar información.

Debe convertirse en el principal punto de encuentro digital de ATP.

El objetivo final es que cualquier estudiante piense primero en la plataforma de ATP cuando necesite una actividad, un recurso académico, una herramienta o información relevante sobre su carrera.

---

# Gatillo de actualización

Actualizar este documento cuando:

* se decida sacar o agregar una funcionalidad de alcance (marcar 🚫/✅ en el lugar, no dejarlo implícito);
* el mecanismo real detrás de una funcionalidad cambie de forma que invalide lo escrito acá (como pasó con Drive → Cloudflare R2).

No es necesario detallar acá el estado tarea por tarea — para eso está `docs/TODO.md`. Este documento es el "qué debería poder hacer el sistema", no un checklist de progreso.
