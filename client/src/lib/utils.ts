import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse a UTC datetime string from the API.
 * The backend stores naive datetimes (no timezone), so we append Z to force
 * UTC interpretation before handing to the browser, which then converts to
 * the user's local timezone for display.
 */
export function parseUtc(iso: string): Date {
  return new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
}
