/**
 * Extracts raw_output from the HTTP request body and saves it to a file.
 * Usage: node ... < request-body.json
 */
import fs from 'fs';

async function main() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString('utf8');
  const parsed = JSON.parse(body);
  const rawOutput = parsed.raw_output;
  fs.writeFileSync(__dirname + '/repro-raw-output.json', rawOutput, 'utf8');
  console.log('Saved raw_output, length:', rawOutput.length);
  console.log('Starts with:', JSON.stringify(rawOutput.substring(0, 100)));
}

main().catch(console.error);
