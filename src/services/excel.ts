import * as XLSX from 'xlsx';
import type { Doctor, Address, WorkingHours, AttendancePeriod } from '../types';
import { MEDICAL_SPECIALTIES, BRAZILIAN_STATES } from '../types';

// Excel template column headers - Updated for M/T/MT/AG format
const TEMPLATE_HEADERS = [
  'Nome Completo*',
  'CRM* (ex: 123456/SP)',
  'Especialidade',
  'Telefone',
  'Email',
  'CEP*',
  'Rua*',
  'Número*',
  'Complemento',
  'Bairro*',
  'Cidade*',
  'Estado* (UF)',
  'Segunda (M/T/MT/AG ou HH:MM)',
  'Terça (M/T/MT/AG ou HH:MM)',
  'Quarta (M/T/MT/AG ou HH:MM)',
  'Quinta (M/T/MT/AG ou HH:MM)',
  'Sexta (M/T/MT/AG ou HH:MM)',
  'Sábado (M/T/MT/AG ou HH:MM)',
  'Observações'
];

// Sample data for the template - Updated with M/T/AG format
const SAMPLE_DATA = [
  [
    'Dr. João Silva',
    '123456/SP',
    'Cardiologia',
    '(11) 99999-9999',
    'joao.silva@email.com',
    '01310-100',
    'Av. Paulista',
    '1000',
    'Sala 101',
    'Bela Vista',
    'São Paulo',
    'SP',
    'M',        // Segunda - Manhã
    'M',        // Terça - Manhã
    'T',        // Quarta - Tarde
    'M',        // Quinta - Manhã
    'T',        // Sexta - Tarde
    '',         // Sábado - não atende
    'Prefere visitas pela manhã'
  ],
  [
    'Dra. Maria Santos',
    '789012/SP',
    'Clínico Geral',
    '(11) 98888-8888',
    'maria.santos@email.com',
    '04543-011',
    'Rua Funchal',
    '500',
    '3º andar',
    'Vila Olímpia',
    'São Paulo',
    'SP',
    '10:30',     // Segunda - Agendado às 10:30
    'T',         // Terça - Tarde
    '',          // Quarta - não atende
    '14:00',     // Quinta - Agendado às 14:00
    'M',         // Sexta - Manhã
    '',          // Sábado - não atende
    'Atende com hora marcada'
  ]
];

