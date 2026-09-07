import * as React from 'react';
import { pdfjsLib } from '@/lib/pdfWorker';
import { showToast } from '@/lib/toast';
import {
  createDefaultFields,
  clamp,
  MIN_CERTIFICATE_FIELD_SIZE_PT,
  type CertificateField,
} from '@/lib/certificateFields';
import { generateCertificatePdf } from '@/lib/generateCertificatePdf';
import CertificateReviewCarousel, {
  type GeneratedCertificate,
} from '@/components/CertificateReviewCarousel.tsx';
import CertificateSendPanel from '@/components/CertificateSendPanel.tsx';

/*
 * Fase 3 del sistema de certificados: subir la plantilla en PDF (el
 * diseño ya armado, provisto por el dueño del proyecto) y marcar dónde
 * va cada dato (nombre/apellido/DNI) arrastrando recuadros sobre el PDF
 * real — no una aproximación. El PDF se renderiza con pdf.js para que la
 * posición que se ve acá sea la misma que va a usar pdf-lib en la Fase 4
 * para escribir el texto de verdad.
 *
 * El PDF nunca se manda a ningún lado ni se guarda: vive solo en la
 * memoria de esta página mientras dura la sesión de trabajo (ver
 * decisión de arquitectura del plan — nada se persiste hasta el envío
 * real de cada certificado, en una fase posterior).
 */

const CANVAS_MAX_WIDTH_PX = 720;

type DragMode = 'move' | 'resize';

interface DragState {
  mode: DragMode;
  key: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startXPt: number;
  startYPt: number;
  startWidthPt: number;
  startHeightPt: number;
  /** Ancla del borde superior en puntos PDF — se mantiene fija durante el resize. */
  topPt: number;
}

interface AttendeeRecord {
  registrationId: string;
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  asistio: boolean;
  certificadoEnviado: string | null;
}

interface AttendeesLoadedDetail {
  sheetName: string;
  attendees: AttendeeRecord[];
}

