import * as React from 'react';
import { jsonpRequest } from '@/lib/jsonp';
import { GOOGLE_FORMS_ENDPOINT } from '@/lib/googleFormsEndpoint';
import { showToast } from '@/lib/toast';
import type { GeneratedCertificate } from '@/components/CertificateReviewCarousel.tsx';

/*
 * Fases 6+7 del sistema de certificados: el envío real, uno por uno,
 * nunca automático — recién aparece después de aprobar el lote (Fase 5).
 * Modo de prueba (Fase 7) activado por defecto: mientras esté tildado,
 * TODOS los mails (con el PDF real adjunto) caen en la casilla de ATP en
 * vez de en la de cada persona, para poder probar el flujo entero sin
 * arriesgar mandarle algo a gente real.
 *
 * Cada certificado se manda con 2 pedidos al Apps Script (mismo patrón
 * que ya usan las campañas de mail): un POST que guarda el PDF en el
 * cache del script (un PDF en base64 no entra en la URL de un GET), y un
 * GET/JSONP aparte que hace el envío real y devuelve el resultado — así
 * el navegador sabe de verdad si salió bien o mal, y puede reintentar
 * solo lo que falta sin mandar de nuevo lo que ya salió.
 */

const SESSION_KEY = 'atp-admin-token';

type SendStatus = 'pending' | 'sending' | 'sent' | 'error';

interface CertificateSendPanelProps {
  sheetName: string;
  certificates: GeneratedCertificate[];
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export default function CertificateSendPanel({
  sheetName,
  certificates,
}: CertificateSendPanelProps) {
  const [testMode, setTestMode] = React.useState(true);
  const [isSending, setIsSending] = React.useState(false);
  const [statuses, setStatuses] = React.useState<Record<string, SendStatus>>({});
  const [errorMessages, setErrorMessages] = React.useState<Record<string, string>>({});

  const included = certificates.filter((c) => c.included);
  const sentCount = included.filter((c) => statuses[c.attendee.registrationId] === 'sent').length;
  const errorCount = included.filter((c) => statuses[c.attendee.registrationId] === 'error').length;
  // "Pendiente" acá significa "todavía no se mandó bien" — un error
  // sigue contando como pendiente (el botón "Seguir enviando" lo
  // reintenta), nunca se lo descarta solo. Antes esto restaba errorCount
  // también, así que un solo error dejaba el botón deshabilitado para
  // siempre sin ninguna forma de reintentar desde la pantalla.
  const pendingCount = included.length - sentCount;

  async function sendOne(certificate: GeneratedCertificate, token: string): Promise<void> {
    const id = certificate.attendee.registrationId;
    setStatuses((previous) => ({ ...previous, [id]: 'sending' }));

    try {
      const requestId = crypto.randomUUID();
      const fullName = `${certificate.attendee.nombre} ${certificate.attendee.apellido}`.trim();

      await fetch(GOOGLE_FORMS_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        body: new URLSearchParams({
          action: 'adminStageCertificate',
          token,
          sheetName,
          registrationId: certificate.attendee.registrationId,
          requestId,
          pdfBase64: uint8ArrayToBase64(certificate.pdfBytes),
          filename: `certificado-${fullName.replace(/\s+/g, '-')}.pdf`,
          recipientName: fullName,
          recipientEmail: certificate.attendee.email,
          activityTitle: sheetName,
          testMode: String(testMode),
        }),
      });

      const result = await jsonpRequest<{ result: string; message?: string }>(
        GOOGLE_FORMS_ENDPOINT,
        {
          action: 'adminSendCertificate',
          token,
          requestId,
        },
      );

      if (result.result === 'success' || result.result === 'already_sent') {
        setStatuses((previous) => ({ ...previous, [id]: 'sent' }));
      } else {
        setStatuses((previous) => ({ ...previous, [id]: 'error' }));
        setErrorMessages((previous) => ({ ...previous, [id]: result.message || result.result }));
      }
    } catch {
      setStatuses((previous) => ({ ...previous, [id]: 'error' }));
      setErrorMessages((previous) => ({ ...previous, [id]: 'Error de red' }));
    }
  }

  async function handleSend() {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) {
      showToast({
        message: 'Tu sesión venció — volvé a entrar desde /staff/panel/.',
        variant: 'error',
      });
      return;
    }

    setIsSending(true);
    for (const certificate of included) {
      // Reintentar solo deja pendiente lo que no salió — lo ya enviado
      // (en este intento o en uno anterior de la misma tanda) no se toca,
      // así "seguir enviando" nunca duplica un mail que ya salió bien.
      if (statuses[certificate.attendee.registrationId] === 'sent') continue;
      await sendOne(certificate, token);
    }
    setIsSending(false);
  }

  const attemptedAtLeastOnce = Object.keys(statuses).length > 0;

  return (
    <div className="border-border-strong flex flex-col gap-4 border-t pt-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-h4 text-text font-bold">Enviar certificados</h3>
        <p className="text-body-sm text-text-secondary">
          Esto sí manda mails de verdad, con el PDF adjunto. Revisá el modo de prueba antes de
          apretar enviar.
        </p>
      </div>

      <label className="border-warning-strong bg-warning/10 text-text flex items-center gap-2 rounded-sm border p-3 font-semibold">
        <input
          type="checkbox"
          checked={testMode}
          onChange={(event) => setTestMode(event.target.checked)}
          disabled={isSending}
          className="size-4"
        />
        Modo de prueba: mandar todo a la casilla de ATP en vez del mail real de cada persona
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending || included.length === 0 || pendingCount === 0}
          className="bg-primary-fill text-primary-fill-foreground text-body inline-flex h-10 items-center justify-center rounded-sm px-4 font-semibold hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSending
            ? `Enviando… (${sentCount + errorCount} de ${included.length})`
            : attemptedAtLeastOnce && pendingCount > 0
              ? `Seguir enviando (${pendingCount} pendientes)`
              : `Enviar ${included.length} certificado${included.length === 1 ? '' : 's'}${testMode ? ' (modo de prueba)' : ''}`}
        </button>
        {attemptedAtLeastOnce && (
          <p className="text-body-sm text-text-secondary" aria-live="polite">
            {sentCount} enviados, {errorCount} con error, {pendingCount} pendientes
          </p>
        )}
      </div>

      {attemptedAtLeastOnce && (
        <ul className="flex flex-col gap-1">
          {included.map((certificate) => {
            const id = certificate.attendee.registrationId;
            const status = statuses[id];
            return (
              <li key={id} className="text-body-sm flex items-center justify-between gap-2">
                <span className="text-text">
                  {certificate.attendee.nombre} {certificate.attendee.apellido}
                </span>
                <span
                  className={
                    status === 'sent'
                      ? 'text-success-strong font-semibold'
                      : status === 'error'
                        ? 'text-error-strong font-semibold'
                        : status === 'sending'
                          ? 'text-secondary-strong font-semibold'
                          : 'text-text-secondary'
                  }
                  title={status === 'error' ? errorMessages[id] : undefined}
                >
                  {status === 'sent' && 'Enviado'}
                  {status === 'error' && 'Error'}
                  {status === 'sending' && 'Enviando…'}
                  {!status && 'Pendiente'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
