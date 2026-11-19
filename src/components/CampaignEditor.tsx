import * as React from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent, type Editor, type JSONContent } from '@tiptap/react';
import type { EditorView } from '@tiptap/pm/view';
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
import {
  CampaignImageError,
  MAX_CAMPAIGN_IMAGES,
  extractCampaignImages,
  prepareCampaignImage,
} from '@/lib/campaignImages';

/*
 * Reemplaza el <Textarea> plano del mensaje de campaña por un editor de
 * verdad (negrita, itálica, links, imágenes) — pedido explícito del dueño
 * del proyecto sobre la alternativa más simple (sintaxis tipo Markdown),
 * sabiendo que implica más superficie a mantener.
 *
 * Las imágenes se arrastran, se pegan o se eligen con el botón, y quedan
 * donde se soltaron/donde estaba el cursor. No hay URL: viajan dentro del
 * mail (ver lib/campaignImages.ts). El editor las muestra como data URL
 * (la CSP del sitio no deja cargar imágenes de otros dominios) y al
 * sincronizar con el formulario se separan en un campo aparte.
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
function isSafeUrl(url: string): boolean {
  return /^(https?:\/\/|mailto:)/i.test(url.trim());
}

interface DialogState {
  /** Si había texto seleccionado al abrir el diálogo de link, no hace falta pedir la etiqueta. */
  needsLabel: boolean;
}

/**
 * Posición donde entra una imagen: siempre ENTRE bloques, nunca en medio de
 * un párrafo (partiría una palabra). Con un punto de soltado, va arriba o
 * abajo del párrafo según en qué mitad cayó; con el cursor, a continuación
 * del párrafo donde está (o en su lugar, si es una línea vacía).
 */
function getImageInsertPosition(view: EditorView, position: number, pointerY?: number): number {
  const $position = view.state.doc.resolve(position);
  if ($position.depth === 0) return position;

  const blockStart = $position.before(1);
  const block = $position.node(1);
  if (block.isTextblock && block.content.size === 0) return blockStart;

  const blockEnd = $position.after(1);
  const blockElement = view.nodeDOM(blockStart);
  if (pointerY === undefined || !(blockElement instanceof HTMLElement)) return blockEnd;

  const { top, height } = blockElement.getBoundingClientRect();
  return pointerY < top + height / 2 ? blockStart : blockEnd;
}

function getImageFiles(files: FileList | null | undefined): File[] {
  return Array.from(files ?? []).filter((file) => file.type.startsWith('image/'));
}

function isFileDrag(event: React.DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes('Files');
}

