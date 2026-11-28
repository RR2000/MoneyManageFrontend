import {HttpErrorResponse} from '@angular/common/http';
import {MessageKey} from '../i18n/messages.en';

/**
 * The codes the backend gives a demo sandbox (DemoGuard, DemoAccounts), in `code` and `message`, and the texts that say
 * why: what goes outside money is off in the demo, files have a small limit, sandboxes have limits of their own.
 */
export const DEMO_ERRORS: Record<string, MessageKey> = {
  'DEMO_NO_BANKING': 'demo.blocked.banking',
  'DEMO_NO_EMAIL': 'demo.blocked.email',
  'DEMO_NO_SSO': 'demo.blocked.sso',
  'DEMO_NO_PRICES': 'demo.blocked.prices',
  'DEMO_UPLOAD_TOO_LARGE': 'demo.blocked.upload',
  'DEMO_LIMIT_IP': 'demo.error.ip',
  'DEMO_FULL': 'demo.error.full'
};

/** The demo code of an error (DEMO_NO_BANKING...), or null for any other error. */
export function demoCode(err: unknown): string | null {
  if (!(err instanceof HttpErrorResponse)) {
    return null;
  }
  let body: unknown = err.error;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return null;
    }
  }
  const b = body as { code?: unknown, message?: unknown } | null;
  const code = typeof b?.code === 'string' ? b.code : typeof b?.message === 'string' ? b.message : null;
  return code !== null && Object.hasOwn(DEMO_ERRORS, code) ? code : null;
}

/** The key and the values of the text for a demo error, or null when it is not one. */
export function demoError(err: unknown): { key: MessageKey, params: Record<string, string | number> } | null {
  const code = demoCode(err);
  if (code === null) {
    return null;
  }
  const limit = err instanceof HttpErrorResponse ? Number(err.error?.limitKb) : NaN;
  return {key: DEMO_ERRORS[code], params: {kb: Number.isFinite(limit) && limit > 0 ? limit : 256}};
}

/** The end of a login token (its `exp`), or null when it cannot be read: only to skip a sandbox the browser has. */
export function tokenExpiry(token: string | null): number | null {
  if (!token) {
    return null;
  }
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const exp = JSON.parse(atob(part.padEnd(part.length + (4 - part.length % 4) % 4, '='))).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}
