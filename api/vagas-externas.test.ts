import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('./selecoes-do-dia', async (original) => ({
  ...(await original<typeof import('./selecoes-do-dia')>()),
  tokenDeAcesso: async () => 'acesso-falso',
}));
import handler, { validarPedido, MOTIVO, substituicaoRepetida } from './vagas-externas';

const CAT = {
  cargos: ['ASG', 'TME'],
  setores: ['Infraestrutura'],
  sedes: [{ nome: 'DIONISIO TORRES', sigla: 'DT', regiao: 'Dionísio Torres' }, { nome: 'SUL', sigla: 'SUL 1' }, { nome: 'PRE SUL', sigla: 'PSUL' },
    { nome: 'CESIU', sigla: 'CESIU', regiao: 'Universidade' }],
};
const pedido = (extra: Record<string, unknown> = {}) => ({
  versao: 1,
  origem: { sistema: 'Chromos', caso: 'm77_2026-09-01' },
  cargo: 'asg', sede: 'DT', setor: 'Infraestrutura',
  motivo: 'Substituição — abandono de emprego',
  substituido: { nome: 'Fulano de Tal', matricula: '77' },
  descricao: 'Limpeza do 2º andar e banheiros.',
  solicitante: { email: 'coord@christus.com.br', nome: 'Coordenação Infra' },
  ...extra,
});
const AGORA = new Date('2026-10-06T02:00:00Z'); // 23h de 05/10 em Fortaleza

describe('validarPedido', () => {
  it('monta a vaga como o formulário: ABERTA, triagem, RH, sede pelo NOME, cargo do catálogo', () => {
    const r = validarPedido(pedido(), CAT, AGORA);
    if ('erro' in r) throw new Error(r.erro);
    expect(r.docId).toBe('chromos_m77_2026-09-01');
    expect(r.campos).toMatchObject({
      vaga: 'ASG', sede: 'DIONISIO TORRES', setor: 'Infraestrutura', status: 'ABERTA', etapa: 'Triagem de currículos',
      responsavel: 'RH', motivo: MOTIVO, categoriaMotivo: 'Substituição', solicitante: 'Coordenação Infra',
      funcionarioSubstituido: 'Fulano de Tal (matrícula 77)', origem: 'chromos',
      solicitacao: '05/10/2026', mesSolicitacao: 'Out', ano: 2026, etapaDesde: '2026-10-05',
    });
    expect(String(r.campos.observacoes)).toContain('abandono de emprego');
    expect(String(r.campos.observacoes)).toContain('Limpeza do 2º andar');
  });

  it('a vaga nasce com a unidade da sede (sem ela, só o Admin a veria)', () => {
    const col = validarPedido(pedido(), CAT, AGORA), uni = validarPedido(pedido({ sede: 'CESIU' }), CAT, AGORA);
    expect('erro' in col ? col.erro : col.campos.escopo).toBe('colegio');
    expect('erro' in uni ? uni.erro : uni.campos.escopo).toBe('universidade');
  });

  it('sede por sigla ou nome, com ou sem acento/hífen', () => {
    for (const sede of ['SUL 1', 'sul', 'Pré-Sul', 'PSUL']) {
      const r = validarPedido(pedido({ sede }), CAT, AGORA);
      expect('erro' in r ? r.erro : r.campos.sede).toMatch(/^(SUL|PRE SUL)$/);
    }
  });

  it('400 com frase para gente: cargo, sede, setor, versão, sistema, caso e campos obrigatórios', () => {
    const erro = (p: any) => { const r = validarPedido(p, CAT, AGORA); return 'erro' in r ? r.erro : ''; };
    expect(erro(pedido({ cargo: 'Astronauta' }))).toMatch(/Cargo "Astronauta"/);
    expect(erro(pedido({ sede: 'Marte' }))).toMatch(/Sede "Marte"/);
    expect(erro(pedido({ setor: 'Lua' }))).toMatch(/Setor/);
    expect(erro(pedido({ versao: 2 }))).toMatch(/Versão/);
    expect(erro(pedido({ origem: { sistema: 'Outro', caso: 'x' } }))).toMatch(/origem/);
    expect(erro(pedido({ origem: { sistema: 'Chromos', caso: '../vagas/x' } }))).toMatch(/origem.caso/);
    expect(erro(pedido({ solicitante: {} }))).toMatch(/solicitante/);
    expect(erro(pedido({ substituido: {} }))).toMatch(/substituido/);
    expect(erro(null)).toMatch(/JSON/);
  });
});

