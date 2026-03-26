import { Request, Response } from 'express';
import { pool } from '../config/db.config';
import logger from '../config/logger';

export const listRoles = async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM roles ORDER BY name ASC');
        res.json({ success: true, count: result.rows.length, roles: result.rows });
    } catch (error) {
        logger.error({ error }, 'Failed to list roles');
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
