# CONTENT_SCHEMA.md

# Esquema de Contenidos — Plataforma ATP

## Objetivo

Este documento define los modelos de contenido oficiales de la plataforma ATP.

Todos los datos que consume la aplicación deben ajustarse a estos esquemas.

No deben existir estructuras diferentes para representar el mismo tipo de información.

La consistencia del contenido es tan importante como la consistencia del código.

---

# Principios generales

Todos los modelos deberán cumplir estas reglas:

* Tener un identificador único (`id`).
* Tener un estado de publicación.
* Registrar fechas de creación y actualización.
* Ser compatibles con futuras traducciones.
* Ser independientes de la interfaz gráfica.

---

# Estados de publicación

Todo contenido puede encontrarse en uno de los siguientes estados:

* Draft
* Published
* Archived

Nunca eliminar contenido histórico salvo decisión explícita del administrador.

---

# Modelo: Activity

Representa cualquier actividad organizada o difundida por ATP.

## Campos obligatorios

* id
* slug
* title
* summary
* description
* coverImage
* startDate
* endDate
* registrationUrl
* category
* published

## Campos opcionales

* location
* speakers
* capacity
* tags
* gallery
* attachments

## Reglas

* Si la fecha de finalización ya pasó, la actividad deja de mostrarse como vigente.
* Debe poder destacarse en la página principal.
* Puede pertenecer a más de una carrera.

---

# Modelo: Book

Representa un recurso académico descargable.

## Campos obligatorios

* id
* slug
* title
* author
* subject
* career
* academicYear
* resourceType
* downloadUrl
* published

## Campos opcionales

* edition
* publisher
* language
* coverImage
* description
* tags
* fileSize
* pages

## Reglas

* Todo libro debe pertenecer al menos a una materia.
* Debe poder encontrarse mediante el buscador.
* Debe admitir múltiples etiquetas.

---

# Modelo: News

Representa una novedad o comunicado.

## Campos obligatorios

* id
* slug
* title
* summary
* content
* publishDate
* published

## Campos opcionales

* coverImage
* gallery
* relatedLinks
* tags

---

# Modelo: Career

Representa una carrera de la Facultad.

## Campos obligatorios

* id
* slug
* name
* description
* heroImage
* published

## Campos opcionales

* color
* icon
* featuredResources
* usefulLinks

## Reglas

Cada carrera actúa como contenedor lógico de recursos y herramientas.

---

# Modelo: Tool

Representa una herramienta digital.

Ejemplos:

* Atlas
* Microscopio virtual
* Calculadora
* Simulador
* Plataforma externa

## Campos obligatorios

* id
* slug
* name
* description
* url
* category
* published

## Campos opcionales

* icon
* coverImage
* tags
* career
* subject

---

# Modelo: Link

Representa enlaces importantes.

## Campos obligatorios

* id
* title
* url
* category
* published

## Campos opcionales

* icon
* description
* featured

Ejemplos:

* Transparente Virtual
* Página oficial de la Facultad
* SIU Guaraní
* Biblioteca UNR

---

# Modelo: Announcement

Representa anuncios breves para el carrusel de novedades.

## Campos obligatorios

* id
* title
* description
* published

## Campos opcionales

* image
* actionLabel
* actionUrl
* expiresAt

---

# Modelo: TeamMember

Representa integrantes visibles de ATP.

## Campos obligatorios

* id
* name
* role
* photo
* published

## Campos opcionales

* instagram
* biography
* email

---

# Modelo: SocialNetwork

Representa redes oficiales.

## Campos obligatorios

* id
* platform
* url
* published

## Plataformas iniciales

* Instagram
* YouTube
* WhatsApp

La arquitectura debe permitir agregar nuevas plataformas.

---

# Modelo: FAQ

Representa preguntas frecuentes.

## Campos obligatorios

* id
* question
* answer
* category
* published

---

# Modelo: Download

Representa un archivo descargable.

## Campos obligatorios

* id
* title
* url
* fileType
* published

## Campos opcionales

* size
* version
* description

---

# Modelo: Page

Representa páginas institucionales.

Ejemplos:

* Quiénes Somos
* Sumate
* Contacto
* Historia

## Campos obligatorios

* id
* slug
* title
* content
* published

## Campos opcionales

* heroImage
* seoTitle
* seoDescription

---

# Modelo: Category

Representa categorías reutilizables.

Ejemplos

* Anatomía
* Histología
* Fisiología
* Farmacología

Evitar escribir categorías libres en cada contenido.

---

# Modelo: Tag

Representa etiquetas.

Ejemplos

* Final
* Resumen
* Libro
* Guía
* PDF
* Destacado

Las etiquetas mejoran la búsqueda.

---

# Relaciones

## Un libro

Puede pertenecer a:

* una o varias materias;
* una o varias carreras;
* múltiples etiquetas.

---

## Una actividad

Puede relacionarse con:

* carreras;
* noticias;
* recursos;
* herramientas.

---

## Una carrera

Puede contener:

* libros;
* herramientas;
* actividades;
* enlaces;
* noticias.

---

## Una noticia

Puede enlazar:

* actividades;
* libros;
* herramientas.

---

# Convenciones

Todos los identificadores deben ser permanentes.

Todos los slugs deben ser únicos.

Nunca utilizar el título como identificador.

---

# Imágenes

Todo contenido que utilice imágenes deberá definir:

* imagen principal;
* texto alternativo;
* relación de aspecto consistente.

---

# Fechas

Todas las fechas deberán almacenarse utilizando formato ISO 8601.

No almacenar fechas como texto libre.

---

# Enlaces

Todo enlace externo deberá:

* utilizar HTTPS;
* validarse periódicamente;
* permitir apertura segura.

---

# Archivos

Los archivos descargables deberán identificar:

* tipo;
* tamaño;
* origen.

Cuando sea posible, ofrecer descarga directa.

---

# SEO

Todo contenido público deberá admitir:

* título SEO;
* descripción SEO;
* Open Graph;
* imagen para compartir.

---

# Internacionalización

Todo contenido debe estar preparado para futuras traducciones.

La estructura nunca debe asumir un único idioma.

---

# Validaciones

Antes de publicar cualquier contenido verificar:

* campos obligatorios completos;
* enlaces válidos;
* imágenes disponibles;
* slug único;
* categoría existente;
* etiquetas válidas.

---

# Evolución

Nuevos modelos podrán incorporarse en el futuro.

Sin embargo, deberán seguir estas reglas:

* reutilizar estructuras existentes cuando sea posible;
* mantener consistencia de nombres;
* documentarse en este archivo antes de implementarse.

---

# Regla fundamental

El contenido es el activo más importante de la plataforma.

Una buena arquitectura de datos permitirá que ATP siga creciendo durante años sin necesidad de reorganizar toda la información.