describe('substituicaoRepetida', () => {
  const viva = (codigo: number, substituido: string, sede = 'DIONISIO TORRES') => ({ codigo, substituido, sede });
  const pede = (substituido: string, sede = 'DIONISIO TORRES') => ({ substituido, sede });
  it('mesmo nome (um é o começo do outro, sem acento/caixa) → a vaga que já existe', () => {
    expect(substituicaoRepetida(pede('Fulano de Tal (matrícula 77)'), [viva(5, 'fulano tal silva')])).toBe(5);
    expect(substituicaoRepetida(pede('Gilberto Maciel'), [viva(6, 'Gilberto Maciel de Oliveira')])).toBe(6);
  });
  it('mesmo prenome, sobrenome diferente: outra pessoa', () => {
    expect(substituicaoRepetida(pede('Maria Eduarda Silva'), [viva(7, 'Maria Eduarda Costa')])).toBeNull();
  });
  it('só pelo nome, homônima de OUTRA sede não bloqueia (a recusa é dura)', () => {
    expect(substituicaoRepetida(pede('Maria Silva', 'SUL'), [viva(10, 'Maria Silva Santos', 'DIONISIO TORRES')])).toBeNull();
    expect(substituicaoRepetida(pede('Maria Silva', 'dionísio torres'), [viva(11, 'Maria Silva Santos', 'DIONISIO TORRES')])).toBe(11);
  });
  it('matrícula dos dois lados decide, em qualquer sede: igual repete mesmo com o nome escrito diferente; diferente não', () => {
    expect(substituicaoRepetida(pede('Fulano (matrícula 77)', 'SUL'), [viva(8, 'F. de Tal (matrícula 77)')])).toBe(8);
    expect(substituicaoRepetida(pede('Fulano de Tal (matrícula 77)'), [viva(9, 'Fulano de Tal (matrícula 78)')])).toBeNull();
  });
  it('nome vazio ou só o prenome contra nome completo: não repete', () => {
    expect(substituicaoRepetida(pede(''), [viva(1, '')])).toBeNull();
    expect(substituicaoRepetida(pede('Josué'), [viva(2, 'Josué Lima')])).toBeNull();
  });
  it('código 0 ainda bloqueia (não é teste de verdade/falso)', () => {
    expect(substituicaoRepetida(pede('Ana Lima'), [viva(0, 'Ana Lima')])).toBe(0);
  });
  it('texto gravado enorme não trava (corte antes do regex)', () => {
    const inicio = Date.now();
    expect(substituicaoRepetida(pede('Ana Lima'), [viva(3, '(matrícula ' + ' '.repeat(240000))])).toBeNull();
    expect(Date.now() - inicio).toBeLessThan(500);
  });
});

