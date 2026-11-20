export type AppErrorType = 'unknown';

export interface ClassifiedError {
  type: AppErrorType;
  message: string;
}

/**
 * The app is fully offline, so there is no network/auth/server error taxonomy any
 * more. Everything the user could hit is a local failure — surface one generic,
 * non-technical message (raw details go to console.error at the call site).
 */
export function classifyError(_error: unknown): ClassifiedError {
  return { type: 'unknown', message: 'Qualcosa è andato storto. Riprova.' };
}
