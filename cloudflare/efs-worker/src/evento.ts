/**
 * Lógica del día del evento (acreditación, credencial y taller) del EFS 2026.
 * Ver docs/EFS_2026_PLAN.md §7 (F7, F8), §6 (invariantes I-6, I-7, I-8) y §9.
 *
 * `Evento` es lógica pura sobre un almacén clave/valor: no sabe nada de
 * Cloudflare, así que se prueba en Node (test/evento.test.mjs). `EventoDO` la
 * aloja en un Durable Object: un único objeto atiende a todos los celulares,
 * de a un pedido por vez, y por eso dos puestos nunca pueden quedarse con el
 * último lugar de un taller ni entregar la misma credencial.
 *
 * Cada operación lleva un `id` (único, generado por el celular): repetirla
 * devuelve el mismo resultado sin duplicar efectos (I-8), que es lo que hace
 * seguros los reintentos cuando la red del salón falla.
 */
import { appsScript, esperar } from './apps.ts';
import type { Env, Json } from './apps.ts';

export interface Almacen {
  get<T>(clave: string): Promise<T | undefined>;
  put<T>(clave: string, valor: T): Promise<void>;
}

export interface Taller { id: string; nombre: string; cupo: number; color: string }
interface Entrada { n: string; dni: string; e: string }
export interface ItemLista { c: string; n: string; dni: string; e: string; a?: number; p?: string; cr?: string; t?: string }

const RE_CODIGO = /^EFS26-[0-9A-HJKMNP-TV-Z]{8}$/;
const RE_CREDENCIAL = /^EFSC-[0-9A-HJKMNP-TV-Z]{8}$/;
const RE_OP = /^[A-Za-z0-9_-]{6,64}$/;
const RE_TALLER = /^[a-z0-9-]{1,30}$/;
const COLORES = /^#[0-9a-fA-F]{6}$/;

