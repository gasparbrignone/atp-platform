const http = require('http');
let modo = 'ok', vacio = false, pedidos = 0;
const entradas = [], acred = {};
for (let i = 0; i < 300; i++) {
  const c = 'EFS26-' + String(i).padStart(8, '0');
  entradas.push([c, i % 3 ? `NOMBRE${i} APELLIDO${i}` : `nombre${i} de la apellido${i}`, String(100 + i).slice(-3), i % 25 === 0 ? 'revocada' : 'activa']);
  if (i % 2 === 0) acred[c] = Date.now();   // pares acreditados (incluye algunos revocados: no deben entrar)
}
http.createServer((q, r) => {
  const h = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (q.method === 'OPTIONS') { r.writeHead(204, h); return r.end(); }
  const u = new URL(q.url, 'http://x');
  if (u.pathname === '/modo') { modo = u.searchParams.get('m') || modo; if (u.searchParams.has('vacio')) vacio = u.searchParams.get('vacio') === '1';
    if (u.searchParams.has('acreditar')) acred[u.searchParams.get('acreditar')] = Date.now();
    r.writeHead(200, h); return r.end(JSON.stringify({ modo, pedidos })); }
  let b = ''; q.on('data', d => b += d); q.on('end', () => {
    pedidos++;
    if (modo === 'caido') { q.socket.destroy(); return; }
    const d = JSON.parse(b);
    const responder = () => {
      if (d.clave !== 'buena') { r.writeHead(200, h); return r.end(JSON.stringify({ ok: false, error: 'clave' })); }
      if (d.op !== 'lista') { r.writeHead(200, h); return r.end(JSON.stringify({ ok: false, error: 'op' })); }
      r.writeHead(200, h); r.end(JSON.stringify({ ok: true, entradas, acred: vacio ? {} : acred, talleres: [], total: 0, acreditados: 0, ahora: Date.now() }));
    };
    modo === 'lento' ? setTimeout(responder, 10000) : responder();
  });
}).listen(8766);
