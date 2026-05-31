// Página retirada — devolver 410 Gone para que Google la deindexe rápido.
export const onRequest = () => new Response('Gone', {
  status: 410,
  headers: {
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Robots-Tag': 'noindex',
    'Cache-Control': 'public, max-age=86400',
  },
});
