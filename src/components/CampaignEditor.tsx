import * as React from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { Document } from '@tiptap/extension-document';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { Bold as BoldMark } from '@tiptap/extension-bold';
import { Italic as ItalicMark } from '@tiptap/extension-italic';
import { HardBreak } from '@tiptap/extension-hard-break';
import { History } from '@tiptap/extension-history';
import { Link as LinkMark } from '@tiptap/extension-link';
import { Image as ImageNode } from '@tiptap/extension-image';
import { Bold, Italic, Link as LinkIcon, Image as ImageIcon, X } from 'lucide-react';
import { getFieldClasses } from '@/lib/formFieldStyles';
import { showToast } from '@/lib/toast';

/*
 * Reemplaza el <Textarea> plano del mensaje de campaña por un editor de
 * verdad (negrita, itálica, links, imágenes) — pedido explícito del dueño
 * del proyecto sobre la alternativa más simple (sintaxis tipo Markdown),
 * sabiendo que implica más superficie a mantener.
 *
 * El esquema de Tiptap se arma a mano (sin StarterKit) para que sea
 * imposible generar HTML fuera de lo pedido: negrita, itálica, link,
 * imagen, párrafo y salto de línea, nada de headings/listas/tablas. El
 * Apps Script igual sanea el HTML de nuevo del lado del servidor
 * (sanitizeCampaignHtml, ver docs/GOOGLE_SHEETS_FORM_SETUP.md) — este
 * esquema acotado es la primera barrera, no la única.
 */

// Solo se aceptan estos esquemas de URL — igual que el sanitizador del
// Apps Script, para no ofrecerle al admin algo que el servidor va a
// rechazar en silencio después.
function isSafeUrl(url: string, allowMailto: boolean): boolean {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return true;
  return allowMailto && /^mailto:/i.test(trimmed);
}

interface DialogState {
  mode: 'link' | 'image';
  /** Si había texto seleccionado al abrir el diálogo de link, no hace falta pedir la etiqueta. */
  needsLabel: boolean;
}

