import { describe, it, expect } from 'vitest';
import {
  cleanText,
  dateFromValue,
  formatDateBR,
  maskDataBR,
  toISOInput,
  monthAbbrFromDate,
  yearFromDate,
  addDaysToDate,
  DIAS_EXPERIENCIA_1,
  DIAS_EXPERIENCIA_2
} from './date';

describe('cleanText', () => {
  it('trim + colapsa espaços', () => {
    expect(cleanText('  a   b ')).toBe('a b');
  });
  it('null/undefined → ""', () => {
    expect(cleanText(null)).toBe('');
    expect(cleanText(undefined)).toBe('');
  });
});

describe('dateFromValue', () => {
  it('BR DD/MM/YYYY', () => {
    const d = dateFromValue('16/06/2026')!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(16);
  });
  it('ISO YYYY-MM-DD', () => {
    const d = dateFromValue('2026-06-16')!;
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(16);
  });
  it('rejeita datas inválidas (overflow 45/13)', () => {
    expect(dateFromValue('45/13/2026')).toBeNull();
    expect(dateFromValue('32/02/2026')).toBeNull();
  });
  it('vazio / "-" / null → null', () => {
    expect(dateFromValue('')).toBeNull();
    expect(dateFromValue('-')).toBeNull();
    expect(dateFromValue(null)).toBeNull();
  });
});

describe('maskDataBR', () => {
  it('insere as barras progressivamente', () => {
    expect(maskDataBR('0')).toBe('0');
    expect(maskDataBR('01')).toBe('01');
    expect(maskDataBR('0104')).toBe('01/04');
    expect(maskDataBR('01042024')).toBe('01/04/2024');
  });
  it('ignora não-dígitos e corta em 8', () => {
    expect(maskDataBR('01/04/2024')).toBe('01/04/2024'); // re-digitar já formatado
    expect(maskDataBR('0104202499')).toBe('01/04/2024');
    expect(maskDataBR('ab01cd04')).toBe('01/04');
  });
});

describe('formatDateBR / toISOInput', () => {
  it('formatDateBR ISO → BR', () => {
    expect(formatDateBR('2026-06-16')).toBe('16/06/2026');
  });
  it('toISOInput BR → ISO', () => {
    expect(toISOInput('16/06/2026')).toBe('2026-06-16');
  });
  it('toISOInput inválida → ""', () => {
    expect(toISOInput('xyz')).toBe('');
  });
});

describe('monthAbbrFromDate / yearFromDate', () => {
  it('mês abreviado', () => {
    expect(monthAbbrFromDate('16/06/2026')).toBe('jun.');
  });
  it('ano', () => {
    expect(yearFromDate('16/06/2026')).toBe(2026);
  });
});

describe('addDaysToDate', () => {
  it('soma simples', () => {
    expect(addDaysToDate('10/05/2026', 5)).toBe('15/05/2026');
  });
  it('vira o mês', () => {
    expect(addDaysToDate('28/02/2026', 1)).toBe('01/03/2026');
  });
  it('vira o ano', () => {
    expect(addDaysToDate('25/12/2025', 10)).toBe('04/01/2026');
  });
  it('aceita ISO de entrada', () => {
    expect(addDaysToDate('2026-05-10', 5)).toBe('15/05/2026');
  });
  it('inválida → devolve o original', () => {
    expect(addDaysToDate('abc', 10)).toBe('abc');
  });
  it('45º dia inclusivo (admissão 01/03 → 14/04)', () => {
    expect(addDaysToDate('01/03/2026', DIAS_EXPERIENCIA_1)).toBe('14/04/2026');
  });
  it('90º dia inclusivo (admissão 01/03 → 29/05)', () => {
    expect(addDaysToDate('01/03/2026', DIAS_EXPERIENCIA_2)).toBe('29/05/2026');
  });
});