const normalizar = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export class Evento {
  almacen: Almacen;
  cargado = false;
  entradas: Record<string, Entrada> = {};
  acred: Record<string, [number, string]> = {}; // código → [hora (ms), puesto]
  cred: Record<string, string> = {}; // credencial → código
  credDe: Record<string, string> = {}; // código → credencial
  tall: Record<string, string> = {}; // código → id de taller
  talleres: Record<string, Taller> = {};
  validas: Record<string, 1> | null = null; // credenciales impresas (si se cargó la lista)
  ajustes: { despues: boolean } = { despues: false };
  sucio: Record<string, number> = {}; // código → versión pendiente de pasar a la planilla
  seq = 0;
  opsMem: Record<string, Json> = {}; // resultados de operaciones ya decididas (se anotan en el mismo instante, sin esperar al almacén)

  constructor(almacen: Almacen) {
    this.almacen = almacen;
  }

  async cargar(): Promise<void> {
    if (this.cargado) return;
    const g = async <T>(k: string, def: T): Promise<T> => (await this.almacen.get<T>(k)) ?? def;
    this.entradas = await g('entradas', {});
    this.acred = await g('acred', {});
    this.cred = await g('cred', {});
    this.tall = await g('tall', {});
    this.talleres = await g('talleres', {});
    this.validas = await g<Record<string, 1> | null>('validas', null);
    this.ajustes = await g('ajustes', { despues: false });
    this.sucio = await g('sucio', {});
    this.seq = await g('seq', 0);
    this.credDe = {};
    for (const [cr, c] of Object.entries(this.cred)) this.credDe[c] = cr;
    this.cargado = true;
  }

  async guardar(...claves: string[]): Promise<void> {
    const estado = this as unknown as Record<string, unknown>;
    for (const k of claves) await this.almacen.put(k, estado[k]);
  }

  // ─────────── lista y búsqueda ───────────

  lista(): Json {
    const entradas: [string, string, string, string][] = [];
    for (const [c, e] of Object.entries(this.entradas)) entradas.push([c, e.n, e.dni.slice(-3), e.e]);
    const acred: Record<string, number> = {};
    for (const [c, a] of Object.entries(this.acred)) acred[c] = a[0];
    return {
      ok: true, entradas, acred, talleres: this.estadoTalleres(), despues: this.ajustes.despues,
      total: entradas.filter((x) => x[3] === 'activa').length, acreditados: Object.keys(this.acred).length,
      credenciales: Object.keys(this.cred).length, ahora: Date.now(),
    };
  }

  // Lo que el celular refresca cada pocos segundos: lugares libres y contadores.
  estado(): Json {
    return { ok: true, talleres: this.estadoTalleres(), despues: this.ajustes.despues, acreditados: Object.keys(this.acred).length, credenciales: Object.keys(this.cred).length, ahora: Date.now() };
  }

  estadoTalleres(): Json[] {
    const ocupados: Record<string, number> = {};
    for (const t of Object.values(this.tall)) ocupados[t] = (ocupados[t] || 0) + 1;
    return Object.values(this.talleres).map((t) => ({ ...t, ocupados: ocupados[t.id] || 0 }));
  }

  buscar(q: string): Json {
    const texto = String(q || '').trim();
    const digitos = texto.replace(/[\s.]/g, '');
    const claveTexto = normalizar(texto);
    if (digitos.length < 4 && claveTexto.length < 3) return { ok: false, error: 'busqueda_corta' };
    const salida: Json[] = [];
    for (const [c, e] of Object.entries(this.entradas)) {
      const porDni = /^\d{4,}$/.test(digitos) && e.dni.replace(/\D/g, '').includes(digitos);
      const porNombre = claveTexto.length >= 3 && !/^\d+$/.test(claveTexto) && normalizar(e.n).includes(claveTexto);
      if (!porDni && !porNombre) continue;
      salida.push({ c, n: e.n, d3: e.dni.slice(-3), e: e.e, acreditado: Boolean(this.acred[c]), cr: this.credDe[c] || '' });
      if (salida.length >= 10) break;
    }
    return { ok: true, resultados: salida };
  }

  // ─────────── operaciones del día (idempotentes por `id`) ───────────

  // Si el celular repite una operación (por ejemplo porque la red tardó), se contesta lo mismo que la
  // primera vez. Se mira primero la memoria: así vale incluso si la primera todavía se está guardando.
  private async repetida(id: string): Promise<Json | undefined> {
    if (this.opsMem[id]) return this.opsMem[id];
    const guardada = await this.almacen.get<Json>('op:' + id);
    return this.opsMem[id] ?? guardada; // se vuelve a mirar: otro pedido igual pudo decidirse mientras se leía
  }

  // Anota el resultado ANTES de esperar a que se guarde nada: entre decidir y anotar no hay ninguna espera,
  // por eso dos pedidos con el mismo id nunca se cruzan.
  private async cerrar(id: string, r: Json, ...claves: string[]): Promise<Json> {
    this.opsMem[id] = r;
    if (claves.length) await this.guardar(...claves);
    await this.almacen.put('op:' + id, r);
    return r;
  }

  private marcarSucio(c: string): void {
    this.sucio[c] = ++this.seq;
  }

  private datosDe(c: string): Json {
    const t = this.tall[c];
    return { n: this.entradas[c]?.n || '', cr: this.credDe[c] || '', t: t || '', tn: t ? this.talleres[t]?.nombre || '' : '' };
  }

  async acreditar(id: string, codigo: string, puesto: string): Promise<Json> {
    if (!RE_OP.test(id)) return { ok: false, error: 'op' };
    const previa = (await this.repetida(id)) ?? this.opsMem[id]; // se mira de nuevo justo antes de decidir
    if (previa) return previa;
    const c = String(codigo || '').trim().toUpperCase();
    if (!RE_CODIGO.test(c)) return { ok: true, r: 'formato' };
    const e = this.entradas[c];
    if (!e) return { ok: true, r: 'no_valido' };
    if (e.e !== 'activa') return this.cerrar(id, { ok: true, r: 'revocada', n: e.n });
    if (this.acred[c]) {
      const [hora, donde] = this.acred[c];
      return this.cerrar(id, { ok: true, r: 'ya', hora, puesto: donde, ...this.datosDe(c) });
    }
    this.acred[c] = [Date.now(), cortar(puesto)];
    this.marcarSucio(c);
    return this.cerrar(id, { ok: true, r: 'ok', hora: this.acred[c][0], ...this.datosDe(c) }, 'acred', 'sucio', 'seq');
  }

  async vincular(id: string, codigo: string, credencial: string, puesto: string): Promise<Json> {
    if (!RE_OP.test(id)) return { ok: false, error: 'op' };
    const previa = (await this.repetida(id)) ?? this.opsMem[id]; // se mira de nuevo justo antes de decidir
    if (previa) return previa;
    const c = String(codigo || '').trim().toUpperCase();
    const cr = String(credencial || '').trim().toUpperCase();
    if (!RE_CREDENCIAL.test(cr)) return { ok: true, r: 'formato_credencial' };
    if (this.validas && !this.validas[cr]) return { ok: true, r: 'credencial_desconocida' };
    const e = this.entradas[c];
    if (!e) return { ok: true, r: 'no_valido' };
    if (e.e !== 'activa') return { ok: true, r: 'revocada', n: e.n };
    const dueno = this.cred[cr];
    if (dueno && dueno !== c) return this.cerrar(id, { ok: true, r: 'credencial_ocupada', de: this.entradas[dueno]?.n || '' });
    if (this.credDe[c] && this.credDe[c] !== cr) return this.cerrar(id, { ok: true, r: 'ya_tiene', cr: this.credDe[c], n: e.n });
    if (!this.acred[c]) { // por si el paso 1 todavía no llegó (cola sin red): se acredita igual
      this.acred[c] = [Date.now(), cortar(puesto)];
    }
    this.cred[cr] = c;
    this.credDe[c] = cr;
    this.marcarSucio(c);
    return this.cerrar(id, { ok: true, r: 'ok', ...this.datosDe(c) }, 'acred', 'cred', 'sucio', 'seq');
  }

  async asignarTaller(id: string, codigo: string, tallerId: string): Promise<Json> {
    if (!RE_OP.test(id)) return { ok: false, error: 'op' };
    const previa = (await this.repetida(id)) ?? this.opsMem[id]; // se mira de nuevo justo antes de decidir
    if (previa) return previa;
    const c = String(codigo || '').trim().toUpperCase();
    const e = this.entradas[c];
    if (!e) return { ok: true, r: 'no_valido' };
    if (e.e !== 'activa') return { ok: true, r: 'revocada', n: e.n };
    if (!this.acred[c]) return { ok: true, r: 'sin_acreditar' };
    const t = this.talleres[tallerId];
    if (!t) return { ok: true, r: 'no_taller' };
    if (this.tall[c] === tallerId) return this.cerrar(id, { ok: true, r: 'ok', libres: this.libres(tallerId), ...this.datosDe(c) });
    if (this.libres(tallerId) <= 0) return this.cerrar(id, { ok: true, r: 'sin_cupo', libres: 0, tn: t.nombre });
    this.tall[c] = tallerId;
    this.marcarSucio(c);
    return this.cerrar(id, { ok: true, r: 'ok', libres: this.libres(tallerId), ...this.datosDe(c) }, 'tall', 'sucio', 'seq');
  }

  libres(tallerId: string): number {
    const t = this.talleres[tallerId];
    if (!t) return 0;
    let ocupados = 0;
    for (const x of Object.values(this.tall)) if (x === tallerId) ocupados++;
    return Math.max(0, t.cupo - ocupados);
  }

  // Puerta del taller: a quién pertenece una credencial y a qué taller va.
  puerta(credencial: string): Json {
    const cr = String(credencial || '').trim().toUpperCase();
    if (!RE_CREDENCIAL.test(cr)) return { ok: true, r: 'formato_credencial' };
    const c = this.cred[cr];
    if (!c) return { ok: true, r: 'sin_dueno' };
    return { ok: true, r: 'ok', c, ...this.datosDe(c) };
  }

  // ─────────── coordinación ───────────

  async guardarTaller(t: Json): Promise<Json> {
    const nombre = String(t.nombre || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const cupo = Math.floor(Number(t.cupo));
    const color = String(t.color || '');
    let id = String(t.id || '');
    if (!nombre || !(cupo >= 1 && cupo <= 2000) || !COLORES.test(color)) return { ok: false, error: 'datos' };
    if (!id) {
      const base = normalizar(nombre).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 't';
      id = base;
      for (let n = 2; this.talleres[id]; n++) id = base + '-' + n;
    }
    if (!RE_TALLER.test(id)) return { ok: false, error: 'id' };
    this.talleres[id] = { id, nombre, cupo, color: color.toUpperCase() };
    await this.guardar('talleres');
    return { ok: true, talleres: this.estadoTalleres() };
  }

  async borrarTaller(id: string): Promise<Json> {
    if (!this.talleres[id]) return { ok: false, error: 'no_taller' };
    if (Object.values(this.tall).includes(id)) return { ok: false, error: 'con_gente' };
    delete this.talleres[id];
    await this.guardar('talleres');
    return { ok: true, talleres: this.estadoTalleres() };
  }

  async cargarCredenciales(lista: unknown): Promise<Json> {
    if (!Array.isArray(lista)) return { ok: false, error: 'datos' };
    const nuevas: Record<string, 1> = {};
    for (const x of lista) {
      const cr = String(x || '').trim().toUpperCase();
      if (RE_CREDENCIAL.test(cr)) nuevas[cr] = 1;
    }
    const n = Object.keys(nuevas).length;
    if (n < 1) return { ok: false, error: 'vacia' };
    this.validas = nuevas;
    await this.guardar('validas');
    return { ok: true, cargadas: n };
  }

  async desvincular(codigo: string): Promise<Json> {
    const c = String(codigo || '').trim().toUpperCase();
    const cr = this.credDe[c];
    if (!cr) return { ok: false, error: 'sin_credencial' };
    delete this.cred[cr];
    delete this.credDe[c];
    this.marcarSucio(c);
    await this.guardar('cred', 'sucio', 'seq');
    return { ok: true };
  }

  async desacreditar(codigo: string): Promise<Json> {
    const c = String(codigo || '').trim().toUpperCase();
    if (!this.acred[c]) return { ok: false, error: 'no_acreditado' };
    delete this.acred[c];
    const cr = this.credDe[c];
    if (cr) { delete this.cred[cr]; delete this.credDe[c]; }
    delete this.tall[c];
    this.marcarSucio(c);
    await this.guardar('acred', 'cred', 'tall', 'sucio', 'seq');
    return { ok: true };
  }

  async fijarDespues(valor: unknown): Promise<Json> {
    this.ajustes.despues = valor === true;
    await this.guardar('ajustes');
    return { ok: true, despues: this.ajustes.despues };
  }

  resumen(): Json {
    return {
      ok: true, total: Object.values(this.entradas).filter((e) => e.e === 'activa').length,
      acreditados: Object.keys(this.acred).length, credenciales: Object.keys(this.cred).length,
      con_taller: Object.keys(this.tall).length, sin_sincronizar: Object.keys(this.sucio).length,
      credenciales_impresas: this.validas ? Object.keys(this.validas).length : 0, talleres: this.estadoTalleres(),
    };
  }

  // ─────────── planilla ───────────

  // Trae la lista de la planilla: altas nuevas, revocaciones y, si este objeto
  // perdió su estado, recupera lo que la planilla ya sabe (acreditación, credencial, taller).
  async fusionar(items: ItemLista[]): Promise<void> {
    const porNombre: Record<string, string> = {};
    for (const t of Object.values(this.talleres)) porNombre[t.nombre] = t.id;
    let cambioAcred = false, cambioCred = false, cambioTall = false;
    for (const it of items) {
      if (!RE_CODIGO.test(it.c)) continue;
      this.entradas[it.c] = { n: String(it.n || ''), dni: String(it.dni || ''), e: String(it.e || 'activa') };
      if (it.a && !this.acred[it.c] && !this.sucio[it.c]) { this.acred[it.c] = [it.a, cortar(it.p || 'planilla')]; cambioAcred = true; }
      if (it.cr && RE_CREDENCIAL.test(it.cr) && !this.credDe[it.c] && !this.cred[it.cr] && !this.sucio[it.c]) {
        this.cred[it.cr] = it.c; this.credDe[it.c] = it.cr; cambioCred = true;
      }
      if (it.t && !this.tall[it.c] && porNombre[it.t] && !this.sucio[it.c]) { this.tall[it.c] = porNombre[it.t]; cambioTall = true; }
    }
    await this.guardar('entradas');
    if (cambioAcred) await this.guardar('acred');
    if (cambioCred) await this.guardar('cred');
    if (cambioTall) await this.guardar('tall');
  }

  // Cambios pendientes de pasar a la planilla (un lote por vez).
  lote(max = 60): { items: Json[]; versiones: Record<string, number> } {
    const items: Json[] = [];
    const versiones: Record<string, number> = {};
    for (const [c, v] of Object.entries(this.sucio)) {
      if (items.length >= max) break;
      const a = this.acred[c];
      const t = this.tall[c];
      items.push({ c, a: a ? a[0] : 0, p: a ? a[1] : '', cr: this.credDe[c] || '', t: t ? this.talleres[t]?.nombre || '' : '' });
      versiones[c] = v;
    }
    return { items, versiones };
  }

  // Solo se limpia lo que no cambió mientras el lote viajaba.
  async confirmarLote(versiones: Record<string, number>): Promise<void> {
    for (const [c, v] of Object.entries(versiones)) if (this.sucio[c] === v) delete this.sucio[c];
    await this.guardar('sucio');
  }
}

function cortar(s: string): string {
  return String(s || '').replace(/[^\p{L}\p{N} .'-]/gu, '').slice(0, 20);
}

// ─────────────────────────── Durable Object ───────────────────────────

const REFRESCO_MS = 60000;
const SYNC_MS = 20000;

export class EventoDO {
  state: DurableObjectState;
  env: Env;
  evento: Evento;
  ultimaLista = 0;
  refrescando: Promise<void> | null = null;
  // Cuánto se le hace esperar al celular por la planilla (el Apps Script a veces tarda decenas de segundos).
  tiempos = { primera: 20000, forzada: 5000 };

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.evento = new Evento(state.storage as unknown as Almacen);
  }

  async fetch(request: Request): Promise<Response> {
    let d: Json;
    try { d = (await request.json()) as Json; } catch { return responder({ ok: false, error: 'formato' }); }
    await this.evento.cargar();
    const r = await this.despachar(String(d.op || ''), d);
    if (Object.keys(this.evento.sucio).length) await this.programarSync();
    return responder(r);
  }

  async despachar(op: string, d: Json): Promise<Json> {
    const ev = this.evento;
    switch (op) {
      case 'lista': await this.conListaActual(); return ev.lista();
      case 'talleres': return ev.estado();
      case 'buscar': await this.conListaActual(); return ev.buscar(String(d.q || ''));
      case 'acreditar': {
        // Si el código no está, puede ser alguien que pagó hace un minuto: se vuelve a pedir la lista una vez.
        if (!ev.entradas[String(d.codigo || '').toUpperCase()]) await Promise.race([this.refrescar(true), esperar(this.tiempos.forzada)]);
        return ev.acreditar(String(d.id || ''), String(d.codigo || ''), String(d.puesto || ''));
      }
      case 'vincular': return ev.vincular(String(d.id || ''), String(d.codigo || ''), String(d.credencial || ''), String(d.puesto || ''));
      case 'taller': return ev.asignarTaller(String(d.id || ''), String(d.codigo || ''), String(d.taller || ''));
      case 'puerta': return ev.puerta(String(d.credencial || ''));
      case 'coord_resumen': return ev.resumen();
      case 'coord_taller': return ev.guardarTaller(d);
      case 'coord_taller_borrar': return ev.borrarTaller(String(d.taller || ''));
      case 'coord_credenciales': return ev.cargarCredenciales(d.lista);
      case 'coord_desvincular': return ev.desvincular(String(d.codigo || ''));
      case 'coord_desacreditar': return ev.desacreditar(String(d.codigo || ''));
      case 'coord_despues': return ev.fijarDespues(d.valor);
      case 'coord_sincronizar': await this.sincronizar(); return ev.resumen();
      default: return { ok: false, error: 'op' };
    }
  }

  // Si ya hay una lista se contesta al instante con ella y la actualización corre por detrás: el celular
  // nunca espera por la planilla. Solo la primera vez (sin lista todavía) se espera, con un tope.
  async conListaActual(): Promise<void> {
    const hayLista = Object.keys(this.evento.entradas).length > 0;
    const p = this.refrescar(false);
    if (hayLista) return;
    await Promise.race([p, esperar(this.tiempos.primera)]);
  }

  // Vuelve a leer la lista de la planilla (como mucho una vez por minuto, salvo `forzar`).
  async refrescar(forzar: boolean): Promise<void> {
    if (this.refrescando) return this.refrescando;
    if (!forzar && Date.now() - this.ultimaLista < REFRESCO_MS && Object.keys(this.evento.entradas).length) return;
    this.refrescando = (async () => {
      try {
        const r = await appsScript({ accion: 'staff_lista' }, this.env, { reintentos: 0, timeoutMs: 25000 });
        if (r.ok === true && Array.isArray(r.entradas)) {
          await this.evento.fusionar(r.entradas as ItemLista[]);
          this.ultimaLista = Date.now();
        }
      } catch { /* se sigue con la lista que ya tiene */ } finally { this.refrescando = null; }
    })();
    return this.refrescando;
  }

  async programarSync(): Promise<void> {
    if ((await this.state.storage.getAlarm()) === null) await this.state.storage.setAlarm(Date.now() + SYNC_MS);
  }

  async alarm(): Promise<void> {
    await this.evento.cargar();
    await this.sincronizar();
    if (Object.keys(this.evento.sucio).length) await this.state.storage.setAlarm(Date.now() + SYNC_MS * 2);
  }

  async sincronizar(): Promise<void> {
    const { items, versiones } = this.evento.lote();
    if (!items.length) return;
    const r = await appsScript({ accion: 'staff_sync', lote: JSON.stringify(items) }, this.env, { reintentos: 1 });
    if (r.ok === true) await this.evento.confirmarLote(versiones);
  }
}

function responder(cuerpo: Json): Response {
  return new Response(JSON.stringify(cuerpo), { headers: { 'Content-Type': 'application/json' } });
}
