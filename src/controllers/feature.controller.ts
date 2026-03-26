import { Request, Response } from 'express';
import { featureService } from '../services/feature.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import logger from '../config/logger';

export const listFeatures = async (req: Request, res: Response) => {
    try {
        const features = await featureService.list();
        res.json({ success: true, count: features.length, features });
    } catch (error) {
        logger.error({ error }, 'Failed to list features');
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getFeatureByKey = async (req: Request, res: Response) => {
    try {
        const { key } = req.params as { key: string };
        const feature = await featureService.getByKey(key);
        if (!feature) return res.status(404).json({ error: 'Feature not found' });
        res.json({ success: true, feature });
    } catch (error) {
        logger.error({ error, key: req.params.key }, 'Failed to get feature');
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


export const updateFeature = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params as { id: string };
        const feature = await featureService.update(id, req.body);
        if (!feature) return res.status(404).json({ error: 'Feature not found' });
        res.json({ success: true, feature });
    } catch (error: any) {
        logger.error({ error, id: req.params.id }, 'Failed to update feature');
        if (error instanceof Error && (error.message.includes('Invalid roles') || error.message.includes('Invalid user identifier'))) {
            return res.status(400).json({ success: false, error: error.message });
        }
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


export const evaluateFeature = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { key } = req.params as { key: string };
        const result = await featureService.evaluate(key, req.user);
        res.json({ success: true, key, enabled: result });
    } catch (error) {
        logger.error({ error, key: req.params.key }, 'Failed to evaluate feature');
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const evaluateAllFeatures = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const features = await featureService.list();
        const evaluations: Record<string, boolean> = {};
        
        for (const feature of features) {
            evaluations[feature.key] = await featureService.evaluate(feature.key, req.user);
        }

        res.json({ success: true, evaluations });
    } catch (error) {
        logger.error({ error }, 'Failed to evaluate all features');
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
