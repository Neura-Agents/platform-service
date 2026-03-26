import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../config/logger';

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        username?: string;
        email?: string;
        roles?: string[];
    };
}

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
            const decoded = jwt.decode(token) as any;
            if (decoded && decoded.sub) {
                req.user = {
                    id: decoded.sub,
                    username: decoded.preferred_username,
                    email: decoded.email,
                    roles: decoded.resource_access?.['neura-agents-client']?.roles || []
                };
                return next();
            }
        } catch (err) {
            logger.error({ err }, 'Token decode error');
        }
    }

    if (process.env.NODE_ENV === 'development' && userId) {
        req.user = { id: userId, roles: ['admin'] };
        return next();
    }

    res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
};
