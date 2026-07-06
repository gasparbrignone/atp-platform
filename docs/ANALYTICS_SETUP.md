# ANALYTICS_SETUP.md

# Puesta en marcha de Analíticas (GoatCounter)

## Objetivo

Documentar el único paso pendiente para que las analíticas midan datos
reales, y qué mide cada cosa mientras tanto.

---

# Por qué GoatCounter

Decisión de producto (ver `docs/STACK_DECISIONS.md`): sin cookies, sin datos
personales, no requiere banner de consentimiento legal (a diferencia de
Google Analytics). Gratuito para proyectos sin fines de lucro/open source
como ATP. El sitio de ATP entra en esa categoría.

---

# Qué ya está listo (código)

- Script de conteo de visitas en `src/layouts/BaseLayout.astro` — cuenta
  vistas de página automáticamente en todo el sitio, sin configuración
  adicional por página.
- `Button.astro` tiene un prop opcional `trackId` que agrega el atributo
  `data-goatcounter-click`, lo que GoatCounter reconoce solo para medir clics
  puntuales sin escribir JS a mano en cada botón.
- Instrumentado con `trackId` (clics que valen la pena medir, no todos):
  - Biblioteca → botón "Descargar" de cada libro.
  - Herramientas → botón "Acceder" de cada herramienta.
  - Actividades (home, listado y detalle) → botón "Inscribirse".
  - Sumate a ATP → botón "Completar formulario".
- Búsqueda de Biblioteca → evento con el término buscado (debounced, un
  evento por búsqueda "asentada", no uno por tecla), en el `<script>` de
  `src/pages/biblioteca.astro`.
- Botones de navegación pura (nav, "Ver más", "Sumate a ATP" como link
  interno, etc.) quedaron **sin** instrumentar a propósito: esa navegación ya
  se refleja como vista de página en el destino, instrumentarla de nuevo
  sería juntar datos redundantes (ver `docs/STACK_DECISIONS.md`: "las
  métricas deben servir para mejorar el producto, no para recopilar datos
  innecesarios").

---

# Qué falta (acción externa, no código)

## 1. Crear la cuenta en GoatCounter

1. Ir a [goatcounter.com](https://www.goatcounter.com) → **Sign up**.
2. Elegir un "site code" (subdominio), por ejemplo `atp` (quedaría en
   `atp.goatcounter.com`).
3. En el formulario de registro, marcar que es para un proyecto sin fines de
   lucro/open source si corresponde, para el plan gratuito.

## 2. Completar el placeholder en el código

En `src/config/site.ts`, reemplazar:

```ts
goatcounterSite: 'TU-CODIGO-GOATCOUNTER',
```

por el site code real elegido en el paso 1 (por ejemplo `'atp'`).

Con eso, el script de `BaseLayout.astro` ya apunta al sitio real y empieza a
contar.

---

# Verificar que funciona

1. Con el site code real cargado, hacer `npm run build` y `npm run preview`
   (o esperar al próximo deploy).
2. Navegar el sitio y volver al panel de GoatCounter — las vistas aparecen
   casi al instante.
3. Probar descargar un libro, inscribirse a una actividad o buscar algo en
   Biblioteca — esos aparecen en GoatCounter bajo "Events", no en el listado
   principal de páginas.
