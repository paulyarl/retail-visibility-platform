/* Temporary verification: generate claim-invite QR artifacts for a seed and
 * print the encoded URLs + artifact sizes. Run:
 *   doppler run --config local -- npx tsx src/scripts/verify-claim-qr.ts <seedId>
 */
import { writeFileSync } from 'fs';
import {
  generateClaimInvitePng,
  generateClaimInvitePostcard,
  getClaimInviteKitMeta,
} from '../services/ClaimInviteQrKitService';

async function main() {
  const seedId = process.argv[2] || 'dps-5CQK-rrxi9fjm';
  const meta = await getClaimInviteKitMeta(seedId);
  if (!meta) {
    console.error('no active claim token for', seedId);
    process.exit(1);
  }
  console.log('qrUrl       :', meta.qrUrl);
  console.log('qrUrlWalkin :', meta.qrUrlWalkin);
  console.log('qrUrlSocial :', meta.qrUrlSocial);
  console.log('claimUrl    :', meta.claimUrl);
  console.log('shortClaim  :', meta.shortClaimUrl);

  const png = await generateClaimInvitePng(seedId, 'mail');
  writeFileSync('C:/Users/pauly/AppData/Local/Temp/claim-qr-verify.png', png.pngBuffer);
  console.log('PNG:', png.filename, png.pngBuffer.length, 'bytes');

  const pdf = await generateClaimInvitePostcard(seedId, 'mail');
  writeFileSync('C:/Users/pauly/AppData/Local/Temp/claim-postcard-verify.pdf', pdf.pdfBuffer);
  console.log('PDF:', pdf.filename, pdf.pdfBuffer.length, 'bytes');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
