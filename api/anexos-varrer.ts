/**
 * Endereço próprio do cron da varredura dos anexos (29/10/2026): não dá para
 * contar com a Vercel repassando `?acao=varrer` do `path` do cron — se não
 * repassasse, a varredura responderia 405 todo dia sem ninguém ver. A
 * autorização (CRON_SECRET) e o trabalho estão em api/anexos.ts.
 */
import handler from './anexos.js';

export default function varrer(req: any, res: any) {
  req.query = { ...(req.query || {}), acao: 'varrer' };
  return handler(req, res);
}