// Generate Excel template for doctor import
export function generateDoctorTemplate(): Blob {
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();

  // Create main data sheet
  const wsData = [TEMPLATE_HEADERS, ...SAMPLE_DATA];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  const colWidths = [
    { wch: 25 }, // Nome
    { wch: 18 }, // CRM
    { wch: 18 }, // Especialidade
    { wch: 18 }, // Telefone
    { wch: 25 }, // Email
    { wch: 12 }, // CEP
    { wch: 30 }, // Rua
    { wch: 10 }, // Número
    { wch: 15 }, // Complemento
    { wch: 20 }, // Bairro
    { wch: 18 }, // Cidade
    { wch: 8 },  // Estado
    { wch: 16 }, // Segunda
    { wch: 16 }, // Terça
    { wch: 16 }, // Quarta
    { wch: 16 }, // Quinta
    { wch: 16 }, // Sexta
    { wch: 16 }, // Sábado
    { wch: 30 }, // Observações
  ];
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Médicos');

  // Create instructions sheet
  const instructionsData = [
    ['INSTRUÇÕES PARA PREENCHIMENTO'],
    [''],
    ['Campos obrigatórios estão marcados com *'],
    [''],
    ['CAMPO', 'DESCRIÇÃO', 'EXEMPLO'],
    ['Nome Completo*', 'Nome completo do médico', 'Dr. João Silva'],
    ['CRM*', 'Número do CRM seguido da UF', '123456/SP'],
    ['Especialidade', 'Especialidade médica (opcional)', 'Cardiologia'],
    ['Telefone', 'Telefone de contato (opcional)', '(11) 99999-9999'],
    ['Email', 'Email de contato (opcional)', 'medico@email.com'],
    ['CEP*', 'CEP do local de atendimento', '01310-100'],
    ['Rua*', 'Nome da rua/avenida', 'Av. Paulista'],
    ['Número*', 'Número do endereço', '1000'],
    ['Complemento', 'Complemento do endereço (opcional)', 'Sala 101'],
    ['Bairro*', 'Nome do bairro', 'Bela Vista'],
    ['Cidade*', 'Nome da cidade', 'São Paulo'],
    ['Estado*', 'Sigla do estado (UF)', 'SP'],
    ['Dias da Semana', 'Período ou horário de atendimento', 'M, T, 10:30'],
    ['Observações', 'Notas adicionais (opcional)', 'Prefere visitas pela manhã'],
    [''],
    ['FORMATO DOS HORÁRIOS DE ATENDIMENTO:'],
    ['M', 'Manhã (08:00 às 12:00)', 'M'],
    ['T', 'Tarde (13:00 às 18:00)', 'T'],
    ['MT', 'Dia inteiro (08:00 às 18:00)', 'MT'],
    ['HH:MM', 'Horário específico/agendado', '10:30 ou 14:00'],
    ['(vazio)', 'Não atende neste dia', ''],
    [''],
    ['ESPECIALIDADES ACEITAS:'],
    ...MEDICAL_SPECIALTIES.map(s => [s]),
    [''],
    ['ESTADOS (UF):'],
    [BRAZILIAN_STATES.join(', ')]
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  wsInstructions['!cols'] = [{ wch: 25 }, { wch: 45 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instruções');

  // Generate blob
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// Download template file
export function downloadDoctorTemplate(): void {
  const blob = generateDoctorTemplate();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'modelo_cadastro_medicos.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Parse working hours from string - supports M/T/AG format or specific time (HH:MM)
function parseWorkingHours(value: string, dayOfWeek: number): WorkingHours | null {
  if (!value || value.trim() === '') return null;

  const trimmedValue = value.trim().toUpperCase();

  // Check for period format: M, T, or AG
  if (trimmedValue === 'M' || trimmedValue === 'MANHÃ' || trimmedValue === 'MANHA') {
    return { dayOfWeek, period: 'M' };
  }

  if (trimmedValue === 'T' || trimmedValue === 'TARDE') {
    return { dayOfWeek, period: 'T' };
  }

  if (trimmedValue === 'MT' || trimmedValue === 'DIA INTEIRO' || trimmedValue === 'INTEGRAL') {
    return { dayOfWeek, period: 'MT' };
  }

  if (trimmedValue === 'AG' || trimmedValue === 'AGENDADO') {
    return { dayOfWeek, period: 'AG' };
  }

  // Check for specific time format: HH:MM (for AG with specific time)
  const timeMatch = trimmedValue.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    const hour = timeMatch[1].padStart(2, '0');
    const min = timeMatch[2];
    return {
      dayOfWeek,
      period: 'AG',
      specificTime: `${hour}:${min}`
    };
  }

  // Legacy format: HH:MM-HH:MM (convert to period based on times)
  const rangeMatch = trimmedValue.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/);
  if (rangeMatch) {
    const startHour = parseInt(rangeMatch[1]);
    const endHour = parseInt(rangeMatch[3]);

    // Determine period based on time range
    if (startHour < 12 && endHour <= 13) {
      return { dayOfWeek, period: 'M' };
    } else if (startHour >= 12) {
      return { dayOfWeek, period: 'T' };
    } else {
      // Full day - default to morning
      return { dayOfWeek, period: 'M' };
    }
  }

  return null;
}

// Format phone number
function formatPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

// Format CEP
function formatCEP(cep: string): string {
  if (!cep) return '';
  const digits = cep.replace(/\D/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return cep;
}

// Parse Excel file and return doctor data
export interface ImportResult {
  doctors: Omit<Doctor, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus' | 'coordinates'>[];
  errors: { row: number; message: string }[];
}

export function parseExcelFile(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Get the first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

        // Skip header row
        const rows = jsonData.slice(1);

        const doctors: ImportResult['doctors'] = [];
        const errors: ImportResult['errors'] = [];

        rows.forEach((row, index) => {
          const rowNumber = index + 2; // Account for header and 0-indexing

          // Skip empty rows
          if (!row || row.length === 0 || !row[0]) return;

          try {
            const nome = String(row[0] || '').trim();
            const crm = String(row[1] || '').trim().toUpperCase();
            const especialidade = String(row[2] || '').trim();
            const telefone = formatPhone(String(row[3] || ''));
            const email = String(row[4] || '').trim();
            const cep = formatCEP(String(row[5] || ''));
            const rua = String(row[6] || '').trim();
            const numero = String(row[7] || '').trim();
            const complemento = String(row[8] || '').trim();
            const bairro = String(row[9] || '').trim();
            const cidade = String(row[10] || '').trim();
            const estado = String(row[11] || '').trim().toUpperCase();
            const observacoes = String(row[18] || '').trim();

            // Validate required fields
            if (!nome) {
              errors.push({ row: rowNumber, message: 'Nome é obrigatório' });
              return;
            }

            if (!crm || !/^\d{4,6}\/[A-Z]{2}$/.test(crm)) {
              errors.push({ row: rowNumber, message: 'CRM inválido (formato: 123456/SP)' });
              return;
            }

            if (!cep || !/^\d{5}-?\d{3}$/.test(cep.replace(/\D/g, '') + '-000'.slice(0, 9 - cep.replace(/\D/g, '').length))) {
              errors.push({ row: rowNumber, message: 'CEP inválido' });
              return;
            }

            if (!rua) {
              errors.push({ row: rowNumber, message: 'Rua é obrigatória' });
              return;
            }

            if (!numero) {
              errors.push({ row: rowNumber, message: 'Número é obrigatório' });
              return;
            }

            if (!bairro) {
              errors.push({ row: rowNumber, message: 'Bairro é obrigatório' });
              return;
            }

            if (!cidade) {
              errors.push({ row: rowNumber, message: 'Cidade é obrigatória' });
              return;
            }

            if (!estado || !BRAZILIAN_STATES.includes(estado as any)) {
              errors.push({ row: rowNumber, message: 'Estado inválido' });
              return;
            }

            // Parse working hours
            const workingHours: WorkingHours[] = [];

            // Monday (column 12)
            const monday = parseWorkingHours(String(row[12] || ''), 1);
            if (monday) workingHours.push(monday);

            // Tuesday (column 13)
            const tuesday = parseWorkingHours(String(row[13] || ''), 2);
            if (tuesday) workingHours.push(tuesday);

            // Wednesday (column 14)
            const wednesday = parseWorkingHours(String(row[14] || ''), 3);
            if (wednesday) workingHours.push(wednesday);

            // Thursday (column 15)
            const thursday = parseWorkingHours(String(row[15] || ''), 4);
            if (thursday) workingHours.push(thursday);

            // Friday (column 16)
            const friday = parseWorkingHours(String(row[16] || ''), 5);
            if (friday) workingHours.push(friday);

            // Saturday (column 17)
            const saturday = parseWorkingHours(String(row[17] || ''), 6);
            if (saturday) workingHours.push(saturday);

            // Default working hours if none specified
            if (workingHours.length === 0) {
              for (let day = 1; day <= 5; day++) {
                workingHours.push({
                  dayOfWeek: day,
                  period: 'M' as AttendancePeriod
                });
              }
            }

            const address: Address = {
              street: rua,
              number: numero,
              complement: complemento || undefined,
              neighborhood: bairro,
              city: cidade,
              state: estado,
              zipCode: cep
            };

            doctors.push({
              name: nome,
              crm,
              specialty: especialidade || undefined,
              phone: telefone || undefined,
              email: email || undefined,
              address,
              workingHours,
              notes: observacoes || undefined
            });
          } catch (err) {
            errors.push({ row: rowNumber, message: `Erro ao processar linha: ${err}` });
          }
        });

        resolve({ doctors, errors });
      } catch (err) {
        reject(new Error(`Erro ao ler arquivo Excel: ${err}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo'));
    };

    reader.readAsArrayBuffer(file);
  });
}

// Format working hours for export
function formatWorkingHoursForExport(wh: WorkingHours | undefined): string {
  if (!wh) return '';

  // New format with period
  if (wh.period) {
    if (wh.period === 'AG' && wh.specificTime) {
      return wh.specificTime;
    }
    return wh.period;
  }

  // Legacy format - convert to period
  if (wh.startTime && wh.endTime) {
    const startHour = parseInt(wh.startTime.split(':')[0]);
    const endHour = parseInt(wh.endTime.split(':')[0]);
    if (startHour < 12 && endHour <= 13) return 'M';
    if (startHour >= 12) return 'T';
    return 'M';
  }

  return '';
}

// Export doctors to Excel
export function exportDoctorsToExcel(doctors: Doctor[]): void {
  const data = doctors.map(doctor => {
    const monday = doctor.workingHours.find(wh => wh.dayOfWeek === 1);
    const tuesday = doctor.workingHours.find(wh => wh.dayOfWeek === 2);
    const wednesday = doctor.workingHours.find(wh => wh.dayOfWeek === 3);
    const thursday = doctor.workingHours.find(wh => wh.dayOfWeek === 4);
    const friday = doctor.workingHours.find(wh => wh.dayOfWeek === 5);
    const saturday = doctor.workingHours.find(wh => wh.dayOfWeek === 6);

    return [
      doctor.name,
      doctor.crm,
      doctor.specialty || '',
      doctor.phone || '',
      doctor.email || '',
      doctor.address.zipCode,
      doctor.address.street,
      doctor.address.number,
      doctor.address.complement || '',
      doctor.address.neighborhood,
      doctor.address.city,
      doctor.address.state,
      formatWorkingHoursForExport(monday),
      formatWorkingHoursForExport(tuesday),
      formatWorkingHoursForExport(wednesday),
      formatWorkingHoursForExport(thursday),
      formatWorkingHoursForExport(friday),
      formatWorkingHoursForExport(saturday),
      doctor.notes || ''
    ];
  });

  const wsData = [TEMPLATE_HEADERS, ...data];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  const colWidths = [
    { wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 25 },
    { wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 20 },
    { wch: 18 }, { wch: 8 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 30 }
  ];
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Médicos');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `medicos_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
