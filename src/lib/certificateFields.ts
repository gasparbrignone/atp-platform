/**
 * Modelo de datos compartido para el editor visual de campos de
 * certificados (Fase 3) y la generación real con pdf-lib (Fase 4).
 *
 * Coordenadas en puntos PDF (origen abajo-a-la-izquierda, igual que
 * pdf-lib/pdf.js) — así la Fase 4 puede usar xPt/yPt directo en
 * `page.drawText` sin volver a convertir nada.
 */

export interface CertificateFieldDefinition {
  key: string;
  label: string;
}

export interface CertificateField extends CertificateFieldDefinition {
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
  fontSize: number;
}

// Nombre y apellido van en un solo campo (pedido explícito del dueño del
// proyecto: en sus diseños de certificado el nombre completo ocupa un
// único renglón, no dos separados) — la estructura sigue siendo un
// array, no campos sueltos, para poder sumar más adelante (p. ej.
// "carrera") sin tocar el editor ni el modelo de datos.
export const CERTIFICATE_FIELD_DEFINITIONS: CertificateFieldDefinition[] = [
  { key: 'nombreCompleto', label: 'Nombre y apellido' },
  { key: 'dni', label: 'DNI' },
];

const MIN_FIELD_SIZE_PT = 20;

// Posiciones iniciales como fracción del ancho/alto de la página (0-1),
// no en puntos fijos — la plantilla real puede ser A4, Letter, apaisada,
// etc., y recién se conoce su tamaño cuando el staff la sube. Son solo un
// punto de partida razonable (centrado, apilado) para no arrancar con los
// recuadros amontonados en una esquina; el staff los arrastra a su lugar.
const DEFAULT_LAYOUT_FRACTIONS: Record<
  string,
  { xFrac: number; yFrac: number; widthFrac: number; heightFrac: number; fontSize: number }
> = {
  nombreCompleto: { xFrac: 0.15, yFrac: 0.48, widthFrac: 0.7, heightFrac: 0.12, fontSize: 30 },
  dni: { xFrac: 0.35, yFrac: 0.26, widthFrac: 0.3, heightFrac: 0.05, fontSize: 14 },
};

export function createDefaultFields(pageWidthPt: number, pageHeightPt: number): CertificateField[] {
  return CERTIFICATE_FIELD_DEFINITIONS.map((definition) => {
    const layout = DEFAULT_LAYOUT_FRACTIONS[definition.key];
    return {
      ...definition,
      xPt: layout.xFrac * pageWidthPt,
      yPt: layout.yFrac * pageHeightPt,
      widthPt: layout.widthFrac * pageWidthPt,
      heightPt: layout.heightFrac * pageHeightPt,
      fontSize: layout.fontSize,
    };
  });
}

export function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

export const MIN_CERTIFICATE_FIELD_SIZE_PT = MIN_FIELD_SIZE_PT;