export default function CampaignEditor() {
  const hiddenInputRef = React.useRef<HTMLInputElement>(null);
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [dialogState, setDialogState] = React.useState<DialogState | null>(null);
  const [urlValue, setUrlValue] = React.useState('');
  const [labelValue, setLabelValue] = React.useState('');

  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      BoldMark,
      ItalicMark,
      HardBreak,
      History,
      LinkMark.configure({
        openOnClick: false,
        autolink: false,
        protocols: ['http', 'https', 'mailto'],
      }),
      ImageNode.configure({ inline: false }),
    ],
    editorProps: {
      attributes: {
        class: 'min-h-48 px-3 py-2 focus:outline-none [&_p]:mb-3 last:[&_p]:mb-0',
        'aria-label': 'Mensaje del mail',
        role: 'textbox',
      },
    },
    immediatelyRender: false,
    onUpdate: ({ editor: updatedEditor }) => syncHiddenInput(updatedEditor),
    onCreate: ({ editor: createdEditor }) => syncHiddenInput(createdEditor),
  });

  // panel.astro llama a campaignForm.reset() después de un envío exitoso
  // para vaciar Asunto/Mensaje — un <input type="hidden"> no tiene UI
  // propia que "resetear", así que sin esto el editor visual seguiría
  // mostrando el texto de la campaña ya mandada.
  React.useEffect(() => {
    const form = hiddenInputRef.current?.closest('form');
    if (!form || !editor) return;
    const handleReset = () => editor.commands.clearContent();
    form.addEventListener('reset', handleReset);
    return () => form.removeEventListener('reset', handleReset);
  }, [editor]);

  function syncHiddenInput(instance: Editor) {
    const input = hiddenInputRef.current;
    if (!input) return;
    // El HTML vacío de Tiptap es "<p></p>" — lo normalizamos a texto vacío
    // para que la validación existente ("completá el mensaje") siga andando.
    input.value = instance.isEmpty ? '' : instance.getHTML();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function openLinkDialog() {
    if (!editor) return;
    setDialogState({ mode: 'link', needsLabel: editor.state.selection.empty });
    setUrlValue('');
    setLabelValue('');
    dialogRef.current?.showModal();
  }

  function openImageDialog() {
    setDialogState({ mode: 'image', needsLabel: false });
    setUrlValue('');
    setLabelValue('');
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
    setDialogState(null);
  }

  function confirmDialog() {
    if (!editor || !dialogState) return;

    const allowMailto = dialogState.mode === 'link';
    if (!isSafeUrl(urlValue, allowMailto)) {
      showToast({
        message: 'La URL tiene que empezar con https:// (o mailto: para un link de mail).',
        variant: 'error',
      });
      return;
    }

    if (dialogState.mode === 'link') {
      if (dialogState.needsLabel) {
        if (!labelValue.trim()) {
          showToast({ message: 'Escribí el texto que va a mostrar el link.', variant: 'error' });
          return;
        }
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'text',
            text: labelValue.trim(),
            marks: [{ type: 'link', attrs: { href: urlValue.trim() } }],
          })
          .run();
      } else {
        editor.chain().focus().extendMarkRange('link').setLink({ href: urlValue.trim() }).run();
      }
    } else {
      editor.chain().focus().setImage({ src: urlValue.trim(), alt: labelValue.trim() }).run();
    }

    closeDialog();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="border-border-strong bg-surface-alt flex items-center gap-1 rounded-t-xs border border-b-0 px-2 py-1.5">
        <ToolbarButton
          label="Negrita"
          active={editor?.isActive('bold') ?? false}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="Itálica"
          active={editor?.isActive('italic') ?? false}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Link" active={editor?.isActive('link') ?? false} onClick={openLinkDialog}>
          <LinkIcon className="size-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Imagen" active={false} onClick={openImageDialog}>
          <ImageIcon className="size-4" aria-hidden="true" />
        </ToolbarButton>
      </div>

      <EditorContent
        editor={editor}
        className={getFieldClasses() + ' rounded-t-none [&_.ProseMirror]:min-h-48'}
      />

      {/* Puente con el script vanilla de panel.astro: sigue leyendo
          data-campaign-body como si fuera el <textarea> de siempre. */}
      <input type="hidden" data-campaign-body ref={hiddenInputRef} />

      <dialog
        ref={dialogRef}
        aria-labelledby="campaign-editor-dialog-title"
        className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-md border-0 bg-transparent p-0 backdrop:bg-gray-900/60 backdrop:backdrop-blur-sm"
      >
        {/*
          Un <form> acá adentro anidaría con el <form data-campaign-form>
          de panel.astro que envuelve a este componente — HTML no permite
          formularios anidados (el navegador descarta el interno al
          parsear el HTML del server, aunque React SSR no avise), lo que
          rompía la hidratación. Por eso es un <div> con Enter manejado a
          mano, no un <form> con onSubmit.
        */}
        <div
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              confirmDialog();
            }
          }}
          className="bg-surface flex max-h-[85dvh] flex-col gap-4 overflow-y-auto rounded-lg p-6 shadow-xl"
        >
          <div className="flex items-start justify-between gap-4">
            <h2 id="campaign-editor-dialog-title" className="text-h4 text-text font-bold">
              {dialogState?.mode === 'image' ? 'Insertar imagen' : 'Insertar link'}
            </h2>
            <button
              type="button"
              onClick={closeDialog}
              aria-label="Cerrar"
              className="text-text-secondary hover:bg-surface-alt inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-150"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          {dialogState?.mode === 'image' && (
            <p className="text-caption text-text-secondary">
              Pegá la URL de una imagen que ya esté publicada (por ejemplo, subida antes desde{' '}
              <code>/admin/</code>). Este editor no sube archivos nuevos.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="campaign-editor-url" className="text-caption text-text-secondary font-semibold">
              URL
            </label>
            <input
              id="campaign-editor-url"
              type="text"
              required
              autoFocus
              value={urlValue}
              onChange={(event) => setUrlValue(event.target.value)}
              placeholder="https://"
              className={getFieldClasses() + ' h-10 px-3'}
            />
          </div>

          {(dialogState?.mode === 'image' || dialogState?.needsLabel) && (
            <div className="flex flex-col gap-2">
              <label htmlFor="campaign-editor-label" className="text-caption text-text-secondary font-semibold">
                {dialogState?.mode === 'image' ? 'Texto alternativo (opcional)' : 'Texto del link'}
              </label>
              <input
                id="campaign-editor-label"
                type="text"
                required={dialogState?.mode !== 'image'}
                value={labelValue}
                onChange={(event) => setLabelValue(event.target.value)}
                className={getFieldClasses() + ' h-10 px-3'}
              />
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeDialog}
              className="border-border-strong text-text inline-flex h-10 items-center justify-center rounded-sm border px-4 text-body font-semibold"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmDialog}
              className="bg-primary-fill text-primary-fill-foreground inline-flex h-10 items-center justify-center rounded-sm px-4 text-body font-semibold hover:brightness-110"
            >
              Insertar
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={
        'inline-flex size-8 items-center justify-center rounded-xs transition-colors duration-150 ' +
        (active
          ? 'bg-secondary text-secondary-foreground'
          : 'text-text-secondary hover:bg-surface hover:text-text')
      }
    >
      {children}
    </button>
  );
}
