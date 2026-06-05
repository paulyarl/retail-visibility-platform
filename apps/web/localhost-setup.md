# Local HTTPS Setup for Auth0

## Option 1: PowerShell (Windows)
```powershell
# Create certificate
New-SelfSignedCertificate -DnsName "localhost" -CertStoreLocation "cert:\LocalMachine\My" -NotAfter (Get-Date).AddYears(1)

# Export certificate
$password = ConvertTo-SecureString -String "password" -Force -AsPlainText
Export-PfxCertificate -Cert "cert:\LocalMachine\My\localhost" -FilePath "localhost.pfx" -Password $password

# Trust certificate (run as Administrator)
Import-Certificate -FilePath "localhost.cer" -CertStoreLocation "cert:\LocalMachine\Root"
```

## Option 2: OpenSSL (Cross-platform)
```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout localhost.key -out localhost.crt -days 365 -nodes -subj "/CN=localhost"

# Convert to PFX for Windows
openssl pkcs12 -export -out localhost.pfx -inkey localhost.key -in localhost.crt -password pass:password
```

## Option 3: Use cloudflare.dev (Free)
1. Go to https://cloudflare.com/
2. Sign up for free account
3. Use Pages or Workers to proxy localhost
4. Get instant HTTPS domain

## Option 4: Use Vercel/Netlify dev (Free)
```bash
# Vercel CLI
npm i -g vercel
vercel dev

# Netlify CLI
npm i -g netlify-cli
netlify dev
```

## Option 5: Use Replit (Free)
1. Go to https://replit.com/
2. Create new project
3. Deploy your app there
4. Get instant HTTPS URL
