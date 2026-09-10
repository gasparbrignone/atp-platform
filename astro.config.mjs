// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';

// https://astro.build/config
// Dominio propio confirmado (atpfcm.com.ar, comprado en nic.ar) — sin `base`:
// al ser un dominio propio en la raíz, no un project site de GitHub Pages,
// ninguno de los links internos absolutos del sitio (p. ej. href="/biblioteca/")
// necesita un prefijo y no se rompen.
//
// El build genera cada ruta como carpeta + index.html (ej.
// `biblioteca/index.html`), y GitHub Pages devuelve 301 de `/biblioteca` a
// `/biblioteca/` — visto en producción como "página con redirección" en
// Search Console para varias URLs. Por eso todo link interno del sitio
// (Navbar, Footer, canonicalPath, "volver a...", etc.) termina con `/`: sin
// eso, cada click y cada URL del sitemap le suma un salto de redirect de
// más a quien visita y a Google.
export default defineConfig({
  site: 'https://atpfcm.com.ar',
  integrations: [
    // /staff/ ya está fuera de robots.txt (herramientas internas, no
    // contenido del sitio) — sin este filtro, sitemap.xml (un archivo
    // público) las listaba igual, delatando esas URLs a cualquiera que lo
    // lea, aunque los crawlers tengan la orden de no seguirlas.
    sitemap({ filter: (page) => !page.includes('/staff/') }),
    react(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  // Content-Security-Policy vía <meta> por página (Astro calcula el hash
  // exacto de cada script/estilo inline en build, no requiere tocar el
  // código) — ver docs/SECURITY_HEADERS.md. Orígenes externos permitidos,
  // uno por uno, según lo que usa el sitio:
  //  - script.google.com: el Apps Script que recibe todos los formularios
  //    (fetch normal) y el check-in por QR de /staff/escanear/ (JSONP, así
  //    que además necesita estar en script-src, no solo connect-src).
  //  - script.googleusercontent.com: TODA respuesta de script.google.com
  //    (fetch o JSONP) llega vía un 302 a este otro dominio — sin permitirlo
  //    acá también, el navegador guarda igual (el POST ya llegó al Apps
  //    Script) pero el fetch/script del sitio termina en error porque no
  //    puede seguir esa redirección. Confirmado con curl -v contra el
  //    endpoint real: `Location: https://script.googleusercontent.com/...`.
  //  - gc.zgo.at / *.goatcounter.com: analíticas (GoatCounter).
  //  - i.ytimg.com / youtube-nocookie.com: miniaturas y embed de YouTube.
  //  - covers.openlibrary.org: tapa de libro remota para las entradas de
  //    la Biblioteca que no subieron una propia a /uploads/ (ver
  //    src/lib/uploadThumb.ts) — sin esto, el navegador bloqueaba la
  //    imagen en silencio y la tapa nunca se veía en /biblioteca/.
  //    *.archive.org: algunas tapas de covers.openlibrary.org no están
  //    en su caché y redirigen (302) a archive.org, que a su vez
  //    redirige otra vez a un subdominio numerado que varía en cada
  //    pedido (ej. ia800505.us.archive.org — el nodo del CDN de
  //    Internet Archive que tenga ese ítem) — de ahí el comodín, no
  //    alcanza con permitir el dominio exacto. Mismo patrón que la
  //    redirección de Apps Script de abajo, confirmado viendo el error
  //    real en consola del navegador.
  //  - data: en img-src: el QR de acceso (ActivityCertificateRegistrationForm.astro)
  //    se genera en el propio navegador con la librería `qrcode` como un
  //    data URI (`QRCode.toDataURL`), no un archivo — sin esto, la imagen
  //    quedaba bloqueada aunque se generara bien.
  //  - atp-checkin-worker.gasparbrignone1.workers.dev: Worker de
  //    Cloudflare que hace el check-in rápido por QR en
  //    /staff/escanear/ (ver cloudflare/checkin-worker/) — camino
  //    RÁPIDO opcional, con Apps Script como respaldo automático si esto
  //    no responde. Un fetch normal (no JSONP): el Worker sí manda
  //    headers CORS propios, a diferencia de Apps Script.
  //  - challenges.cloudflare.com: widget de Turnstile (anti-bot) en los
  //    formularios que postean al Apps Script — necesita script-src (carga
  //    su propio JS), connect-src (llamadas propias del widget) y
  //    frame-src (a veces renderiza el desafío dentro de un iframe).
  //  - static.cloudflareinsights.com: script propio que el widget de
  //    Turnstile carga para su verificación (parte del producto, no algo
  //    que se pueda desactivar).
  //  - *.clarity.ms: Microsoft Clarity (grabación de sesiones + mapas de
  //    calor, ver BaseLayout.astro) — www.clarity.ms sirve el tag
  //    inicial, que carga el script real desde scripts.clarity.ms, que
  //    manda datos de vuelta rotando entre varios subdominios de una
  //    sola letra (c., e., o.clarity.ms confirmados con un navegador
  //    real, probablemente más) — de ahí el comodín en vez de listarlos
  //    uno por uno, mismo criterio que *.archive.org más arriba. Nunca
  //    corre en /staff/** (esas páginas no usan BaseLayout).
  //
  //    A PROPÓSITO no se agregó c.bing.com: Clarity intenta un pixel de
  //    sincronización hacia ese dominio (publicidad de Microsoft/Bing
  //    Ads, no hace falta para grabar sesiones ni mapas de calor) —
  //    encontrado con el mismo navegador real de arriba. Se deja
  //    bloqueado por la CSP a propósito, coherente con la decisión ya
  //    tomada de no sumar tracking publicitario (ver por qué se descartó
  //    Google Analytics en docs/STACK_DECISIONS.md). Si Clarity deja de
  //    funcionar bien en el futuro, revisar si agregó una dependencia
  //    nueva de este pixel antes de habilitarlo sin pensarlo.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data: https://i.ytimg.com https://covers.openlibrary.org https://archive.org https://*.archive.org https://atpfcm.goatcounter.com https://*.clarity.ms",
        "connect-src 'self' https://script.google.com https://script.googleusercontent.com https://atp-checkin-worker.gasparbrignone1.workers.dev https://gc.zgo.at https://atpfcm.goatcounter.com https://challenges.cloudflare.com https://*.clarity.ms",
        "frame-src 'self' https://www.youtube-nocookie.com https://challenges.cloudflare.com",
        "font-src 'self'",
        "form-action 'self'",
        "base-uri 'self'",
        "object-src 'none'",
      ],
      scriptDirective: {
        resources: [
          "'self'",
          'https://script.google.com',
          'https://script.googleusercontent.com',
          'https://gc.zgo.at',
          'https://challenges.cloudflare.com',
          'https://static.cloudflareinsights.com',
          'https://*.clarity.ms',
        ],
      },
    },
  },
});
