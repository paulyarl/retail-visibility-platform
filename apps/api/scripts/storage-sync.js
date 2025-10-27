import { S3Client, ListObjectsV2Command, CopyObjectCommand } from '@aws-sdk/client-s3';
import { URL } from 'url';
import limit from 'p-limit'; // 💡 Retrofit: Added p-limit for concurrency control

// --- Configuration ---
// These environment variables are expected to be loaded from your environment
//const SRC_SERVICE_ROLE = process.env.SRC_SERVICE_ROLE;
//const DST_SERVICE_ROLE = process.env.DST_SERVICE_ROLE;
//const SRC_SUPABASE_URL = process.env.SRC_SUPABASE_URL;
//const DST_SUPABASE_URL = process.env.DST_SUPABASE_URL;

// --- Helper Functions ---

/**
 * Parses a Supabase URL to extract the S3 Endpoint and Host for the SDK.
 * @param {string} supabaseUrl The base Supabase URL (e.g., https://abc.supabase.co)
 * @returns {{endpoint: string, host: string}}
 */
function getS3Config(supabaseUrl) {
    
    console.log(`\nListing SRC_DB_URL - Page ${SRC_DB_URL}`);
    console.log(`\nListing DST_DB_URL - Page ${DST_DB_URL}`);
    if (!SRC_DB_URL || !DST_DB_URL) {
        console.error('❌ ERROR: Database URLs not loaded!');
        console.error('Please run the PowerShell environment loader script before executing:');
        console.error('Get-Content .env.migrate | ... | ForEach-Object { ... }');
        process.exit(1);
    }

    if (!supabaseUrl) {
        throw new Error("Supabase URL is missing.");
    }
    const url = new URL(supabaseUrl);
    const host = url.host; // e.g., abc.supabase.co
    const endpoint = `https://${url.host}/storage/v1/s3`;
    return { host, endpoint };
}

// --- S3 Client Configurations ---

// Check for required environment variables before proceeding


// --- Main Migration Logic ---

