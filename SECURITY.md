# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in Nzeru za Alimi, please send an email to the security team. Include as much detail as possible:

- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability
- Suggested fix (if you have one)

### What to Expect

- **Acknowledgment**: We'll acknowledge receipt of your vulnerability report within 48 hours
- **Investigation**: We'll investigate and validate the vulnerability
- **Updates**: We'll keep you informed of our progress
- **Fix**: We'll develop and test a fix
- **Release**: We'll release a security patch
- **Credit**: We'll credit you in the security advisory (unless you prefer to remain anonymous)

## Security Best Practices

When deploying Nzeru za Alimi:

### Required Actions

1. **Change Default Secrets**
   - Generate a strong `JWT_SECRET` (minimum 32 characters)
   - Use strong PostgreSQL passwords
   - Never commit secrets to version control

2. **Use HTTPS**
   - Deploy behind a reverse proxy (nginx, Caddy)
   - Use SSL/TLS certificates (Let's Encrypt)
   - Enable HSTS headers

3. **Database Security**
   - Use strong PostgreSQL passwords
   - Restrict database access to localhost or private networks
   - Enable PostgreSQL SSL connections
   - Regular backups with encryption

4. **Environment Variables**
   - Never commit `.env` files
   - Use secrets management in production
   - Rotate secrets regularly

5. **Rate Limiting**
   - Configure rate limiting for authentication endpoints
   - Monitor for brute force attacks
   - Implement account lockout policies

6. **Updates**
   - Keep dependencies up to date
   - Monitor security advisories
   - Apply patches promptly

### Recommended Actions

1. **Monitoring**
   - Enable request logging
   - Monitor for suspicious activity
   - Set up alerts for failed authentication attempts

2. **Access Control**
   - Use principle of least privilege
   - Regular audit of user permissions
   - Implement IP whitelisting where appropriate

3. **Data Protection**
   - Regular database backups
   - Encrypt backups
   - Test restore procedures

4. **Network Security**
   - Use firewall rules
   - Restrict unnecessary ports
   - Use VPN for administrative access

## Known Security Considerations

### Authentication

- PINs are 4 digits - consider requiring longer PINs for sensitive operations
- JWT tokens are valid for 30 days - adjust based on your security requirements
- No 2FA implementation yet - consider adding for staff accounts

### API Security

- Rate limiting should be configured in production
- Consider adding API key authentication for external integrations
- Implement request size limits

### USSD Channel

- USSD communication is not encrypted by telcos
- Sensitive operations should require additional verification
- Consider transaction limits

## Security Updates

Security updates will be released as soon as possible after a vulnerability is confirmed. Subscribe to repository releases or watch the repository to be notified of security updates.

## Compliance

This project is designed for agricultural data management in Malawi. Consider compliance with:

- Malawi Data Protection Act
- GDPR (if handling EU citizen data)
- Industry-specific regulations

## Questions?

If you have questions about security but don't have a vulnerability to report, open a GitHub issue tagged with `security` and `question`.
