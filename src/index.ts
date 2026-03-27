import express from 'express';
import cors from 'cors';
import { ENV } from './config/env.config';
import { initDb } from './config/db.config';
import logger from './config/logger';

import featureRoutes from './routes/feature.routes';
import roleRoutes from './routes/role.routes';
import promptRoutes from './routes/prompt.routes';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Log requests
app.use((req, res, next) => {
    logger.info({ 
        method: req.method, 
        url: req.url,
        ip: req.ip 
    }, 'Incoming Request');
    next();
});

// Routes
app.use('/backend/api/platform/features', featureRoutes);
app.use('/backend/api/platform/roles', roleRoutes);
app.use('/backend/api/platform/prompts', promptRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'platform-service', version: '1.0.0' });
});

// Error Handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error({ err, url: req.url }, 'Platform Service: Unhandled error occurred');
    res.status(500).json({ error: 'Internal Server Error' });
});

const start = async () => {
    try {
        await initDb();
        
        app.listen(ENV.PORT, () => {
            logger.info(`Platform service listening on port ${ENV.PORT} in ${ENV.NODE_ENV} mode`);
        });
    } catch (err) {
        logger.fatal({ err }, 'Failed to start platform-service');
        process.exit(1);
    }
};

start();
