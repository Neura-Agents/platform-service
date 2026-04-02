import { Request, Response } from 'express';
import axios from 'axios';
import { CacheService } from '../services/CacheService';
import logger from '../config/logger';

export class ExternalApiController {
    /**
     * Get USD exchange rates with 2-day caching.
     */
    static async getExchangeRates(req: Request, res: Response): Promise<void> {
        const cacheKey = 'exchange_rates_usd';
        const ttlHours = 48; // 2 days

        try {
            // 1. Check Cache
            const cachedData = await CacheService.get(cacheKey);
            if (cachedData) {
                res.json(cachedData);
                return;
            }

            // 2. Fetch From External API
            logger.info('Cache miss for exchange rates, fetching from external API');
            const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
            const data = response.data;

            // 3. Save to Cache
            await CacheService.set(cacheKey, data, ttlHours);

            // 4. Return Data
            res.json(data);
        } catch (error: any) {
            logger.error({ error: error.message }, 'Failed to fetch or cache exchange rates');
            
            // If external fetch fails, try to return expired cache as fallback
            const fallbackResult = await pool.query(
                'SELECT response_data FROM external_api_cache WHERE cache_key = $1',
                [cacheKey]
            );

            if (fallbackResult.rows.length > 0) {
                logger.warn('Returning stale cache data after external API failure');
                res.json(fallbackResult.rows[0].response_data);
            } else {
                res.status(502).json({ error: 'External API failure and no cache available' });
            }
        }
    }
}

// Helper to access pool for fallback (imported from config/db.config)
import { pool } from '../config/db.config';
