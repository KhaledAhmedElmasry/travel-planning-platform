import { randomInt } from 'node:crypto';

// Area: Payments, Holds & Booking Engine
// FLT-23, HTL-17: the booking reference given on confirmation, e.g. "K7QM2X": 6 random characters
// without look-alikes (no 0/O, 1/I/L). Uniqueness is guaranteed by the unique index on
// `reference` in each booking collection; a clash only causes a retry with a new reference.
const REFERENCE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const REFERENCE_LENGTH = 6;

// How many references to try before giving up (a clash is already very unlikely).
export const REFERENCE_ATTEMPTS = 5;

export function newReference(): string {
  let reference = '';
  for (let i = 0; i < REFERENCE_LENGTH; i++) {
    reference += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  }
  return reference;
}
