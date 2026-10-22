/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Escutas que dormem com a aba (22/10/2026). Cada abertura do sistema relê
 * tudo o que a tela escuta (~4 mil leituras), e a aba esquecida aberta relia
 * de novo a cada reconexão — de madrugada inclusive. Agora, a aba escondida
 * por mais de `esperaMs` cancela as próprias escutas; ao voltar a ficar
 * visível, refaz as mesmas. Os hooks não sabem de nada: o `unsubscribe` que
 * receberam continua valendo, e o estado deles (a lista na tela) fica como
 * estava até o primeiro retorno do banco.
 *
 * A espera (`esperaMs`) é decidida em lib/firebase.ts — ver o porquê lá.
 *
 * Por aba, e não `disableNetwork`: com o cache compartilhado entre abas, só a
 * aba "principal" fala com o servidor por todas — desligar a rede numa aba
 * escondida não economizava nada ou derrubava a que está em uso.
 */
type Desfazer = () => void;

interface Visibilidade {
  hidden: boolean;
  addEventListener: (tipo: 'visibilitychange', fn: () => void) => void;
}

export function criarEscutasPausaveis({ esperaMs, documento, agendar = setTimeout, cancelar = clearTimeout }: {
  esperaMs: number;
  documento?: Visibilidade;
  agendar?: (fn: () => void, ms: number) => any;
  cancelar?: (id: any) => void;
}) {
  const escutas = new Set<{ ligar: () => Desfazer; desfazer: Desfazer | null }>();
  let pausado = false;
  let timer: any;

  const pausar = () => {
    pausado = true;
    for (const e of escutas) { e.desfazer?.(); e.desfazer = null; }
  };
  const retomar = () => {
    pausado = false;
    for (const e of escutas) {
      if (e.desfazer) continue;
      // Uma que falha (ex.: cliente já encerrado) não pode deixar as outras
      // desligadas sem aviso (auditoria de 22/10/2026).
      try { e.desfazer = e.ligar(); }
      catch (err) { console.warn('Escuta não religou:', err); }
    }
  };
  const aoMudar = () => {
    cancelar(timer);
    timer = undefined;
    if (documento?.hidden) timer = agendar(pausar, esperaMs);
    else if (pausado) retomar();
  };
  if (documento) {
    documento.addEventListener('visibilitychange', aoMudar);
    if (documento.hidden) aoMudar(); // aberta já em segundo plano
  }

  /** Liga a escuta (agora, ou quando a aba voltar) e devolve o "desligar" de sempre. */
  return (ligar: () => Desfazer): Desfazer => {
    const e = { ligar, desfazer: pausado ? null : ligar() };
    escutas.add(e);
    return () => {
      escutas.delete(e);
      e.desfazer?.();
      e.desfazer = null;
    };
  };
}
