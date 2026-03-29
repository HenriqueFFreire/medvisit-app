// Brazilian national and state holidays

export interface Holiday {
  date: Date;
  name: string;
  type: 'national' | 'state';
  states?: string[]; // undefined = all states (national)
}

// ── Easter calculation (Anonymous Gregorian algorithm) ──
function getEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function shiftDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ── National holidays (calculated per year) ──
export function getNationalHolidays(year: number): Holiday[] {
  const easter = getEaster(year);
  return [
    { date: new Date(year, 0, 1),      name: 'Confraternização Universal',   type: 'national' },
    { date: shiftDays(easter, -48),    name: 'Carnaval — Segunda-feira',      type: 'national' },
    { date: shiftDays(easter, -47),    name: 'Carnaval — Terça-feira',        type: 'national' },
    { date: shiftDays(easter, -2),     name: 'Sexta-feira Santa',             type: 'national' },
    { date: new Date(year, 3, 21),     name: 'Tiradentes',                    type: 'national' },
    { date: new Date(year, 4, 1),      name: 'Dia do Trabalho',               type: 'national' },
    { date: shiftDays(easter, 60),     name: 'Corpus Christi',                type: 'national' },
    { date: new Date(year, 8, 7),      name: 'Independência do Brasil',       type: 'national' },
    { date: new Date(year, 9, 12),     name: 'Nossa Senhora Aparecida',       type: 'national' },
    { date: new Date(year, 10, 2),     name: 'Finados',                       type: 'national' },
    { date: new Date(year, 10, 15),    name: 'Proclamação da República',      type: 'national' },
    { date: new Date(year, 10, 20),    name: 'Consciência Negra',             type: 'national' },
    { date: new Date(year, 11, 25),    name: 'Natal',                         type: 'national' },
  ];
}

