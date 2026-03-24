import { BRAZILIAN_STATES, type BrazilianState } from '../types';

// Validate CRM format: AA0001234 (2 letters + 4–7 digits)
export function validateCRM(crm: string): { valid: boolean; error?: string } {
  if (!crm) {
    return { valid: false, error: 'CRM é obrigatório' };
  }

  const upper = crm.toUpperCase().trim();
  const match = upper.match(/^([A-Z]{2})(\d{4,7})$/);

  if (!match) {
    return { valid: false, error: 'Formato inválido. Use: SP0001234' };
  }

  const state = match[1] as BrazilianState;
  if (!BRAZILIAN_STATES.includes(state)) {
    return { valid: false, error: 'UF inválida. Ex: SP0001234' };
  }

  return { valid: true };
}

// Apply CRM mask: first 2 chars = letters (UF), remaining = digits, max 9 chars
export function maskCRM(value: string): string {
  const upper = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const letters = upper.replace(/[^A-Z]/g, '').slice(0, 2);
  const digits = upper.replace(/[^0-9]/g, '').slice(0, 7);
  return letters + digits;
}

// Format CRM to standard format (AA0001234)
export function formatCRM(crm: string): string {
  const upper = crm.toUpperCase().trim();
  if (/^[A-Z]{2}\d+$/.test(upper)) return upper;
  // Convert from 000000/UF legacy format
  const numbers = upper.replace(/\D/g, '');
  const state = upper.replace(/[^A-Z]/g, '').slice(0, 2);
  if (state && numbers) return `${state}${numbers}`;
  return crm;
}

// Validate email format
export function validateEmail(email: string): boolean {
  if (!email) return true; // Optional field
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate phone number (Brazilian format)
export function validatePhone(phone: string): boolean {
  if (!phone) return true; // Optional field
  const phoneRegex = /^\(?[1-9]{2}\)?\s?9?[0-9]{4}-?[0-9]{4}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

// Format phone number
export function formatPhone(phone: string): string {
  const numbers = phone.replace(/\D/g, '');
  if (numbers.length === 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  }
  if (numbers.length === 10) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  }
  return phone;
}

// Validate CEP (Brazilian ZIP code)
export function validateCEP(cep: string): boolean {
  const cepRegex = /^\d{5}-?\d{3}$/;
  return cepRegex.test(cep);
}

// Format CEP
export function formatCEP(cep: string): string {
  const numbers = cep.replace(/\D/g, '');
  if (numbers.length === 8) {
    return `${numbers.slice(0, 5)}-${numbers.slice(5)}`;
  }
  return cep;
}

// Validate time format HH:mm
export function validateTime(time: string): boolean {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

// Check if time is within working hours (07:00 - 19:00)
export function isWithinWorkingHours(time: string, startHour = 7, endHour = 19): boolean {
  const [hours] = time.split(':').map(Number);
  return hours >= startHour && hours < endHour;
}

// Validate password strength
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 6) {
    return { valid: false, error: 'Senha deve ter pelo menos 6 caracteres' };
  }
  return { valid: true };
}
