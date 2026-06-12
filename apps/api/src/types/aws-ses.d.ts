/**
 * Ambient shim for the optional AWS SES SDK.
 * The email adapter stubs in dev and lazy-imports the real SDK in
 * production deployments where `@aws-sdk/client-ses` is installed.
 */
declare module '@aws-sdk/client-ses' {
  export class SESClient {
    constructor(config?: Record<string, unknown>);
    send(command: unknown): Promise<{ MessageId?: string }>;
  }
  export class SendEmailCommand {
    constructor(input: Record<string, unknown>);
  }
}
