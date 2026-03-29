// User authentication types
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
}

// Doctor types
export type AttendancePeriod = 'M' | 'T' | 'MT' | 'AG'; // M = Manhã, T = Tarde, MT = Dia inteiro, AG = Agendado

export interface WorkingHours {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  period?: AttendancePeriod; // M, T, or AG
  specificTime?: string; // HH:mm format - only used when period is 'AG'
  // Legacy fields for backwards compatibility
  startTime?: string; // HH:mm format
  endTime?: string; // HH:mm format
}

// Period time ranges
export const PERIOD_TIMES = {
  M: { start: '08:00', end: '12:00', label: 'Manhã (08:00 - 12:00)' },
  T: { start: '13:00', end: '18:00', label: 'Tarde (13:00 - 18:00)' },
  MT: { start: '08:00', end: '18:00', label: 'Dia inteiro (08:00 - 18:00)' },
  AG: { start: '', end: '', label: 'Agendado (horário específico)' }
} as const;

export interface Doctor {
  id: string;
  name: string;
  crm: string; // Format: 000000/UF
  specialty?: string;
  phone?: string;
  email?: string;
  address: Address;
  coordinates?: Coordinates;
  workingHours: WorkingHours[];
  notes?: string;
  hasPanel?: boolean;
  createdAt: Date;
  updatedAt: Date;
  syncStatus: 'synced';
  lastVisitDate?: Date;
  lastRoutedDate?: Date;
}

export interface Pharmacy {
  id: string;
  name?: string;
  phone?: string;
  address: Address;
  coordinates?: Coordinates;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  syncStatus: 'synced';
  lastRoutedDate?: Date;
}

export interface Address {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  fullAddress?: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Route/Schedule types
export type RouteType = 'day' | 'week' | 'month';

export interface Route {
  id: string;
  name?: string;
  routeType: RouteType;
  weekStartDate: Date;
  weekEndDate: Date;
  visitsPerDay: number;
  visitDuration: number; // in minutes
  totalDistance?: number; // in km
  totalTime?: number; // in minutes
  status: RouteStatus;
  dailySchedules: DailySchedule[];
  createdAt: Date;
  updatedAt: Date;
  syncStatus: 'synced';
}

export type RouteStatus = 'draft' | 'confirmed' | 'in_progress' | 'completed';

export interface DailySchedule {
  id: string;
  routeId: string;
  date: Date;
  dayOfWeek: number;
  visits: ScheduledVisit[];
  totalDistance?: number;
  totalTime?: number;
  status: DayStatus;
}

export type DayStatus = 'pending' | 'in_progress' | 'completed';

export interface ScheduledVisit {
  id: string;
  dailyScheduleId: string;
  doctorId: string;
  doctor?: Doctor;
  pharmacyId?: string;
  pharmacy?: Pharmacy;
  order: number;
  scheduledTime: string; // HH:mm format
  estimatedEndTime: string;
  estimatedTravelTime?: number; // in minutes
  estimatedDistance?: number; // in km
  status: VisitStatus;
  isSuggestion?: boolean; // true = médico sem painel, não conta no limite de visitas/dia
  actualStartTime?: string;
  actualEndTime?: string;
  // Reschedule tracking fields
  rescheduledFromId?: string; // ID of the original visit (if this was rescheduled from another)
  rescheduledToId?: string; // ID of the new visit (if this was rescheduled to another day)
  rescheduledFromDate?: Date; // Original date of the visit
}

export type VisitStatus = 'pending' | 'in_progress' | 'completed' | 'not_done' | 'rescheduled';

// Visit history types
export interface Visit {
  id: string;
  doctorId: string;
  doctor?: Doctor;
  scheduledVisitId?: string;
  date: Date;
  startTime: string;
  endTime?: string;
  status: VisitStatus;
  reason?: string; // If not done or rescheduled
  notes?: string;
  productsPresented?: string[];
  samplesDelivered?: SampleDelivery[];
  createdAt: Date;
  updatedAt: Date;
  syncStatus: 'synced';
}

export interface SampleDelivery {
  productName: string;
  quantity: number;
}

// Settings
export interface Settings {
  id: string;
  userId: string;
  workStartTime: string; // Default: 07:00
  workEndTime: string; // Default: 19:00
  defaultVisitDuration: number; // Default: 30 minutes
  defaultVisitsPerDay: number; // Default: 8
  minimumInterval: number; // Default: 15 minutes
}

// Medical specialties
export const MEDICAL_SPECIALTIES = [
  'Cardiologia',
  'Clínico Geral',
  'Dermatologia',
  'Endocrinologia',
  'Gastroenterologia',
  'Geriatria',
  'Ginecologia',
  'Neurologia',
  'Oftalmologia',
  'Oncologia',
  'Ortopedia',
  'Otorrinolaringologia',
  'Pediatria',
  'Pneumologia',
  'Psiquiatria',
  'Reumatologia',
  'Urologia',
  'Outra'
] as const;

export type MedicalSpecialty = typeof MEDICAL_SPECIALTIES[number];

// Brazilian states for CRM validation
export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
] as const;

export type BrazilianState = typeof BRAZILIAN_STATES[number];

// Days of week in Portuguese
export const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' }
] as const;
