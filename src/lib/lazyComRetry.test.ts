import { describe, it, expect } from 'vitest';
import { ehErroDeChunk } from './lazyComRetry';

describe('ehErroDeChunk', () => {
  it('reconhece as mensagens reais de chunk sumido após deploy', () => {
    // Chrome/Edge (Vite)
    expect(ehErroDeChunk(new Error('Failed to fetch dynamically imported module: https://app/assets/AdminPanel-a1b2.js'))).toBe(true);
    // Safari
    expect(ehErroDeChunk(new Error('Importing a module script failed.'))).toBe(true);
    // Firefox
    expect(ehErroDeChunk(new Error('error loading dynamically imported module'))).toBe(true);
    // Webpack-style
    expect(ehErroDeChunk(new Error('Loading chunk 42 failed.'))).toBe(true);
  });

  it('reconhece pelo name = ChunkLoadError', () => {
    const e = new Error('qualquer coisa');
    e.name = 'ChunkLoadError';
    expect(ehErroDeChunk(e)).toBe(true);
  });

  it('NÃO confunde com erro de aplicação (evita reload em loop por bug real)', () => {
    expect(ehErroDeChunk(new Error("Cannot read properties of undefined (reading 'map')"))).toBe(false);
    expect(ehErroDeChunk(new Error('Missing or insufficient permissions.'))).toBe(false);
    expect(ehErroDeChunk(null)).toBe(false);
    expect(ehErroDeChunk(undefined)).toBe(false);
  });
});
