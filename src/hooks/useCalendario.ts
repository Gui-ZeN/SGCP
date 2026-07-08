import { useState, useEffect } from 'react';
import { fetchProximasDatas, calendarioConfigurado, DataCalendario } from '../lib/calendarioApi';

/**
 * Lê as próximas datas da API de Calendários (read-only). Não quebra o app se a
 * API não estiver configurada (retorna configurada=false) ou fora do ar (erro).
 */
export function useCalendario(dias = 45) {
  const [datas, setDatas] = useState<DataCalendario[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!calendarioConfigurado()) return;
    let vivo = true;
    setLoading(true);
    setErro(null);
    fetchProximasDatas(dias)
      .then(d => { if (vivo) setDatas(d); })
      .catch(e => { if (vivo) setErro(e?.message || 'Falha ao carregar o calendário'); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [dias]);

  return { datas, loading, erro, configurada: calendarioConfigurado() };
}
