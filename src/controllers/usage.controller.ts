import { Request, Response } from 'express';
import { UsageService } from '../services/usage.service';
import { Usage, UsageFilter } from '../types/usage.types';
import logger from '../config/logger';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

const usageService = new UsageService();

export const logUsageEntry = async (req: Request, res: Response) => {
    try {
        const usageData: Usage = req.body;
        const entry = await usageService.logUsage(usageData);
        res.status(201).json({ status: 'success', data: entry });
    } catch (error) {
        logger.error({ error }, 'Controller: Failed to log usage');
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const listUsageHistory = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const filter: UsageFilter = {
            agent_id: req.query.agent_id as string,
            api_key: req.query.api_key as string,
            user_id: req.user?.id,
            execution_id: req.query.execution_id as string,
            search: req.query.search as string,
            start_time: req.query.start_time as string,
            end_time: req.query.end_time as string,
            page: req.query.page ? parseInt(req.query.page as string) : 1,
            limit: req.query.limit ? parseInt(req.query.limit as string) : 20
        };

        const result = await usageService.listUsage(filter);
        res.json({ status: 'success', ...result });
    } catch (error) {
        logger.error({ error }, 'Controller: Failed to list usage');
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getUsageStatsHistory = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const filter: UsageFilter = {
            agent_id: req.query.agent_id as string,
            api_key: req.query.api_key as string,
            user_id: req.user?.id,
            execution_id: req.query.execution_id as string,
            search: req.query.search as string,
            start_time: req.query.start_time as string,
            end_time: req.query.end_time as string
        };

        const result = await usageService.getUsageStats(filter);
        res.json({ status: 'success', data: result });
    } catch (error) {
        logger.error({ error }, 'Controller: Failed to get usage stats');
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