describe('handler', () => {
  const resposta = () => {
    const r: any = { code: 0, body: null };
    r.status = (c: number) => { r.code = c; return r; };
    r.json = (b: unknown) => { r.body = b; return r; };
    return r;
  };
  const doc = (campos: Record<string, string>) => ({ fields: Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, { stringValue: v }])) });
  const original = globalThis.fetch;
  let banco: Record<string, any>;
  let criarFalha = false;
  // contadores/vagas: o mesmo contador da tela, com updateTime (precondição).
  let contador: { ultimo: number; updateTime: string } | null;
  let outroGravaAntes = 0; // simula N reservas de outra pessoa entre a leitura e a gravação
  // Vagas vivas da unidade (consulta da substituição repetida) e o filtro que ela usou.
  let vivas: { codigo: number; substituido: string; sede?: string }[];
  let consultaVivas: any;

  beforeEach(() => {
    vi.stubEnv('SGPC_VAGAS_TOKEN', 'segredo');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    banco = {};
    criarFalha = false;
    contador = { ultimo: 2147180526, updateTime: 't0' };
    outroGravaAntes = 0;
    vivas = [];
    consultaVivas = null;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      const u = String(url), metodo = init?.method || 'GET';
      if (u.endsWith('/cargos?pageSize=300')) return Response.json({ documents: CAT.cargos.map(nome => doc({ nome })) });
      if (u.endsWith('/setores?pageSize=300')) return Response.json({ documents: CAT.setores.map(nome => doc({ nome })) });
      if (u.endsWith('/sedes?pageSize=300')) return Response.json({ documents: CAT.sedes.map(s => doc(s as any)) });
      if (u.endsWith(':runQuery') && String(init?.body).includes('"escopo"')) {
        consultaVivas = JSON.parse(String(init?.body)).structuredQuery.where;
        return Response.json(vivas.map(v => ({ document: { fields: { codigo: { integerValue: String(v.codigo) }, funcionarioSubstituido: { stringValue: v.substituido }, sede: { stringValue: v.sede ?? 'DIONISIO TORRES' } } } })));
      }
      if (u.endsWith(':runQuery')) return Response.json([{ document: { fields: { codigo: { integerValue: '2147180526' } } } }]);
      if (u.endsWith('/logs')) { banco.__log = JSON.parse(String(init?.body)); return Response.json({}); }
      if (u.includes('/contadores/vagas')) {
        if (!contador) return new Response('', { status: 404 });
        if (metodo === 'GET') return Response.json({ fields: { ultimo: { integerValue: String(contador.ultimo) } }, updateTime: contador.updateTime });
        if (outroGravaAntes > 0) { outroGravaAntes--; contador = { ultimo: contador.ultimo + 1, updateTime: contador.updateTime + 'x' }; }
        const pedidoTempo = decodeURIComponent(/currentDocument.updateTime=([^&]+)/.exec(u)?.[1] || '');
        if (pedidoTempo !== contador.updateTime) return new Response('FAILED_PRECONDITION', { status: 400 });
        contador = { ultimo: Number(JSON.parse(String(init?.body)).fields.ultimo.integerValue), updateTime: contador.updateTime + 'y' };
        return Response.json({});
      }
      const m = /\/vagas\/([^?]+)(\?.*)?$/.exec(u);
      if (m && metodo === 'GET') return banco[m[1]] ? Response.json(banco[m[1]]) : new Response('', { status: 404 });
      if (m && metodo === 'PATCH') {
        if (criarFalha) { banco[m[1]] = { fields: { codigo: { integerValue: '999' } } }; return new Response('existe', { status: 409 }); }
        banco[m[1]] = JSON.parse(String(init?.body));
        return Response.json(banco[m[1]]);
      }
      throw new Error(`inesperado: ${metodo} ${u}`);
    }) as unknown as typeof fetch;
  });
  afterEach(() => { globalThis.fetch = original; vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  const enviar = async (corpo: unknown, token = 'segredo', method = 'POST') => {
    const r = resposta();
    await handler({ method, headers: { authorization: `Bearer ${token}` }, body: corpo }, r);
    return r;
  };

  it('sem a variável: 503; token errado: 401; GET: 405', async () => {
    expect((await enviar(pedido(), 'errado')).code).toBe(401);
    expect((await enviar(pedido(), 'segredo', 'GET')).code).toBe(405);
    vi.stubEnv('SGPC_VAGAS_TOKEN', '');
    expect((await enviar(pedido())).code).toBe(503);
  });

  it('cria com código = maior + 1 (201) e o mesmo caso de novo devolve a mesma (200)', async () => {
    const a = await enviar(pedido());
    expect(a.code).toBe(201);
    expect(a.body).toEqual({ id: 'chromos_m77_2026-09-01', codigo: '2147180527' });
    expect(banco['chromos_m77_2026-09-01'].fields.status.stringValue).toBe('ABERTA');
    const b = await enviar(pedido());
    expect(b.code).toBe(200);
    expect(b.body).toEqual(a.body);
  });

  it('o número vem do contador único e o contador anda junto (a tela não repete o número)', async () => {
    contador = { ultimo: 2147180600, updateTime: 't0' }; // a tela já reservou além do maior gravado
    const a = await enviar(pedido());
    expect(a.body.codigo).toBe('2147180601');
    expect(contador!.ultimo).toBe(2147180601);
  });

  it('outra reserva no meio: lê o contador de novo em vez de repetir o número', async () => {
    outroGravaAntes = 1;
    const a = await enviar(pedido());
    expect(a.code).toBe(201);
    expect(a.body.codigo).toBe('2147180528'); // 527 foi da outra reserva
    expect(contador!.ultimo).toBe(2147180528);
  });

  it('código gravado absurdo (importação) não empurra o contador', async () => {
    contador = { ultimo: 2147100000, updateTime: 't0' }; // maior gravado (2147180526) está 80 mil acima
    const a = await enviar(pedido());
    expect(a.body.codigo).toBe('2147100001');
  });

  it('sem contador: 502 (não volta ao "maior + 1", que repetiria número)', async () => {
    contador = null;
    expect((await enviar(pedido())).code).toBe(502);
  });

  it('o log da vaga leva a unidade (o Coordenador dela lê)', async () => {
    await enviar(pedido({ sede: 'CESIU' }));
    expect(banco.__log.fields.escopo.stringValue).toBe('universidade');
  });

  it('dois envios simultâneos: quem perde a corrida recebe a vaga que ganhou (200)', async () => {
    criarFalha = true;
    const r = await enviar(pedido());
    expect(r.code).toBe(200);
    expect(r.body).toEqual({ id: 'chromos_m77_2026-09-01', codigo: '999' });
  });

  it('400 com a frase quando a sede não existe', async () => {
    const r = await enviar(pedido({ sede: 'Marte' }));
    expect(r.code).toBe(400);
    expect(r.body.erro).toMatch(/Sede "Marte"/);
  });

  describe('substituição repetida', () => {
    it('vaga viva da unidade com a mesma pessoa: 409 com o número dela, nada criado e o contador parado', async () => {
      vivas = [{ codigo: 2147180400, substituido: 'Fulano de Tal' }];
      const r = await enviar(pedido());
      expect(r.code).toBe(409);
      expect(r.body).toMatchObject({ codigo: '2147180400' });
      expect(r.body.erro).toMatch(/nº 2147180400/);
      expect(banco['chromos_m77_2026-09-01']).toBeUndefined();
      expect(contador?.ultimo).toBe(2147180526);
      expect(Object.keys(r.body).sort()).toEqual(['codigo', 'erro']); // nem nome, nem sede, nem status
    });
    it('a recusa deixa um log na unidade, sem o nome da pessoa', async () => {
      vivas = [{ codigo: 2147180400, substituido: 'Fulano de Tal' }];
      await enviar(pedido());
      const log = banco.__log.fields;
      expect(log.acao.stringValue).toBe('SINALIZOU');
      expect(log.escopo.stringValue).toBe('colegio');
      expect(log.detalhes.stringValue).toMatch(/#2147180400/);
      expect(log.detalhes.stringValue).not.toMatch(/Fulano/);
    });
    it('vale também para o token do Orkestria', async () => {
      vi.stubEnv('SGPC_VAGAS_TOKEN_ORKESTRIA', 'segredo-ork');
      vivas = [{ codigo: 2147180401, substituido: 'Fulano de Tal' }];
      const r = await enviar(pedido({ origem: { sistema: 'Orkestria', caso: 'christus_dt_f9' }, motivo: 'Pedido de demissão' }), 'segredo-ork');
      expect(r.code).toBe(409);
    });
    it('consulta 200 com corpo torto: 502, nada criado', async () => {
      const antes = globalThis.fetch;
      globalThis.fetch = (async (url: string, init?: RequestInit) =>
        String(url).endsWith(':runQuery') && String(init?.body).includes('"escopo"') ? Response.json({ error: 'x' }) : antes(url, init)) as typeof fetch;
      expect((await enviar(pedido())).code).toBe(502);
      expect(banco['chromos_m77_2026-09-01']).toBeUndefined();
    });
    it('procura só nas vivas da MESMA unidade', async () => {
      await enviar(pedido({ sede: 'CESIU' }));
      const [escopo, status] = consultaVivas.compositeFilter.filters.map((f: any) => f.fieldFilter);
      expect(escopo.value.stringValue).toBe('universidade');
      expect(status.op).toBe('IN');
      expect(status.value.arrayValue.values.map((v: any) => v.stringValue)).toEqual(['ABERTA', 'REABERTA', 'DOCUMENTAÇÃO', 'PAUSADA', 'SUSPENSA']);
    });
    it('o reenvio do MESMO caso continua devolvendo a vaga (200), mesmo ela estando viva', async () => {
      const a = await enviar(pedido());
      vivas = [{ codigo: Number(a.body.codigo), substituido: 'Fulano de Tal (matrícula 77)' }];
      const b = await enviar(pedido());
      expect(b.code).toBe(200);
      expect(b.body).toEqual(a.body);
    });
    it('outra pessoa (matrícula diferente) cria normalmente', async () => {
      vivas = [{ codigo: 2147180400, substituido: 'Fulano de Tal (matrícula 78)' }];
      expect((await enviar(pedido())).code).toBe(201);
    });
    it('falha ao ler as vagas vivas: 502, nunca cria às cegas', async () => {
      const antes = globalThis.fetch;
      globalThis.fetch = (async (url: string, init?: RequestInit) =>
        String(url).endsWith(':runQuery') && String(init?.body).includes('"escopo"') ? new Response('', { status: 500 }) : antes(url, init)) as typeof fetch;
      const r = await enviar(pedido());
      expect(r.code).toBe(502);
      expect(banco['chromos_m77_2026-09-01']).toBeUndefined();
    });
  });

  it('aceita o corpo como texto JSON', async () => {
    expect((await enviar(JSON.stringify(pedido()))).code).toBe(201);
  });

  describe('Orkestria (desligamento)', () => {
    const doOrkestria = (extra: Record<string, unknown> = {}) =>
      pedido({ origem: { sistema: 'Orkestria', caso: 'christus_dt_f6' }, motivo: 'Pedido de demissão', ...extra });
    beforeEach(() => vi.stubEnv('SGPC_VAGAS_TOKEN_ORKESTRIA', 'segredo-ork'));

    it('com o token do Orkestria: vaga própria (prefixo, origem e texto do Orkestria)', async () => {
      const r = await enviar(doOrkestria(), 'segredo-ork');
      expect(r.code).toBe(201);
      expect(r.body.id).toBe('orkestria_christus_dt_f6');
      const f = banco['orkestria_christus_dt_f6'].fields;
      expect(f.origem.stringValue).toBe('orkestria');
      expect(f.observacoes.stringValue).toContain('Aberta automaticamente pelo Orkestria');
      expect(f.observacoes.stringValue).toContain('Pedido de demissão');
      expect(f.motivo.stringValue).toBe(MOTIVO);
    });

    it('o token do Orkestria não abre vaga em nome do Chromos, nem o contrário', async () => {
      const a = await enviar(pedido(), 'segredo-ork');
      expect(a.code).toBe(400);
      expect(a.body.erro).toMatch(/esperado "Orkestria"/);
      const b = await enviar(doOrkestria(), 'segredo');
      expect(b.code).toBe(400);
      expect(b.body.erro).toMatch(/esperado "Chromos"/);
    });

    it('motivos da lista passam como vieram (com ou sem acento/caixa)', async () => {
      for (const [enviado, gravado] of [['Demissão sem justa causa', 'Demissão sem justa causa'], ['TRANSFERENCIA', 'Transferência']]) {
        banco = {};
        await enviar(doOrkestria({ motivo: enviado }), 'segredo-ork');
        expect(banco['orkestria_christus_dt_f6'].fields.observacoes.stringValue).toContain(gravado);
      }
    });

    it('"Outros" (fora da lista) cai no padrão', async () => {
      await enviar(doOrkestria({ motivo: 'Outros' }), 'segredo-ork');
      expect(banco['orkestria_christus_dt_f6'].fields.observacoes.stringValue).toContain('— desligamento.');
    });

    it('motivo fora da lista (ex.: disciplinar) vira "desligamento"; o log não leva motivo', async () => {
      const r = await enviar(doOrkestria({ motivo: 'Justa causa por furto no almoxarifado' }), 'segredo-ork');
      expect(r.code).toBe(201);
      const obs = banco['orkestria_christus_dt_f6'].fields.observacoes.stringValue;
      expect(obs).not.toMatch(/furto|justa causa/i);
      expect(obs).toContain('desligamento');
      expect(banco.__log.fields.detalhes.stringValue).not.toMatch(/furto|demiss|desligamento/i);
    });

    it('os dois sistemas com o mesmo segredo: 503, nunca adivinhar quem fala', async () => {
      vi.stubEnv('SGPC_VAGAS_TOKEN_ORKESTRIA', 'segredo');
      expect((await enviar(doOrkestria(), 'segredo')).code).toBe(503);
      expect((await enviar(pedido(), 'segredo')).code).toBe(503);
    });

    it('basta um token configurado para a rota abrir; o outro sistema leva 401', async () => {
      vi.stubEnv('SGPC_VAGAS_TOKEN', '');
      expect((await enviar(doOrkestria(), 'segredo-ork')).code).toBe(201);
      expect((await enviar(pedido(), 'segredo')).code).toBe(401);
    });
  });
});
