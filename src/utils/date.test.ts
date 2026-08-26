import { describe, it, expect } from 'vitest';
import {
  cleanText,
  dateFromValue,
  formatDateBR,
  toISOInput,
  diasEntre,
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

describe('diasEntre (base do deslocamento de prazos da experiência)', () => {
  it('conta dias entre datas BR', () => {
    expect(diasEntre('01/06/2026', '11/06/2026')).toBe(10);
    expect(diasEntre('11/06/2026', '01/06/2026')).toBe(-10);
    expect(diasEntre('01/06/2026', '01/06/2026')).toBe(0);
  });
  it('aceita ISO e mistura de formatos', () => {
    expect(diasEntre('2026-06-01', '2026-06-11')).toBe(10);
    expect(diasEntre('01/06/2026', '2026-06-11')).toBe(10);
  });
  it('atravessa mês e ano', () => {
    expect(diasEntre('28/02/2026', '02/03/2026')).toBe(2);   // 2026 não é bissexto
    expect(diasEntre('31/12/2026', '01/01/2027')).toBe(1);
  });
  it('data inválida → null (chamador não recalcula prazos)', () => {
    expect(diasEntre('', '01/06/2026')).toBeNull();
    expect(diasEntre('45/13/2026', '01/06/2026')).toBeNull();
  });
});

describe('deslocamento de prazos preserva o espaçamento do registro', () => {
  // Universidade usa 45/75; Colégio usa 45/90. Ao mudar a admissão, os prazos
  // devem ANDAR junto — não ser recalculados com o padrão do Colégio.
  const desloca = (adm: string, novaAdm: string, t1: string, t2: string) => {
    const d = diasEntre(adm, novaAdm)!;
    return { t1: addDaysToDate(t1, d), t2: addDaysToDate(t2, d) };
  };
  it('registro da Universidade (45/75) mantém 75 dias após mover a admissão', () => {
    const adm='01/06/2026', t1='15/07/2026', t2='14/08/2026'; // +44 e +74
    const r = desloca(adm, '08/06/2026', t1, t2);             // +7 dias
    expect(r.t1).toBe('22/07/2026');
    expect(r.t2).toBe('21/08/2026');
    expect(diasEntre('08/06/2026', r.t2)).toBe(74);           // continua 75º dia
  });
  it('registro do Colégio (45/90) mantém 90 dias', () => {
    const adm='01/06/2026';
    const t1=addDaysToDate(adm, DIAS_EXPERIENCIA_1), t2=addDaysToDate(adm, DIAS_EXPERIENCIA_2);
    const r = desloca(adm, '11/06/2026', t1, t2);
    expect(diasEntre('11/06/2026', r.t2)).toBe(DIAS_EXPERIENCIA_2);
  });
});