// ── State-specific holidays (month is 1-indexed for readability) ──
const STATE_HOLIDAYS_DATA: { month: number; day: number; name: string; states: string[] }[] = [
  // AC — Acre
  { month: 1,  day: 23, name: 'Dia do Estado do Acre',                    states: ['AC'] },
  { month: 6,  day: 15, name: 'Aniversário de Rio Branco',                states: ['AC'] },
  { month: 9,  day: 5,  name: 'Dia da Amazônia',                          states: ['AC'] },
  { month: 11, day: 17, name: 'Assinatura do Tratado de Petrópolis',      states: ['AC'] },

  // AL — Alagoas
  { month: 6,  day: 24, name: 'São João',                                  states: ['AL', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN'] },
  { month: 6,  day: 29, name: 'São Pedro',                                 states: ['AL'] },
  { month: 9,  day: 16, name: 'Emancipação Política de Alagoas',           states: ['AL'] },
  { month: 11, day: 20, name: 'Morte de Zumbi dos Palmares',               states: ['AL'] },

  // AP — Amapá
  { month: 1,  day: 13, name: 'Criação do Território do Amapá',            states: ['AP'] },
  { month: 3,  day: 19, name: 'Dia de São José',                           states: ['AP'] },
  { month: 9,  day: 13, name: 'Criação do Estado do Amapá',                states: ['AP'] },

  // AM — Amazonas
  { month: 9,  day: 5,  name: 'Elevação do Amazonas à Categoria de Estado',states: ['AM'] },

  // BA — Bahia
  { month: 7,  day: 2,  name: 'Independência da Bahia',                    states: ['BA'] },

  // CE — Ceará
  { month: 3,  day: 23, name: 'Data Magna do Ceará',                       states: ['CE'] },

  // DF — Distrito Federal
  { month: 4,  day: 21, name: 'Fundação de Brasília',                      states: ['DF'] },

  // ES — Espírito Santo
  { month: 10, day: 22, name: 'Descobrimento do Espírito Santo',           states: ['ES'] },

  // GO — Goiás
  { month: 7,  day: 26, name: 'Fundação da Cidade de Goiás',               states: ['GO'] },
  { month: 10, day: 24, name: 'Pedestre — Aniversário de Goiás',           states: ['GO'] },

  // MA — Maranhão
  { month: 7,  day: 28, name: 'Adesão do Maranhão à Independência',        states: ['MA'] },
  { month: 8,  day: 28, name: 'São Luís — Padroeiro do Estado',            states: ['MA'] },

  // MT — Mato Grosso
  { month: 11, day: 9,  name: 'Promulgação da Constituição do Estado',     states: ['MT'] },

  // MS — Mato Grosso do Sul
  { month: 10, day: 11, name: 'Criação do Estado de MS',                   states: ['MS'] },

  // MG — Minas Gerais
  { month: 4,  day: 21, name: 'Data Magna de Minas Gerais',                states: ['MG'] },

  // PA — Pará
  { month: 8,  day: 15, name: 'Adesão do Grão-Pará à Independência',       states: ['PA'] },

  // PB — Paraíba
  { month: 8,  day: 5,  name: 'Fundação do Estado da Paraíba',             states: ['PB'] },

  // PR — Paraná
  { month: 12, day: 19, name: 'Emancipação Política do Paraná',            states: ['PR'] },

  // PE — Pernambuco
  { month: 3,  day: 6,  name: 'Revolução Pernambucana',                    states: ['PE'] },
  { month: 6,  day: 24, name: 'São João',                                   states: ['PE'] },

  // PI — Piauí
  { month: 10, day: 19, name: 'Aniversário do Estado do Piauí',            states: ['PI'] },

  // RJ — Rio de Janeiro
  { month: 4,  day: 23, name: 'Dia de São Jorge',                          states: ['RJ'] },
  { month: 10, day: 28, name: 'Dia do Servidor Público',                   states: ['RJ'] },

  // RN — Rio Grande do Norte
  { month: 10, day: 3,  name: 'Mártires de Cunhaú e Uruaçu',               states: ['RN'] },

  // RS — Rio Grande do Sul
  { month: 9,  day: 20, name: 'Revolução Farroupilha',                     states: ['RS'] },

  // RO — Rondônia
  { month: 1,  day: 4,  name: 'Criação do Estado de Rondônia',             states: ['RO'] },
  { month: 6,  day: 18, name: 'Dia do Evangélico',                         states: ['RO'] },

  // RR — Roraima
  { month: 10, day: 5,  name: 'Criação do Estado de Roraima',              states: ['RR'] },

  // SC — Santa Catarina
  { month: 8,  day: 11, name: 'Criação da Capitania de Santa Catarina',    states: ['SC'] },

  // SP — São Paulo
  { month: 7,  day: 9,  name: 'Revolução Constitucionalista de 1932',      states: ['SP'] },
  { month: 11, day: 20, name: 'Dia da Consciência Negra',                  states: ['SP'] },

  // SE — Sergipe
  { month: 7,  day: 8,  name: 'Emancipação Política de Sergipe',           states: ['SE'] },

  // TO — Tocantins
  { month: 10, day: 5,  name: 'Criação do Estado do Tocantins',            states: ['TO'] },
];

export function getStateHolidays(year: number, stateCode: string): Holiday[] {
  return STATE_HOLIDAYS_DATA
    .filter(h => h.states.includes(stateCode))
    .map(h => ({
      date: new Date(year, h.month - 1, h.day),
      name: h.name,
      type: 'state' as const,
      states: h.states,
    }));
}

export function getHolidaysForYear(year: number, stateCode?: string): Holiday[] {
  const national = getNationalHolidays(year);
  const state = stateCode ? getStateHolidays(year, stateCode) : [];

  // Remove duplicates (e.g. Tiradentes appears for MG and DF as state too)
  const allHolidays = [...national];
  for (const sh of state) {
    const alreadyNational = national.some(
      n => n.date.getMonth() === sh.date.getMonth() && n.date.getDate() === sh.date.getDate()
    );
    if (!alreadyNational) allHolidays.push(sh);
  }

  return allHolidays.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export const BRAZILIAN_STATES_NAMES: Record<string, string> = {
  AC: 'Acre',               AL: 'Alagoas',            AP: 'Amapá',
  AM: 'Amazonas',           BA: 'Bahia',              CE: 'Ceará',
  DF: 'Distrito Federal',   ES: 'Espírito Santo',     GO: 'Goiás',
  MA: 'Maranhão',           MT: 'Mato Grosso',        MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',       PA: 'Pará',               PB: 'Paraíba',
  PR: 'Paraná',             PE: 'Pernambuco',         PI: 'Piauí',
  RJ: 'Rio de Janeiro',     RN: 'Rio Grande do Norte',RS: 'Rio Grande do Sul',
  RO: 'Rondônia',           RR: 'Roraima',            SC: 'Santa Catarina',
  SP: 'São Paulo',          SE: 'Sergipe',            TO: 'Tocantins',
};
