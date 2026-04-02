import { pool } from '../config/db.config';
import logger from '../config/logger';

export class CacheService {
    /**
     * Get data from the cache table if it exists and is not expired.
     */
    static async get(cacheKey: string): Promise<any | null> {
        try {
            const result = await pool.query(
                'SELECT response_data FROM external_api_cache WHERE cache_key = $1 AND expires_at > NOW()',
                [cacheKey]
            );

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0].response_data;
        } catch (error) {
            logger.error({ error, cacheKey }, 'Failed to get data from cache');
            return null;
        }
    }

    /**
     * Upsert data into the cache table.
     * @param cacheKey The unique key for the cache.
     * @param data The JSON data to store.
     * @param ttlHours Time to live in hours.
     */
    static async set(cacheKey: string, data: any, ttlHours: number): Promise<void> {
        try {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + ttlHours);

            await pool.query(
                `INSERT INTO external_api_cache (cache_key, response_data, last_fetched_at, expires_at)
                 VALUES ($1, $2, NOW(), $3)
                 ON CONFLICT (cache_key) DO UPDATE
                 SET response_data = EXCLUDED.response_data,
                     last_fetched_at = NOW(),
                     expires_at = EXCLUDED.expires_at`,
                [cacheKey, JSON.stringify(data), expiresAt]
            );
        } catch (error) {
            logger.error({ error, cacheKey }, 'Failed to set data in cache');
        }
    }
}
