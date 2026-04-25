import jwksClient from 'jwks-rsa';
import jwt from 'jsonwebtoken';

export interface LumoraJwtPayload {
  sub: string;
  tenant_id: string;
  email: string;
  roles: string[];
  scope_json?: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
}

let _client: ReturnType<typeof jwksClient> | null = null;

function getJwksClient(keycloakUrl: string, realm: string) {
  if (!_client) {
    _client = jwksClient({
      jwksUri: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600_000, // 10 min
    });
  }
  return _client;
}

export async function verifyJwt(
  token: string,
  opts: { keycloakUrl: string; realm: string; issuer: string },
): Promise<LumoraJwtPayload> {
  const client = getJwksClient(opts.keycloakUrl, opts.realm);

  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string') {
    throw new Error('Invalid JWT format');
  }

  const kid = decoded.header.kid;
  const key = await client.getSigningKey(kid);
  const publicKey = key.getPublicKey();

  const payload = jwt.verify(token, publicKey, {
    issuer: opts.issuer,
    algorithms: ['RS256'],
  });

  if (typeof payload === 'string') throw new Error('Unexpected string payload');

  return payload as LumoraJwtPayload;
}
