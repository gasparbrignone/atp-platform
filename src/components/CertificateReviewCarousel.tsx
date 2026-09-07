import * as React from 'react';
import { pdfjsLib } from '@/lib/pdfWorker';

/*
 * Fase 5 del sistema de certificados: mostrar cada PDF ya generado
 * (Fase 4) con el dato real de cada persona, uno por uno (‹ anterior /
 * siguiente ›), para que el staff los revise de verdad antes de mandar
 * nada — y recién ahí aprobar el lote completo de una vez (decisión ya
 * tomada por el dueño del proyecto: aprobación por lote, no una por una).
 *
 * "Aprobar" acá solo deja un estado local marcado como revisado — todavía
 * no manda ningún mail real, eso es una fase aparte que necesita su
 * propia autorización explícita antes de construirse.
 */

export interface CertificateAttendee {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
}

export interface GeneratedCertificate {
  attendee: CertificateAttendee;
  pdfBytes: Uint8Array;
  /** Permite sacar a alguien puntual del lote sin descartar el resto (p. ej. si algo se ve mal). */
  included: boolean;
}

interface CertificateReviewCarouselProps {
  certificates: GeneratedCertificate[];
  onChangeCertificates: (next: GeneratedCertificate[]) => void;
}

const PREVIEW_MAX_WIDTH_PX = 720;

export default function CertificateReviewCarousel({
  certificates,
  onChangeCertificates,
}: CertificateReviewCarouselProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isApproved, setIsApproved] = React.useState(false);
  const [containerWidth, setContainerWidth] = React.useState(0);

  const resizeObserverRef = React.useRef<ResizeObserver | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const containerRefCallback = React.useCallback((node: HTMLDivElement | null) => {
    resizeObserverRef.current?.disconnect();
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(Math.min(width, PREVIEW_MAX_WIDTH_PX));
    });
    observer.observe(node);
    resizeObserverRef.current = observer;
  }, []);

  const current = certificates[currentIndex];

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!current || !canvas || !containerWidth) return;
    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;

    (async () => {
      // .slice(): pdf.js toma posesión de los bytes que se le pasan — acá
      // se navega hacia adelante y atrás entre certificados, así que cada
      // uno se tiene que poder volver a abrir tantas veces como haga
      // falta sin que quede corrompido para, por ejemplo, la Fase 6.
      const pdf = await pdfjsLib.getDocument({ data: current.pdfBytes.slice() }).promise;
      if (cancelled) return;
      const page = await pdf.getPage(1);
      if (cancelled) return;

      const baseViewport = page.getViewport({ scale: 1 });
      const scale = containerWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');
      if (!context || cancelled) return;

      const task = page.render({ canvasContext: context, viewport, canvas });
      renderTask = task;
      await task.promise.catch(() => {});
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [current, containerWidth]);

  function toggleIncluded(index: number) {
    onChangeCertificates(
      certificates.map((certificate, i) =>
        i === index ? { ...certificate, included: !certificate.included } : certificate,
      ),
    );
    setIsApproved(false);
  }

  if (!current) return null;

  const includedCount = certificates.filter((c) => c.included).length;

  return (
    <div className="border-border-strong flex flex-col gap-4 border-t pt-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-h4 text-text font-bold">Revisar antes de aprobar el lote</h3>
        <p className="text-body-sm text-text-secondary">
          Recorré cada certificado generado y confirmá que los datos se ven bien. Después aprobás el
          lote completo de una — mandar los mails es un paso aparte, separado de esto.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="border-border-strong text-text text-body-sm inline-flex h-9 items-center justify-center rounded-sm border px-3 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
        >
          ‹ Anterior
        </button>

        <p className="text-body-sm text-text-secondary text-center" aria-live="polite">
          {currentIndex + 1} de {certificates.length} —{' '}
          <span className="text-text font-semibold">
            {current.attendee.nombre} {current.attendee.apellido}
          </span>{' '}
          ({current.attendee.email})
        </p>

        <button
          type="button"
          onClick={() => setCurrentIndex((i) => Math.min(certificates.length - 1, i + 1))}
          disabled={currentIndex === certificates.length - 1}
          className="border-border-strong text-text text-body-sm inline-flex h-9 items-center justify-center rounded-sm border px-3 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
        >
          Siguiente ›
        </button>
      </div>

      <div
        ref={containerRefCallback}
        className="w-full max-w-[720px] overflow-hidden rounded-sm border"
      >
        <canvas ref={canvasRef} className="block w-full" />
      </div>

      <label className="text-body-sm text-text flex items-center gap-2 font-semibold">
        <input
          type="checkbox"
          checked={current.included}
          onChange={() => toggleIncluded(currentIndex)}
          className="size-4"
        />
        Incluir este certificado en el lote
      </label>

      <div className="border-border-strong flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body-sm text-text-secondary">
          {includedCount} de {certificates.length} certificado{certificates.length === 1 ? '' : 's'}{' '}
          incluido{includedCount === 1 ? '' : 's'} en el lote.
        </p>

        {isApproved ? (
          <div className="flex items-center gap-3">
            <span className="text-success-strong text-body-sm font-semibold">
              ✓ Lote aprobado — listo para la próxima etapa (envío)
            </span>
            <button
              type="button"
              onClick={() => setIsApproved(false)}
              className="text-body-sm text-text-secondary font-semibold underline-offset-2 hover:underline"
            >
              Deshacer aprobación
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsApproved(true)}
            disabled={includedCount === 0}
            className="bg-primary-fill text-primary-fill-foreground text-body inline-flex h-10 items-center justify-center rounded-sm px-4 font-semibold hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Aprobar lote ({includedCount})
          </button>
        )}
      </div>
    </div>
  );
}
