# ANALYTICS_SETUP.md

# Puesta en marcha de Analíticas (GoatCounter + Microsoft Clarity)

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

---

# Microsoft Clarity (grabación de sesiones + mapas de calor)

## Por qué, además de GoatCounter

GoatCounter cuenta vistas y clics puntuales, pero no puede mostrar
grabaciones de sesiones reales, mapas de calor, ni detectar rage
clicks/dead clicks — justo lo que hacía falta para la auditoría de UX
de 2026-09-06 (ver el informe de esa conversación). Decisión tomada
junto con el dueño del proyecto: sumar Clarity, no reemplazar
GoatCounter (cada uno mide algo distinto).

## Qué ya está listo (código)

- `src/config/site.ts` → `clarityProjectId`: el Project ID real ya está
  cargado (no un placeholder), obtenido de la cuenta gratuita de
  [clarity.microsoft.com](https://clarity.microsoft.com).
- `src/layouts/BaseLayout.astro`: snippet oficial de Microsoft, sin
  modificar. Nunca corre en `/staff/**` porque esas páginas no usan
  este layout — el panel admin y el check-in por QR no se graban.
- `astro.config.mjs`: CSP con `*.clarity.ms` en `img-src`/
  `connect-src`/`script-src` (Clarity rota el endpoint de recolección
  entre varios subdominios de una letra — confirmado con navegador
  real, de ahí el comodín).
- Campos de teléfono/email/DNI de los 4 formularios que piden datos
  personales (`ActivityRegistrationForm`,
  `ActivityCertificateRegistrationForm`, `AgendaSaleSection`,
  `sumate.astro`) llevan `data-clarity-mask="true"` — una grabación de
  sesión nunca muestra esos datos en texto plano.

## Decisión de privacidad: `c.bing.com` bloqueado a propósito

Clarity intenta, de fábrica, un pixel de sincronización hacia
`c.bing.com` (publicidad de Microsoft/Bing Ads) — encontrado probando
con un navegador real, no algo que Clarity documente de entrada. No
hace falta para grabar sesiones ni mapas de calor. Se dejó **fuera** de
la CSP a propósito, así que ese pixel puntual queda bloqueado en
silencio (el resto de Clarity funciona igual). Coherente con la
decisión ya tomada de evitar tracking publicitario (ver por qué se
descartó Google Analytics en `docs/STACK_DECISIONS.md`). Si en algún
momento Clarity deja de funcionar bien, revisar si sumó una
dependencia nueva de ese pixel antes de habilitarlo sin pensarlo.

## Verificar que funciona

1. Entrar a [clarity.microsoft.com](https://clarity.microsoft.com) →
   el proyecto de ATP.
2. Navegar el sitio real en otra pestaña — las grabaciones y los mapas
   de calor tardan unos minutos en aparecer (no es instantáneo como
   GoatCounter).
3. Nunca va a aparecer nada de `/staff/panel/` ni `/staff/escanear/` —
   es el comportamiento esperado, no un error.
