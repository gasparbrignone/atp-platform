const { chromium } = require('C:/Users/gaspar/Desktop/ATP/crm atp/node_modules/playwright-core');
const S = process.argv[2];
const URL_ = 'http://localhost:8765/panel/sorteo/?servicio=http://localhost:8766';
const modo = (q) => fetch('http://localhost:8766/modo?' + q).then(r => r.json());
const ok = (c, m) => console.log((c ? 'OK   ' : 'FALLA') + ' ' + m);
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await (await b.newContext({ bypassCSP: true, viewport: { width: 1920, height: 1080 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL_); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await p.reload();
  const est = () => p.getAttribute('#escenario', 'data-estado');
  const ganador = () => p.waitForSelector('.escenario[data-estado=ganador]', { timeout: 30000 });

  // 1 clave mala
  await p.fill('#clave', 'mala'); await p.click('#btnEntrar'); await p.waitForTimeout(800);
  ok((await p.textContent('#errorIngreso')).includes('no es válida') && await p.isHidden('#app'), 'clave mala: avisa y no entra');
  // 2 clave buena
  await p.fill('#clave', 'buena'); await p.click('#btnEntrar'); await p.waitForSelector('#app:not([hidden])');
  ok(await p.textContent('#cuentaParticipan') === '144', 'cuenta = 144 (solo activas y acreditadas) -> ' + await p.textContent('#cuentaParticipan'));
  // 3 recarga conserva sesión
  await p.reload(); await p.waitForSelector('#app:not([hidden])', { timeout: 5000 }); ok(true, 'recarga: entra solo sin pedir la clave');
  // 4 acreditación nueva entra al sortear
  await modo('acreditar=EFS26-00000001');
  await p.keyboard.press('Space'); await ganador();
  ok(await p.textContent('#cuentaParticipan') === '145', 'alguien que se acredita recién entra al sorteo -> ' + await p.textContent('#cuentaParticipan'));
  // 5 recarga con ganador en pantalla
  const nom = await p.textContent('#nombreGira');
  await p.reload(); await p.waitForSelector('#app:not([hidden])');
  ok(await est() === 'ganador' && await p.textContent('#nombreGira') === nom, 'recarga con ganador en pantalla: sigue el mismo (' + nom + ')');
  // 6 tecla sostenida no confirma
  await p.keyboard.down('Space'); await p.waitForTimeout(50); await p.keyboard.up('Space');
  await p.waitForTimeout(300);
  ok(await est() === 'premio', 'espacio una vez = Siguiente');
  // 7 internet caído: sortea igual con la última lista
  await modo('m=caido'); const t0 = Date.now();
  await p.click('#btnSortear'); await ganador();
  ok(Date.now() - t0 < 25000, 'internet caído: sortea igual con la última lista (' + Math.round((Date.now() - t0) / 1000) + ' s)');
  await p.click('#btnConfirmar');
  // 8 red lenta: arranca a los 6 s
  await modo('m=lento'); const t1 = Date.now();
  await p.click('#btnSortear'); await p.waitForSelector('.escenario[data-estado=girando]', { timeout: 15000 });
  const espera = Date.now() - t1; await ganador();
  ok(espera < 8000, 'red lenta: arranca a los ' + (espera / 1000).toFixed(1) + ' s');
  await modo('m=ok');
  // 9 Repetir varias veces y completar los 8
  for (let i = 0; i < 12; i++) {
    const e = await est();
    if (e === 'resultados') break;
    if (e === 'premio') { await p.click('#btnSortear'); await ganador(); }
    if (i % 3 === 0) { await p.click('#btnAusente'); await ganador(); }
    await p.click('#btnConfirmar'); await p.waitForTimeout(300);
  }
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('efs-sorteo-2026')));
  const g = Object.values(st.ganadores).map(x => x.c);
  const validos = g.every(c => { const i = Number(c.slice(6)); return i % 2 === 0 && i % 25 !== 0 || i === 1; });
  ok(await est() === 'resultados', 'al terminar los 8 premios muestra Ganadores');
  ok(g.length === 8 && new Set(g).size === 8, '8 ganadores, todos distintos');
  ok(validos, 'todos los ganadores están acreditados y con entrada activa');
  ok(!g.some(c => st.ausentes[c]), 'ningún ausente ganó (' + Object.keys(st.ausentes).length + ' ausentes)');
  ok(await p.textContent('#cuentaParticipan') === String(145 - 8 - Object.keys(st.ausentes).length), 'contador descuenta ganadores y ausentes');
  // 10 sin acreditados
  await p.click('#btnMas'); p.once('dialog', d => d.accept()); await p.click('#btnReiniciar');
  await modo('vacio=1'); await p.click('#btnSortear'); await p.waitForTimeout(1500);
  ok((await p.textContent('#sinParticipantes')).includes('nadie acreditado') && await est() === 'premio', 'sin acreditados: avisa y no sortea');
  await modo('vacio=0');
  await p.screenshot({ path: `${S}/9-final.png` });
  ok(errs.length === 0, 'sin errores de JavaScript ' + JSON.stringify(errs));
  await b.close();
})().catch(e => { console.error('FALLA', e.message); process.exit(1); });