export default function CampaignEditor() {
  const hiddenInputRef = React.useRef<HTMLInputElement>(null);
  const imagesInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // handleDrop/handlePaste se definen antes de que exista `editor` — esta
  // ref les da siempre la versión vigente de insertImageFiles.
  const insertImageFilesRef = React.useRef<
    (files: File[], drop?: { position: number; pointerY: number }) => Promise<void>
  >(async () => undefined);
  const [isDraggingFile, setIsDraggingFile] = React.useState(false);
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [dialogState, setDialogState] = React.useState<DialogState | null>(null);
  const [urlValue, setUrlValue] = React.useState('');
  const [labelValue, setLabelValue] = React.useState('');

  // El <dialog> del link se porta afuera del <form> de la campaña
  // (ver más abajo, createPortal) — necesita que el documento ya exista,
  // así que "montado" recién es true del lado del cliente.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

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
        class:
          'min-h-48 px-3 py-2 whitespace-pre-wrap focus:outline-none [&_p]:mb-3 last:[&_p]:mb-0',
        'aria-label': 'Mensaje del mail',
        'aria-describedby': 'campaign-editor-hint',
        role: 'textbox',
      },
      handleDrop: (view, event) => {
        const files = getImageFiles(event.dataTransfer?.files);
        if (files.length === 0) return false; // mover una imagen ya puesta: lo resuelve ProseMirror
        event.preventDefault();
        setIsDraggingFile(false);
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertImageFilesRef.current(
          files,
          position === undefined ? undefined : { position, pointerY: event.clientY },
        );
        return true;
      },
      handlePaste: (_view, event) => {
        const files = getImageFiles(event.clipboardData?.files);
        // Copiar desde Word/Excel también trae una "foto" del contenido junto
        // con el texto: si hay texto, se pega el texto y no la imagen.
        if (files.length === 0 || event.clipboardData?.getData('text/plain').trim()) return false;
        event.preventDefault();
        void insertImageFilesRef.current(files);
        return true;
      },
    },
    // Por defecto Tiptap/ProseMirror inyectan un <style> propio en runtime
    // (white-space, selección, etc.) — la CSP del sitio no tiene
    // 'unsafe-inline' para estilos (solo hashes calculados en build time),
    // así que ese <style> queda bloqueado (ver consola). Se desactiva y se
    // repone lo único que hacía falta (white-space: pre-wrap) como clase
    // de Tailwind de siempre, arriba.
    injectCSS: false,
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
    const bodyInput = hiddenInputRef.current;
    const imagesInput = imagesInputRef.current;
    if (!bodyInput || !imagesInput) return;
    // El HTML vacío de Tiptap es "<p></p>" — lo normalizamos a texto vacío
    // para que la validación existente ("completá el mensaje") siga andando.
    const { html, images } = instance.isEmpty
      ? { html: '', images: [] }
      : extractCampaignImages(instance.getHTML());
    bodyInput.value = html;
    imagesInput.value = JSON.stringify(images);
    bodyInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * Inserta cada imagen donde se soltó (`drop`) o, si no hay, donde está el
   * cursor. Se procesan de a una: cada una se reduce antes de entrar.
   */
  async function insertImageFiles(files: File[], drop?: { position: number; pointerY: number }) {
    if (!editor) return;
    let dropTarget = drop;

    for (const file of files) {
      let imageCount = 0;
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'image') imageCount++;
      });
      if (imageCount >= MAX_CAMPAIGN_IMAGES) {
        showToast({
          message: `Un mail puede llevar hasta ${MAX_CAMPAIGN_IMAGES} imágenes. Borrá alguna para poner otra.`,
          variant: 'error',
        });
        return;
      }

      try {
        const src = await prepareCampaignImage(file);
        const docSize = editor.state.doc.content.size;
        const insertAt = getImageInsertPosition(
          editor.view,
          Math.min(dropTarget?.position ?? editor.state.selection.from, docSize),
          dropTarget?.pointerY,
        );
        // Una imagen al final del mensaje dejaría sin lugar donde seguir escribiendo.
        const content: JSONContent[] = [{ type: 'image', attrs: { src, alt: '' } }];
        if (insertAt >= docSize) content.push({ type: 'paragraph' });
        editor.chain().focus().insertContentAt(insertAt, content).run();
        dropTarget = undefined; // las siguientes van a continuación de la anterior
      } catch (error) {
        showToast({
          message:
            error instanceof CampaignImageError ? error.message : 'No pudimos agregar la imagen.',
          variant: 'error',
        });
      }
    }
  }
  insertImageFilesRef.current = insertImageFiles;

  function openLinkDialog() {
    if (!editor) return;
    setDialogState({ needsLabel: editor.state.selection.empty });
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

    if (!isSafeUrl(urlValue)) {
      showToast({
        message: 'La URL tiene que empezar con https:// (o mailto: para un link de mail).',
        variant: 'error',
      });
      return;
    }

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
        <ToolbarButton
          label="Link"
          active={editor?.isActive('link') ?? false}
          onClick={openLinkDialog}
        >
          <LinkIcon className="size-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Imagen" active={false} onClick={() => fileInputRef.current?.click()}>
          <ImageIcon className="size-4" aria-hidden="true" />
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={(event) => {
            void insertImageFiles(getImageFiles(event.target.files));
            event.target.value = ''; // permite elegir de nuevo el mismo archivo
          }}
        />
      </div>

      <div
        onDragOver={(event) => {
          if (!isFileDrag(event)) return;
          event.preventDefault();
          setIsDraggingFile(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsDraggingFile(false);
          }
        }}
        onDrop={(event) => {
          setIsDraggingFile(false);
          // Si cayó dentro del texto, handleDrop ya lo resolvió (y puso la
          // imagen en el lugar exacto). Esto cubre soltarla en otro borde.
          if (event.defaultPrevented || !isFileDrag(event)) return;
          event.preventDefault();
          void insertImageFiles(getImageFiles(event.dataTransfer.files));
        }}
      >
        <EditorContent
          editor={editor}
          className={
            getFieldClasses() +
            ' [&_.ProseMirror-selectednode]:outline-secondary-strong rounded-t-none [&_.ProseMirror]:min-h-48 [&_.ProseMirror-selectednode]:outline-2 [&_.ProseMirror-selectednode]:outline-offset-2 [&_img]:my-3 [&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xs' +
            (isDraggingFile ? ' border-secondary-strong bg-surface-alt' : '')
          }
        />
      </div>

      <p id="campaign-editor-hint" className="text-caption text-text-secondary">
        Para sumar una imagen, arrastrala hasta el lugar del mensaje donde querés que aparezca,
        pegala, o usá el botón de imagen. Va dentro del mail, sin link (hasta {MAX_CAMPAIGN_IMAGES}{' '}
        por mail). Para sacarla, hacé clic sobre ella y apretá Borrar.
      </p>

      {/* Puente con el script vanilla de panel.astro: sigue leyendo
          data-campaign-body como si fuera el <textarea> de siempre. Las
          imágenes (ya separadas del HTML) viajan en el segundo campo. */}
      <input type="hidden" data-campaign-body ref={hiddenInputRef} />
      <input type="hidden" data-campaign-images defaultValue="[]" ref={imagesInputRef} />

      {/*
        Portado afuera del <form data-campaign-form> a propósito: un
        <dialog> cerrado sigue siendo parte del árbol del formulario que lo
        contiene, y el navegador cuenta sus campos `required` (URL/texto
        del link) al validar ESE formulario entero. Como el diálogo suele
        estar oculto en ese momento, el navegador encontraba un campo
        inválido que no podía enfocar para avisar del error — y en vez de
        mostrar nada, cancelaba en silencio el envío de toda la campaña
        (bug real encontrado en producción el 2026-09-05: "Confirmar
        envío" no hacía nada, sin ningún mensaje). Con createPortal el
        diálogo vive aparte, en <body>, y deja de contar para ese
        formulario.
      */}
      {mounted &&
        createPortal(
          <dialog
            ref={dialogRef}
            aria-labelledby="campaign-editor-dialog-title"
            className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-md border-0 bg-transparent p-0 backdrop:bg-gray-900/60 backdrop:backdrop-blur-sm"
          >
            {/*
              Un <form> acá adentro anidaría con el <form data-campaign-form>
              de panel.astro (aunque ahora esté portado afuera en el DOM
              final, en el JSX este componente sigue siendo hijo de ese
              formulario) — HTML no permite formularios anidados (el
              navegador descarta el interno al parsear el HTML del
              servidor, aunque React SSR no avise), lo que rompía la
              hidratación. Por eso es un <div> con Enter manejado a mano,
              no un <form> con onSubmit.
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
                  Insertar link
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

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="campaign-editor-url"
                  className="text-caption text-text-secondary font-semibold"
                >
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

              {dialogState?.needsLabel && (
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="campaign-editor-label"
                    className="text-caption text-text-secondary font-semibold"
                  >
                    Texto del link
                  </label>
                  <input
                    id="campaign-editor-label"
                    type="text"
                    required
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
                  className="border-border-strong text-text text-body inline-flex h-10 items-center justify-center rounded-sm border px-4 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDialog}
                  className="bg-primary-fill text-primary-fill-foreground text-body inline-flex h-10 items-center justify-center rounded-sm px-4 font-semibold hover:brightness-110"
                >
                  Insertar
                </button>
              </div>
            </div>
          </dialog>,
          document.body,
        )}
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
