# SEARCH_CONSOLE_SETUP.md

# Por qué "atpfcm" no aparece en Google todavía

## Objetivo

Explicar por qué buscar "atpfcm" en Google no muestra el sitio (al
2026-07-08) y qué hacer para que empiece a aparecer lo antes posible.

---

# El diagnóstico

No es un problema del código del sitio. Dos cosas se revisaron y están
bien:

- `robots.txt` permite indexar todo el sitio salvo `/admin/`.
- `sitemap-index.xml` se genera solo en cada build y lista todas las
  páginas.
- Cada página tiene `<title>`, descripción, URL canónica y datos
  estructurados (Organization/WebSite) correctos.

El problema real es que **el dominio es nuevo** (`atpfcm.com.ar` se
configuró hace apenas un par de días) y Google todavía no lo rastreó ni
indexó — eso normalmente tarda entre unos días y unas semanas incluso con
todo bien configurado, no es instantáneo. Mientras tanto, quien busca
"atpfcm" ve resultados de "ATP.fm" (Accidental Tech Podcast, un podcast de
tecnología muy conocido en inglés) porque esas siglas ya tienen años de
posicionamiento — no hay forma de "saltarse" eso, solo de acelerar que
Google encuentre y priorice el sitio de ATP.

Se mejoró el título de la página de inicio (antes decía solo "Inicio ·
ATP", ahora incluye "ATP FCM" y "Ciencias Médicas UNR" explícitamente) y se
agregó `alternateName: "ATP FCM"` a los datos estructurados, para que
Google conecte mejor esa búsqueda con el sitio. Pero el paso que más
acelera esto es externo, no de código: avisarle directamente a Google que
el sitio existe.

---

# Qué hacer (acción externa, no código)

## 1. Crear la propiedad en Google Search Console

1. Ir a [search.google.com/search-console](https://search.google.com/search-console/) e iniciar sesión con la cuenta de Google de ATP (`atpcienciasmedicas@gmail.com`).
2. Elegir **Agregar propiedad** → tipo **Dominio** (no "Prefijo de URL"), y escribir `atpfcm.com.ar`.
3. Google va a pedir verificar que el dominio es tuyo agregando un registro **TXT** en el DNS (en el mismo lugar de nic.ar donde ya se configuró el dominio, ver `docs/PROJECT.md`/memoria del dominio). Copiar el valor exacto que da Google y agregarlo como registro TXT.
4. Esperar unos minutos y apretar **Verificar** en Search Console.

## 2. Enviar el sitemap

1. Dentro de la propiedad ya verificada, ir a **Sitemaps** (menú izquierdo).
2. Escribir `sitemap-index.xml` y apretar **Enviar**.

## 3. Pedir indexación de la home directamente

1. Arriba de todo en Search Console hay una barra de búsqueda ("Inspeccionar cualquier URL").
2. Pegar `https://atpfcm.com.ar/` y Enter.
3. Apretar **Solicitar indexación**. Esto pone la home en una cola prioritaria — normalmente aparece en los resultados en 1 a 3 días, no semanas.
4. Repetir para alguna otra página importante si querés (ej. `/sumate`).

---

# Mientras tanto

Es normal y esperable que durante los primeros días buscar "atpfcm" no
muestre el sitio, incluso después de estos pasos — Google no es
instantáneo. Buscar directamente `site:atpfcm.com.ar` en Google es la
forma de chequear si ya indexó algo, aunque esa búsqueda no aparezca
todavía para "atpfcm" a secas.
