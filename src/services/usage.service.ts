import { pool } from '../config/db.config';
import { Usage, UsageFilter } from '../types/usage.types';
import logger from '../config/logger';

export class UsageService {
    async logUsage(usage: Usage): Promise<Usage> {
        const {
            execution_id,
            agent_id,
            api_key,
            user_id,
            total_input_tokens,
            total_completion_tokens,
            total_tokens,
            total_cost,
            initial_request,
            final_response,
            llm_calls
        } = usage;

        try {
            const result = await pool.query(
                `INSERT INTO usage (
                    execution_id, agent_id, api_key, user_id, 
                    total_input_tokens, total_completion_tokens, total_tokens, 
                    total_cost, initial_request, final_response, llm_calls
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *`,
                [
                    execution_id, agent_id, api_key, user_id,
                    total_input_tokens, total_completion_tokens, total_tokens,
                    total_cost, 
                    JSON.stringify(initial_request), 
                    JSON.stringify(final_response), 
                    JSON.stringify(llm_calls)
                ]
            );
            return result.rows[0];
        } catch (error) {
            logger.error({ error, execution_id }, 'Service: Failed to log usage');
            throw error;
        }
    }

    async listUsage(filter: UsageFilter): Promise<{ items: Usage[], total: number }> {
        const {
            agent_id,
            api_key,
            user_id,
            execution_id,
            search,
            start_time,
            end_time,
            page = 1,
            limit = 20
        } = filter;

        const offset = (page - 1) * limit;
        const params: any[] = [];
        const conditions: string[] = [];

        if (agent_id) {
            params.push(agent_id);
            conditions.push(`agent_id = $${params.length}`);
        }

        if (api_key) {
            params.push(api_key);
            conditions.push(`api_key = $${params.length}`);
        }

        if (user_id) {
            params.push(user_id);
            conditions.push(`user_id = $${params.length}`);
        }

        if (execution_id) {
            params.push(execution_id);
            conditions.push(`execution_id = $${params.length}`);
        }
        
        if (search) {
            params.push(`%${search}%`);
            conditions.push(`execution_id ILIKE $${params.length}`);
        }

        if (start_time) {
            params.push(start_time);
            conditions.push(`created_at >= $${params.length}`);
        }

        if (end_time) {
            params.push(end_time);
            conditions.push(`created_at <= $${params.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        try {
            // Get total count
            const countResult = await pool.query(
                `SELECT COUNT(*) FROM usage ${whereClause}`,
                params
            );
            const total = parseInt(countResult.rows[0].count);

            // Get paginated items
            const queryParams = [...params, limit, offset];
            const result = await pool.query(
                `SELECT * FROM usage ${whereClause} 
                ORDER BY created_at DESC 
                LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
                queryParams
            );

            return {
                items: result.rows,
                total
            };
        } catch (error) {
            logger.error({ error }, 'Service: Failed to list usage');
            throw error;
        }
    }

    async getUsageStats(filter: UsageFilter): Promise<Partial<Usage>[]> {
        const {
            agent_id,
            api_key,
            user_id,
            execution_id,
            search,
            start_time,
            end_time
        } = filter;

        const params: any[] = [];
        const conditions: string[] = [];

        if (agent_id) {
            params.push(agent_id);
            conditions.push(`agent_id = $${params.length}`);
        }

        if (api_key) {
            params.push(api_key);
            conditions.push(`api_key = $${params.length}`);
        }

        if (user_id) {
            params.push(user_id);
            conditions.push(`user_id = $${params.length}`);
        }

        if (execution_id) {
            params.push(execution_id);
            conditions.push(`execution_id = $${params.length}`);
        }
        
        if (search) {
            params.push(`%${search}%`);
            conditions.push(`execution_id ILIKE $${params.length}`);
        }

        if (start_time) {
            params.push(start_time);
            conditions.push(`created_at >= $${params.length}`);
        }

        if (end_time) {
            params.push(end_time);
            conditions.push(`created_at <= $${params.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        try {
            const result = await pool.query(
                `SELECT created_at, total_cost, total_tokens, total_input_tokens, total_completion_tokens
                 FROM usage ${whereClause} 
                 ORDER BY created_at ASC`,
                params
            );

            return result.rows;
        } catch (error) {
            logger.error({ error }, 'Service: Failed to get usage stats');
            throw error;
        }
    }
}
