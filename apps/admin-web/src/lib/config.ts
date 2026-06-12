/** Demo mode is on when no API URL is configured — the UI then renders the
 *  built-in Green Valley dataset so the whole system works with zero backend. */
export const DEMO = !process.env['NEXT_PUBLIC_API_URL'];
