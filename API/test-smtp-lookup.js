import { emailService } from './src/services/email.service.js';

async function main() {
  const config = await emailService.getSmtpConfig('it-sector-seed-id');
  console.log("RESOLVED SMTP CONFIG FOR IT SECTOR:", config);
}

main()
  .catch(e => console.error(e));