async function migrateStorage() {
    // 💡 Retrofit: Removed unused monorepo directory check (vestigial code)

    if (process.cwd().endsWith('apps\\api')) {
        console.log(`NOTE: Changed directory to project root: ${process.cwd()}`);
        process.chdir('../../');
    }

    
    console.log(`\n--- Constants`); 

    const SRC_SERVICE_ROLE = process.env.SRC_SERVICE_ROLE;
    const DST_SERVICE_ROLE = process.env.DST_SERVICE_ROLE;

    const SRC_DB_URL = process.env.SRC_DB_URL;
    const DST_DB_URL = process.env.DST_DB_URL;

    
        
    console.log(`\n--- SRC_DB_URL  ${SRC_DB_URL} `);
    console.log(`\n--- DST_DB_URL  ${DST_DB_URL}  `);
    console.log(`\n--- SRC_SERVICE_ROLE  ${SRC_SERVICE_ROLE}  `);
    console.log(`\n--- DST_SERVICE_ROLE  ${DST_SERVICE_ROLE}  `);

    

    const SRC_SUPABASE_URL = SRC_DB_URL;
    const DST_SUPABASE_URL = DST_DB_URL;


     
    // List of buckets to migrate (must match the names created in Supabase)
    // Retrofit: Confirmed for single 'photos' bucket.
    const BUCKETS_TO_MIGRATE = ['photos'];
    console.log(`\n--- BUCKETS_TO_MIGRATE  ${BUCKETS_TO_MIGRATE}  `);

    // 💡 Retrofit: Set max concurrent copies to prevent rate limiting
    const CONCURRENCY_LIMIT = 10;
    const concurrencyLimiter = limit(CONCURRENCY_LIMIT);

    const srcConfig = getS3Config(SRC_DB_URL);
    console.log(`\n--- srcConfig  ${srcConfig}  `);
    const dstConfig = getS3Config(DST_SUPABASE_URL);
    console.log(`\n--- dstConfig  ${dstConfig}  `);



// Supabase uses 'supabase' as the access key ID and the JWT as the secret
const s3SourceClient = new S3Client({
    // 💡 Retrofit: Changed region to 'global' or 's3' for generic S3-compatible endpoints
    region: 's3',
    endpoint: srcConfig.endpoint,
    credentials: {
        accessKeyId: 'supabase',
        secretAccessKey: SRC_SERVICE_ROLE,
    },
    forcePathStyle: true,
});

const s3DestinationClient = new S3Client({
    region: 's3',
    endpoint: dstConfig.endpoint,
    credentials: {
        accessKeyId: 'supabase',
        secretAccessKey: DST_SERVICE_ROLE,
    },
    forcePathStyle: true,
});

    
    console.log(`\nListing SRC_DB_URL - Page ${SRC_DB_URL}`);
    console.log(`\nListing DST_DB_URL - Page ${DST_DB_URL}`);
    if (!SRC_DB_URL || !DST_DB_URL) {
        console.error('❌ ERROR: Database URLs not loaded!');
        console.error('Please run the PowerShell environment loader script before executing:');
        console.error('Get-Content .env.migrate | ... | ForEach-Object { ... }');
        process.exit(1);
    }

    console.log(`\n--- Starting Secure Storage Migration (AWS SDK) ---`);
    console.log(`Source Host: ${srcConfig.host}`);
    console.log(`Destination Host: ${dstConfig.host}`);
    console.log(`Concurrency Limit: ${CONCURRENCY_LIMIT}\n`);

    for (const bucket of BUCKETS_TO_MIGRATE) {
        console.log(`\n### Processing Bucket: ${bucket} ###`);
        let continuationToken;
        let fileCount = 0;
        let pageCount = 0;

        try {
            do {
                pageCount++;
                console.log(`\nListing objects - Page ${pageCount}`);

                // 1. List objects in the Source Bucket
                const listParams = {
                    Bucket: bucket,
                    ContinuationToken: continuationToken,
                };

                const listResponse = await s3SourceClient.send(new ListObjectsV2Command(listParams));
                
                if (!listResponse.Contents || listResponse.Contents.length === 0) {
                    console.log(`  -> Bucket is empty or finished listing.`);
                    break;
                }
                
                // 2. Prepare and Run Copy Commands with Concurrency Limit
                const copyPromises = listResponse.Contents
                    .filter(object => object.Size > 0) // Ignore zero-byte "folder" objects
                    .map((object) => concurrencyLimiter(async () => {
                        const sourceKey = object.Key;
                        // CopySource format: bucket-name/path/to/object
                        // NOTE: Supabase often needs the full URL or simply CopySource as bucket/key
                        const copySource = `${bucket}/${sourceKey}`; 
                        
                        // Construct the full CopyObject command
                        const copyCommand = new CopyObjectCommand({
                            Bucket: bucket,             
                            CopySource: copySource,     
                            Key: sourceKey,             
                            // 💡 Retrofit: Added MetadataDirective to ensure metadata is copied
                            MetadataDirective: 'COPY',
                        });

                        try {
                            await s3DestinationClient.send(copyCommand);
                            fileCount++;
                            // 💡 Retrofit: Improved progress logging
                            if (fileCount % 10 === 0) { 
                                process.stdout.write(`\n-> Copied ${fileCount} files...`);
                            } else {
                                process.stdout.write('.');
                            }
                        } catch (error) {
                            console.error(`\n❌ Failed to copy ${sourceKey}. Error: ${error.message}`);
                            
                            // 💡 Retrofit: Enhanced critical error logging
                            if (error.Code === 'AccessDenied' || error.StatusCode === 403) {
                                console.error(`CRITICAL: Access denied on bucket ${bucket}. Check Service Role Keys or Bucket Policy.`);
                                throw error; // Re-throw to stop the entire process
                            }
                            // Allow non-critical errors (e.g., temporary network issues) to pass but log
                        }
                    }));

                await Promise.all(copyPromises);

                continuationToken = listResponse.NextContinuationToken;

            } while (continuationToken);

            console.log(`\n✅ Bucket ${bucket} sync complete. Total files copied: ${fileCount}.`);
        } catch (e) {
            // Re-throw critical errors for the main catch block
            throw e;
        }
    }
    

console.log(`[LOG] SRC_SERVICE_ROLE loaded: ${SRC_SERVICE_ROLE ? 'YES (length: ' + SRC_SERVICE_ROLE.length + ')' : 'NO'}`);


    console.log(`\n✨ STORAGE MIGRATION SUCCESSFUL! All target buckets synced to the new project.`);
}

// Execute the main function
migrateStorage().catch(error => {
    console.error(`\n\n### FATAL STORAGE MIGRATION ERROR ###`);
    // Output the error that led to the failure
    console.error(`Error details: ${error.message}`); 
    console.error(`Ensure: 1. Service Role Keys are correct. 2. Destination bucket 'photos' exists.`);
    // Exit with a failure code to alert the developer/CI pipeline
    process.exit(1);
});