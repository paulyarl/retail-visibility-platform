import { TokenEncryptionService } from '../TokenEncryptionService';

describe('TokenEncryptionService', () => {
  let service: TokenEncryptionService;

  beforeAll(() => {
    process.env.TOKEN_ENCRYPTION_KEY = TokenEncryptionService.generateKey();
    service = new TokenEncryptionService();
  });

  it('should encrypt and decrypt tokens correctly', () => {
    const token = 'test_access_token_12345';
    const encrypted = service.encrypt(token);
    const decrypted = service.decrypt(encrypted);
    
    expect(decrypted).toBe(token);
    expect(encrypted).not.toBe(token);
  });

  it('should verify encryption works', () => {
    expect(service.verify()).toBe(true);
  });
});
