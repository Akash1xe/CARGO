import { format, parseISO } from 'date-fns';
import { SEAT_TYPE_LABELS } from './constants';

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    return format(d, 'dd MMM yyyy');
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    return format(d, 'dd MMM yyyy, hh:mm a');
  } catch {
    return dateStr;
  }
}

export function formatCurrency(amount) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatSeatType(type) {
  return SEAT_TYPE_LABELS[type] || type;
}

const CAPACITY_TYPE_LABELS = {
  STANDARD: 'Standard',
  FRAGILE: 'Fragile',
  REFRIGERATED: 'Temperature Controlled',
  HAZARDOUS: 'Hazardous',
  LOWER: 'Standard',
  MIDDLE: 'Standard',
  UPPER: 'Standard',
  SIDE_LOWER: 'Priority',
  SIDE_UPPER: 'Priority',
};

export function formatCapacityType(type) {
  return CAPACITY_TYPE_LABELS[type] || type?.replaceAll('_', ' ') || 'Type not provided';
}

export function formatCapacityUnitNumber(number) {
  if (number === null || number === undefined || number === '') return 'Unit';
  const value = String(number);
  return /^C/i.test(value) ? value.toUpperCase() : `C${value.padStart(2, '0')}`;
}

export function formatTime(timeStr) {
  if (!timeStr) return '—';
  return timeStr;
}
