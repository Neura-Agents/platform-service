import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import logger from '../config/logger';
import { ENV } from '../config/env.config';

const client = jwksClient({
    jwksUri: `${ENV.KEYCLOAK?.ISSUER_URL || `http://keycloak:8080/realms/${ENV.KEYCLOAK?.REALM || 'neura-agents'}`}/protocol/openid-connect/certs`,
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5
});

function getKey(header: any, callback: any) {
    client.getSigningKey(header.kid, (err, key: any) => {
        if (err) {
            callback(err);
            return;
        }
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
    });
}

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        username?: string;
        email?: string;
        roles?: string[];
    };
}

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.headers['x-user-id'] as string;
    
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    const queryToken = req.query.jwt as string;

    if (authHeader) {
        if (authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        } else {
            token = authHeader;
        }
    } else if (queryToken) {
        token = queryToken;
    }

    if (token) {
        try {
            // SECURE: Actually verify the token signature
            const decoded = await new Promise<any>((resolve, reject) => {
                jwt.verify(token, getKey, {
                    issuer: [ENV.KEYCLOAK?.ISSUER_URL, ENV.KEYCLOAK?.PUBLIC_ISSUER_URL],
                    algorithms: ['RS256']
                }, (err, payload) => {
                    if (err) return reject(err);
                    resolve(payload);
                });
            });

            if (decoded && decoded.sub) {
                req.user = {
                    id: decoded.sub,
                    username: decoded.preferred_username,
                    email: decoded.email,
                    roles: [
                        ...(decoded.realm_access?.roles || []),
                        ...(decoded.resource_access?.['neura-agents-client']?.roles || [])
                    ]
                };
                return next();
            }
        } catch (err: any) {
            logger.error({ err: err.message }, 'Token verification error');
            res.status(401).json({ error: `Unauthorized: ${err.message}` });
            return;
        }
    }

    if (process.env.NODE_ENV === 'development' && userId) {
        req.user = { id: userId, roles: ['admin'] };
        return next();
    }

    res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
};

export const requireRole = (role: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user || !req.user.roles || !req.user.roles.includes(role)) {
            logger.warn({
                userId: req.user?.id,
                requiredRole: role,
                actualRoles: req.user?.roles,
                url: req.url
            }, 'Forbidden: Insufficient permissions');
            return res.status(403).json({ error: 'Unauthorized' });
        }
        next();
    };
};

export const requirePlatformAdmin = requireRole('platform-admin');
