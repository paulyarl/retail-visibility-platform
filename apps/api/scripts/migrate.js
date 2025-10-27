import { execaCommand } from 'execa';
import { URL } from 'url';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { faker } from '@faker-js/faker';

// --- CONFIGURATION AND ENVIRONMENT VARIABLES ---

// The script now uses execa, the most reliable way to run shell commands in Node.
async function runMigration() {
    // Check and set working directory to project root for consistent file paths
    if (process.cwd().endsWith('apps\\api')) {
        console.log(`NOTE: Changed directory to project root: ${process.cwd()}`);
        process.chdir('../../');
    }

    // CRITICAL: Environment variables must be loaded into the current session via PowerShell command
    const SRC_DB_URL = process.env.SRC_DB_URL;
    const DST_DB_URL = process.env.DST_DB_URL;
    const DUMP_FILE = 'data_dump.sql'; // Temporary file for dump

    if (!SRC_DB_URL || !DST_DB_URL) {
        console.error('❌ ERROR: Database URLs not loaded!');
        console.error('Please run the PowerShell environment loader script before executing:');
        console.error('Get-Content .env.migrate | ... | ForEach-Object { ... }');
        return;
    }

    // --- NEW: Parse URLs for explicit connection details ---
    const srcUrl = new URL(SRC_DB_URL);
    const dstUrl = new URL(DST_DB_URL);
    
    // Set PGUSER and PGPASSWORD environment variables temporarily for pg_dump/psql to use
    // NOTE: This bypasses issues with passwords in the connection string on Windows/Linux
    const commonEnv = {
        PGUSER: srcUrl.username,
        PGPASSWORD: srcUrl.password
    };


    console.log('--- Starting Secure Data Migration ---');
    console.log(`Source DB Host: ${srcUrl.host}`);
    console.log(`Dest DB Host: ${dstUrl.host}`);
    console.log(`Working Directory: ${process.cwd()}`);

    // --- 1. DUMP DATA FROM SOURCE ---
    try {
        console.log('\n1. Dumping data from Source...');
        
        // CORRECTED COMMAND: Use explicit -h, -p, -d flags to override local connection attempts.
        // We use execa's env option to securely pass the PGUSER/PGPASSWORD credentials.
        const dumpCommand = `pg_dump -h ${srcUrl.hostname} -p ${srcUrl.port} -d ${srcUrl.pathname.substring(1)} --data-only`;

        // CORRECTED: Use the required explicit object notation { file: '...' } for stdout redirection.
        const dumpResult = await execaCommand(dumpCommand, { 
            stdout: { file: DUMP_FILE },
            env: commonEnv // Inject PGUSER/PGPASSWORD securely
        });

        console.log(`Executing: ${dumpCommand} > ${DUMP_FILE}`);
        
        // Check file size to ensure dump was successful (not 0 bytes)
        const stats = await fs.stat(DUMP_FILE);
        if (stats.size === 0) {
            throw new Error('Dump file created but is empty (0 bytes). Check credentials/permissions.');
        }

        console.log(`✅ Dump complete. File size: ${stats.size} bytes.`);
    } catch (error) {
        console.error('❌ DUMP FAILED.');
        console.error('    Reason: Ensure pg_dump is installed and on PATH, or check DB credentials.');
        console.error(`    Details: ${error.message}`);
        return;
    }

    // --- 2. SANITIZE AND MASK PII ---
    try {
        console.log('\n2. Sanitizing PII data (Mocking emails and names)...');

        let data = await fs.readFile(DUMP_FILE, 'utf8');

        // Example MASKING: Replace all existing email addresses with fake ones.
        // NOTE: This assumes email addresses follow a standard format.
        // This is crucial for GDPR/PII compliance before Staging.
        data = data.replace(
            /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g,
            () => faker.internet.email().toLowerCase()
        );

        await fs.writeFile(DUMP_FILE, data, 'utf8');
        console.log(`✅ Sanitization complete. ${DUMP_FILE} updated.`);

    } catch (error) {
        console.error('❌ SANITIZATION FAILED.');
        console.error(`    Details: ${error.message}`);
        return;
    }

    // --- 3. RESTORE DATA TO DESTINATION ---
    try {
        console.log('\n3. Restoring data to Destination...');

        // CORRECTED RESTORE COMMAND: Use explicit flags for psql as well
        const restoreCommand = `psql -h ${dstUrl.hostname} -p ${dstUrl.port} -d ${dstUrl.pathname.substring(1)}`;

        // IMPORTANT: Update commonEnv for the destination credentials
        const restoreEnv = {
            PGUSER: dstUrl.username,
            PGPASSWORD: dstUrl.password
        };

        const { stdout, stderr } = await execaCommand(restoreCommand, {
            input: fsSync.readFileSync(DUMP_FILE), // Read file contents and pipe to psql
            env: restoreEnv // Inject Destination credentials
        });

        if (stderr.includes('FATAL')) {
            throw new Error(`PSQL Error: ${stderr.trim()}`);
        }

        console.log('✅ Restore complete.');

    } catch (error) {
        console.error('❌ RESTORE FAILED.');
        console.error('    Reason: Ensure psql is installed and on PATH, or check DST_DB_URL credentials.');
        console.error(`    Details: ${error.message}`);
        return;
    }

    // --- 4. CLEANUP ---
    await fs.unlink(DUMP_FILE);
    console.log(`\n4. Cleanup complete. Deleted ${DUMP_FILE}.`);
    console.log('\n✨ MIGRATION SUCCESSFUL! Data is now live in the destination project.');
}

runMigration();
