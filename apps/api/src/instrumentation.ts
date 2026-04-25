import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  serviceName: process.env['OTEL_SERVICE_NAME'] ?? 'lumora-api',
  traceExporter: new OTLPTraceExporter({
    url: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().catch(console.error);
});
