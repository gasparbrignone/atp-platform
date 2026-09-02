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
  integrations: [sitemap(), react()],
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
  //  - data: en img-src: el QR de acceso (ActivityCertificateRegistrationForm.astro)
  //    se genera en el propio navegador con la librería `qrcode` como un
  //    data URI (`QRCode.toDataURL`), no un archivo — sin esto, la imagen
  //    quedaba bloqueada aunque se generara bien.
  //  - challenges.cloudflare.com: widget de Turnstile (anti-bot) en los
  //    formularios que postean al Apps Script — necesita script-src (carga
  //    su propio JS), connect-src (llamadas propias del widget) y
  //    frame-src (a veces renderiza el desafío dentro de un iframe).
  //  - static.cloudflareinsights.com: script propio que el widget de
  //    Turnstile carga para su verificación (parte del producto, no algo
  //    que se pueda desactivar).
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data: https://i.ytimg.com https://atpfcm.goatcounter.com",
        "connect-src 'self' https://script.google.com https://script.googleusercontent.com https://gc.zgo.at https://atpfcm.goatcounter.com https://challenges.cloudflare.com",
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
        ],
      },
    },
  },
});