export default function CertificateFieldEditor() {
  const [sheetName, setSheetName] = React.useState<string | null>(null);
  const [pendingAttendees, setPendingAttendees] = React.useState<AttendeeRecord[]>([]);
  const [pageSize, setPageSize] = React.useState<{ widthPt: number; heightPt: number } | null>(
    null,
  );
  const [fields, setFields] = React.useState<CertificateField[]>([]);
  const [activeFieldKey, setActiveFieldKey] = React.useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = React.useState(false);
  const [containerWidth, setContainerWidth] = React.useState(0);
  const [generatedCertificates, setGeneratedCertificates] = React.useState<GeneratedCertificate[]>(
    [],
  );
  const [isBatchApproved, setIsBatchApproved] = React.useState(false);
  const [generationProgress, setGenerationProgress] = React.useState<{
    done: number;
    total: number;
  } | null>(null);
  // Cambia en cada tanda nueva generada — se usa como `key` del carrusel
  // de revisión para que arranque de cero (posición, aprobación) en cada
  // tanda, sin que tocar el checkbox "incluir" de un certificado
  // (que también actualiza el array) dispare el mismo reseteo.
  const [batchId, setBatchId] = React.useState(0);

  const resizeObserverRef = React.useRef<ResizeObserver | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const pdfPageRef = React.useRef<pdfjsLib.PDFPageProxy | null>(null);
  const templateBytesRef = React.useRef<Uint8Array | null>(null);
  const dragStateRef = React.useRef<DragState | null>(null);

  // El dashboard existente (certificados.astro, Fases 1-2, ya en
  // producción) ya elige actividad y trae los asistentes — este
  // componente escucha ese resultado en vez de volver a pedirlo, así no
  // se duplica el fetch ni se arriesga a desincronizar los dos.
  React.useEffect(() => {
    function handleAttendeesLoaded(event: Event) {
      const { sheetName: newSheetName, attendees } = (event as CustomEvent<AttendeesLoadedDetail>)
        .detail;
      setSheetName((previous) => {
        if (previous !== newSheetName) resetTemplate();
        return newSheetName;
      });
      setPendingAttendees(attendees.filter((a) => a.asistio && !a.certificadoEnviado));
    }
    window.addEventListener('atp:certificate-attendees', handleAttendeesLoaded);
    return () => window.removeEventListener('atp:certificate-attendees', handleAttendeesLoaded);
  }, []);

  // Ref-callback en vez de useRef+useEffect: el div del contenedor recién
  // existe cuando pageSize deja de ser null (se renderiza condicionalmente
  // después de subir el PDF) — un useEffect con [] de dependencias corre
  // una sola vez al montar el componente, antes de que ese div exista, y
  // nunca se vuelve a ejecutar cuando el div aparece más tarde. Un
  // ref-callback en cambio se dispara cada vez que React crea o destruye
  // el nodo, así que siempre queda conectado al div real.
  const containerRefCallback = React.useCallback((node: HTMLDivElement | null) => {
    resizeObserverRef.current?.disconnect();
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(Math.min(width, CANVAS_MAX_WIDTH_PX));
    });
    observer.observe(node);
    resizeObserverRef.current = observer;
  }, []);

  const scale = pageSize && containerWidth ? containerWidth / pageSize.widthPt : 0;

  function resetTemplate() {
    pdfPageRef.current = null;
    templateBytesRef.current = null;
    setPageSize(null);
    setFields([]);
    setActiveFieldKey(null);
    setGeneratedCertificates([]);
    setGenerationProgress(null);
    setIsBatchApproved(false);
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsLoadingPdf(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      // pdf.js toma posesión del array que se le pasa — se guarda una
      // copia aparte para pdf-lib, que la va a necesitar intacta más
      // tarde (una vez por certificado a generar en la Fase 5).
      const pdf = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
      if (pdf.numPages !== 1) {
        showToast({
          message: `Ese PDF tiene ${pdf.numPages} páginas — subí uno de una sola página (la plantilla del certificado, vacía de datos).`,
          variant: 'error',
        });
        return;
      }
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      pdfPageRef.current = page;
      templateBytesRef.current = bytes;
      setPageSize({ widthPt: viewport.width, heightPt: viewport.height });
      setFields(createDefaultFields(viewport.width, viewport.height));
      setActiveFieldKey(null);
      setGeneratedCertificates([]);
      setGenerationProgress(null);
      setIsBatchApproved(false);
    } catch {
      showToast({
        message: 'No se pudo leer ese archivo como PDF — probá subirlo de nuevo.',
        variant: 'error',
      });
    } finally {
      setIsLoadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // Se vuelve a dibujar cada vez que cambia la escala (el ancho
  // disponible cambió, p. ej. al redimensionar la ventana) para que el
  // PDF se vea siempre nítido, no estirado desde una resolución fija.
  React.useEffect(() => {
    const page = pdfPageRef.current;
    const canvas = canvasRef.current;
    if (!page || !canvas || !scale) return;

    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d');
    if (!context) return;

    const renderTask = page.render({ canvasContext: context, viewport, canvas });
    renderTask.promise.catch(() => {});
    return () => renderTask.cancel();
  }, [scale, pageSize]);

  async function handleGenerateForReview() {
    const templateBytes = templateBytesRef.current;
    if (!templateBytes || pendingAttendees.length === 0) return;

    setGenerationProgress({ done: 0, total: pendingAttendees.length });
    const results: GeneratedCertificate[] = [];

    for (const attendee of pendingAttendees) {
      try {
        const pdfBytes = await generateCertificatePdf(templateBytes, fields, {
          nombre: attendee.nombre,
          apellido: attendee.apellido,
          dni: attendee.dni,
        });
        results.push({ attendee, pdfBytes, included: true });
      } catch {
        showToast({
          message: `No se pudo generar el certificado de ${attendee.nombre} ${attendee.apellido} — se lo salteó, revisá sus datos en la planilla.`,
          variant: 'error',
        });
      }
      setGenerationProgress((previous) =>
        previous ? { done: previous.done + 1, total: previous.total } : previous,
      );
    }

    setGeneratedCertificates(results);
    setGenerationProgress(null);
    setIsBatchApproved(false);
    setBatchId((id) => id + 1);
  }

  function updateFontSize(key: string, fontSize: number) {
    setFields((previous) => previous.map((f) => (f.key === key ? { ...f, fontSize } : f)));
  }

  function handleMovePointerDown(event: React.PointerEvent, key: string) {
    const field = fields.find((f) => f.key === key);
    if (!field) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      mode: 'move',
      key,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startXPt: field.xPt,
      startYPt: field.yPt,
      startWidthPt: field.widthPt,
      startHeightPt: field.heightPt,
      topPt: field.yPt + field.heightPt,
    };
    setActiveFieldKey(key);
  }

  function handleResizePointerDown(event: React.PointerEvent, key: string) {
    event.stopPropagation();
    const field = fields.find((f) => f.key === key);
    if (!field) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      mode: 'resize',
      key,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startXPt: field.xPt,
      startYPt: field.yPt,
      startWidthPt: field.widthPt,
      startHeightPt: field.heightPt,
      topPt: field.yPt + field.heightPt,
    };
    setActiveFieldKey(key);
  }

  function handlePointerMove(event: React.PointerEvent) {
    const drag = dragStateRef.current;
    if (!drag || !pageSize || !scale || drag.pointerId !== event.pointerId) return;

    const dxPt = (event.clientX - drag.startClientX) / scale;
    const dyPt = (event.clientY - drag.startClientY) / scale;

    setFields((previous) =>
      previous.map((f) => {
        if (f.key !== drag.key) return f;

        if (drag.mode === 'move') {
          return {
            ...f,
            xPt: clamp(drag.startXPt + dxPt, 0, pageSize.widthPt - f.widthPt),
            // La pantalla crece hacia abajo, los puntos PDF crecen hacia arriba.
            yPt: clamp(drag.startYPt - dyPt, 0, pageSize.heightPt - f.heightPt),
          };
        }

        const widthPt = clamp(
          drag.startWidthPt + dxPt,
          MIN_CERTIFICATE_FIELD_SIZE_PT,
          pageSize.widthPt - drag.startXPt,
        );
        const heightPt = clamp(
          drag.startHeightPt + dyPt,
          MIN_CERTIFICATE_FIELD_SIZE_PT,
          drag.topPt,
        );
        return { ...f, widthPt, heightPt, yPt: drag.topPt - heightPt };
      }),
    );
  }

  function handlePointerUp() {
    dragStateRef.current = null;
  }

  return (
    <div className="border-border bg-surface flex flex-col gap-4 rounded-md border p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-h4 text-text font-bold">Plantilla y posición de los datos</h2>
        <p className="text-body-sm text-text-secondary">
          {sheetName
            ? `Subí el diseño del certificado (PDF de una sola página, vacío de datos) y arrastrá los recuadros hasta donde va cada dato.${pendingAttendees.length > 0 ? ` Hay ${pendingAttendees.length} certificado${pendingAttendees.length === 1 ? '' : 's'} pendiente${pendingAttendees.length === 1 ? '' : 's'} de generar para esta actividad.` : ''}`
            : 'Elegí una actividad arriba para poder subir la plantilla del certificado.'}
        </p>
      </div>

      {sheetName && (
        <>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              disabled={isLoadingPdf}
              aria-label="Subir plantilla del certificado en PDF"
              className="text-body-sm text-text-secondary file:bg-primary-fill file:text-primary-fill-foreground file:mr-3 file:rounded-sm file:border-0 file:px-4 file:py-2 file:font-semibold file:hover:brightness-110"
            />
          </div>

          {pageSize && (
            <>
              <div
                ref={containerRefCallback}
                className="relative w-full max-w-[720px] touch-none overflow-hidden rounded-sm border border-dashed"
                style={{ aspectRatio: `${pageSize.widthPt} / ${pageSize.heightPt}` }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                <canvas ref={canvasRef} className="pointer-events-none block w-full" />
                {fields.map((field) => {
                  const leftPx = field.xPt * scale;
                  const topPx = (pageSize.heightPt - field.yPt - field.heightPt) * scale;
                  const widthPx = field.widthPt * scale;
                  const heightPx = field.heightPt * scale;
                  const isActive = activeFieldKey === field.key;
                  return (
                    <div
                      key={field.key}
                      role="button"
                      tabIndex={0}
                      aria-label={`Campo ${field.label} — arrastrar para reposicionar`}
                      onPointerDown={(event) => handleMovePointerDown(event, field.key)}
                      className={
                        'absolute flex cursor-move items-center justify-center overflow-hidden border-2 text-center leading-none font-semibold select-none ' +
                        (isActive
                          ? 'border-secondary-strong bg-secondary/20 text-secondary-strong'
                          : 'border-secondary-strong/50 bg-secondary/10 text-secondary-strong/80')
                      }
                      style={{
                        left: leftPx,
                        top: topPx,
                        width: widthPx,
                        height: heightPx,
                        fontSize: Math.max(field.fontSize * scale, 8),
                      }}
                    >
                      {field.label}
                      <div
                        role="presentation"
                        onPointerDown={(event) => handleResizePointerDown(event, field.key)}
                        className="bg-secondary-strong absolute right-0 bottom-0 size-3 cursor-se-resize rounded-tl-xs"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
                {fields.map((field) => (
                  <label
                    key={field.key}
                    className="text-body-sm text-text-secondary flex items-center gap-2"
                  >
                    {field.label} — tamaño de letra
                    <input
                      type="number"
                      min={6}
                      max={96}
                      value={Math.round(field.fontSize)}
                      onChange={(event) => updateFontSize(field.key, Number(event.target.value))}
                      className="border-border-strong bg-surface text-text w-16 rounded-xs border px-2 py-1"
                    />
                  </label>
                ))}
              </div>

              <div className="border-border-strong flex flex-col gap-3 border-t pt-4">
                <button
                  type="button"
                  onClick={handleGenerateForReview}
                  disabled={pendingAttendees.length === 0 || generationProgress !== null}
                  className="bg-primary-fill text-primary-fill-foreground text-body inline-flex h-10 w-fit items-center justify-center rounded-sm px-4 font-semibold hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {generationProgress
                    ? `Generando ${generationProgress.done} de ${generationProgress.total}…`
                    : `Generar ${pendingAttendees.length} certificado${pendingAttendees.length === 1 ? '' : 's'} para revisar`}
                </button>
                {pendingAttendees.length === 0 && (
                  <p className="text-body-sm text-text-secondary">
                    No hay certificados pendientes de generar para esta actividad (nadie asistió sin
                    certificado ya enviado).
                  </p>
                )}
              </div>

              {generatedCertificates.length > 0 && (
                <CertificateReviewCarousel
                  key={batchId}
                  certificates={generatedCertificates}
                  onChangeCertificates={setGeneratedCertificates}
                  isApproved={isBatchApproved}
                  onChangeApproved={setIsBatchApproved}
                />
              )}

              {isBatchApproved && sheetName && (
                <CertificateSendPanel sheetName={sheetName} certificates={generatedCertificates} />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
