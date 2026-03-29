import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { collectHighRiskZapAlerts, collectZapAlerts } from '../src/common/security/zap-report';

interface ScanInput {
  readonly label: string;
  readonly path: string;
}

function parseInputs(argv: string[]): ScanInput[] {
  const parsed = argv
    .map((argument) => {
      const separatorIndex = argument.indexOf('=');
      if (separatorIndex <= 0 || separatorIndex === argument.length - 1) {
        return null;
      }

      return {
        label: argument.slice(0, separatorIndex),
        path: argument.slice(separatorIndex + 1),
      } satisfies ScanInput;
    })
    .filter((input): input is ScanInput => input !== null);

  if (parsed.length === 0) {
    throw new Error(
      'Usage: npx tsx scripts/check-zap-report.ts <label>=<report.json> [...more reports]',
    );
  }

  return parsed;
}

async function main() {
  const inputs = parseInputs(process.argv.slice(2));
  const allAlerts = [];
  const highAlerts = [];

  for (const input of inputs) {
    const raw = await readFile(input.path, 'utf8');
    const report = JSON.parse(raw) as unknown;
    allAlerts.push(...collectZapAlerts(input.label, report));
    highAlerts.push(...collectHighRiskZapAlerts(input.label, report));
  }

  console.log(`ZAP reports inspected: ${inputs.length}`);
  console.log(`Total alerts: ${allAlerts.length}`);
  console.log(`High-risk alerts: ${highAlerts.length}`);

  if (highAlerts.length > 0) {
    console.error('High-risk ZAP alerts detected:');
    for (const alert of highAlerts) {
      console.error(
        `- [${alert.source}] ${alert.name} (${alert.pluginId}) instances=${alert.instances} risk=${alert.riskDescription}`,
      );
    }
    process.exitCode = 1;
    return;
  }

  const scannedFiles = inputs.map((input) => basename(input.path)).join(', ');
  console.log(`No blocking high-risk alerts found in ${scannedFiles}.`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
