import { describe, expect, it } from 'vitest';
import { lerRota, linkPara } from './rotas';

describe('rotas', () => {
  it('lê a tela e o que ela abre', () => {
    expect(lerRota('#/vagas?vaga=124')).toEqual({ aba: 'vagas', params: { vaga: '124' } });
    expect(lerRota('#/resumo-do-dia?dia=2026-10-08')).toEqual({ aba: 'selecoes', params: { dia: '2026-10-08' } });
    expect(lerRota('#/selecoes')).toEqual({ aba: 'selecoesLista', params: {} });
  });

  it('endereço vazio ou desconhecido cai no Início', () => {
    expect(lerRota('').aba).toBe('home');
    expect(lerRota('#/nao-existe?vaga=1').aba).toBe('home');
  });

  it('ignora parâmetro que nenhuma tela entende', () => {
    expect(lerRota('#/vagas?vaga=7&x=1&dia=').params).toEqual({ vaga: '7' });
  });

  it('lê os atalhos de pessoa e de nova seleção', () => {
    expect(lerRota('#/experiencia?pessoa=Ana%20Souza').params).toEqual({ pessoa: 'Ana Souza' });
    expect(lerRota(linkPara('selecoesLista', { novaSelecao: 'v1' }))).toEqual({ aba: 'selecoesLista', params: { novaSelecao: 'v1' } });
  });

  it('monta o link e ida e volta dá o mesmo', () => {
    expect(linkPara('vagas', { vaga: 124 })).toBe('#/vagas?vaga=124');
    expect(linkPara('home')).toBe('#/inicio');
    expect(linkPara('selecoesLista', { selecao: 'a b/c', dia: undefined })).toBe('#/selecoes?selecao=a+b%2Fc');
    expect(lerRota(linkPara('selecoesLista', { selecao: 'a b/c' })).params.selecao).toBe('a b/c');
  });
});
