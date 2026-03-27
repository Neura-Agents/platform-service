import { Response } from 'express';
import { promptService } from '../services/prompt.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import logger from '../config/logger';

export class PromptController {
    async uploadPrompt(req: AuthenticatedRequest, res: Response) {
        try {
            const file = req.file;
            const { name, type } = req.body;
            const userId = req.user?.id || 'anonymous';

            if (!file) {
                return res.status(400).json({ status: 'ERR', error: 'No file uploaded' });
            }

            if (!name || !type) {
                return res.status(400).json({ status: 'ERR', error: 'Name and Type are required' });
            }

            const token = req.headers.authorization;
            const prompt = await promptService.uploadPrompt(file, name, type, userId, token);
            
            res.json({ status: 'OK', prompt });
        } catch (error: any) {
            logger.error({ error: error.message }, 'Prompt upload controller error');
            res.status(500).json({ status: 'ERR', error: 'Unexpected server error while uploading prompt' });
        }
    }

    async getActivePrompt(req: AuthenticatedRequest, res: Response) {
        try {
            const { type } = req.params;
            const prompt = await promptService.getActivePrompt(type as string);
            
            if (!prompt) {
                return res.status(404).json({ status: 'ERR', error: `Active prompt for type '${type}' not found` });
            }
            
            res.json({ status: 'OK', prompt });
        } catch (error: any) {
            res.status(500).json({ status: 'ERR', error: error.message });
        }
    }

    async listPrompts(req: AuthenticatedRequest, res: Response) {
        try {
            const type = typeof req.query.type === 'string' ? req.query.type : undefined;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const promptId = typeof req.query.promptId === 'string' ? req.query.promptId : undefined;
            const name = typeof req.query.name === 'string' ? req.query.name : undefined;
            const q = typeof req.query.q === 'string' ? req.query.q : undefined;

            const result = await promptService.listPrompts({ type, page, limit, promptId, name, q });
            res.json({ status: 'OK', ...result });
        } catch (error: any) {
            res.status(500).json({ status: 'ERR', error: error.message });
        }
    }

    async activatePrompt(req: AuthenticatedRequest, res: Response) {
        try {
            const id = req.params.id as string;
            const prompt = await promptService.activatePrompt(id);
            res.json({ status: 'OK', prompt });
        } catch (error: any) {
            res.status(500).json({ status: 'ERR', error: error.message });
        }
    }

    async updateTargeting(req: AuthenticatedRequest, res: Response) {
        try {
            const { id } = req.params;
            const { users, agents, roles } = req.body;
            const prompt = await promptService.updateTargeting(id as string, { users, agents, roles });
            res.json({ status: 'OK', prompt });
        } catch (error: any) {
            logger.error({ error: error.message, id: req.params.id }, 'Failed to update prompt targeting');
            if (error instanceof Error && (
                error.message.includes('Invalid roles') || 
                error.message.includes('Invalid user identifier') || 
                error.message.includes('Invalid agent slugs')
            )) {
                return res.status(400).json({ status: 'ERR', error: error.message });
            }
            res.status(500).json({ status: 'ERR', error: error.message });
        }
    }

    async listPromptTypes(req: AuthenticatedRequest, res: Response) {
        try {
            const types = await promptService.listPromptTypes();
            res.json({ status: 'OK', types });
        } catch (error: any) {
            res.status(500).json({ status: 'ERR', error: error.message });
        }
    }
}

export const promptController = new PromptController();
