/**
 * `form.reportValidity()` muestra los mensajes de validación nativos del
 * navegador ("Please fill out this field.") en el idioma del navegador/
 * sistema operativo, no en el idioma de la página — un visitante con el
 * navegador en inglés (o portugués) ve errores en inglés en un formulario
 * 100% en español. Bug real encontrado en la auditoría UX del 2026-09-14
 * (recorrido de inscripción a actividades), reproducido igual en desktop y
 * mobile.
 *
 * Esto fuerza un mensaje en español por campo vía `setCustomValidity` —
 * mismo mecanismo de validación nativa (mismo bocadillo, mismo
 * `reportValidity()` ya usado en cada formulario), solo cambia el texto.
 */
export function applySpanishValidationMessages(form: HTMLFormElement): void {
  const fields = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    'input, textarea, select',
  );

  fields.forEach((field) => {
    const updateMessage = () => {
      if (field.validity.valueMissing) {
        field.setCustomValidity('Completá este campo.');
      } else if (field.validity.typeMismatch && 'type' in field && field.type === 'email') {
        field.setCustomValidity('Ingresá un email válido.');
      } else if (field.validity.typeMismatch && 'type' in field && field.type === 'tel') {
        field.setCustomValidity('Ingresá un teléfono válido.');
      } else if (field.validity.tooShort && 'minLength' in field) {
        field.setCustomValidity(`Necesita al menos ${field.minLength} caracteres.`);
      } else if (field.validity.tooLong && 'maxLength' in field) {
        field.setCustomValidity(`No puede tener más de ${field.maxLength} caracteres.`);
      } else {
        field.setCustomValidity('');
      }
    };

    // Recién se completa el mensaje cuando el navegador va a mostrarlo —
    // si se seteara antes, `field.validity` todavía no reflejaría el
    // valor actual del campo.
    field.addEventListener('invalid', updateMessage);
    // Sin esto, un campo que ya mostró un error queda con ese mensaje
    // "pegado" (customValidity no se limpia solo) aunque la persona lo
    // corrija después.
    field.addEventListener('input', () => field.setCustomValidity(''));
  });
}
