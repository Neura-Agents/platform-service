import axios from 'axios';
import { pool } from '../config/db.config';
import { Usage, UsageFilter } from '../types/usage.types';
import logger from '../config/logger';
import { ENV } from '../config/env.config';

export class UsageService {
    private async consumeCredits(userId: string, amount: number, executionId: string, resourceType: string) {
        try {
            logger.info({ userId, amount, executionId }, 'Attempting to consume credits');
            await axios.post(`${ENV.BILLING_SERVICE_URL}/backend/api/billing/consume`, {
                userId,
                amount,
                executionId: executionId,
                description: `Consumption for ${resourceType} execution: ${executionId}`
            }, {
                headers: {
                    'x-internal-key': ENV.INTERNAL_SERVICE_SECRET
                }
            });
        } catch (error: any) {
            logger.error({ 
                error: error.response?.data || error.message, 
                userId, 
                executionId 
            }, 'Failed to consume credits');
            
            // If billing service says 402, it means insufficient funds
            if (error.response?.status === 402) {
                throw new Error('TERMINATE_EXECUTION: Insufficient credits');
            }
            // For other errors, we log and continue to avoid blocking usage tracking 
            // unless strict mode is desired.
        }
    }

    async logUsage(usage: Usage): Promise<Usage> {
        const {
            execution_id,
            resource_id,
            resource_type,
            action_type,
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

        // 1. If there's a cost, consume credits first
        if (total_cost && parseFloat(total_cost.toString()) > 0 && user_id) {
            await this.consumeCredits(user_id, parseFloat(total_cost.toString()), execution_id, resource_type);
        }

        try {
            const result = await pool.query(
                `INSERT INTO usage (
                    execution_id, resource_id, resource_type, action_type, api_key, user_id, 
                    total_input_tokens, total_completion_tokens, total_tokens, 
                    total_cost, initial_request, final_response, llm_calls
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *`,
                [
                    execution_id, resource_id, resource_type, action_type, api_key, user_id,
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
            resource_id,
            resource_type,
            action_type,
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

        if (resource_id) {
            params.push(resource_id);
            conditions.push(`u.resource_id = $${params.length}`);
        }

        if (resource_type) {
            params.push(resource_type);
            conditions.push(`u.resource_type = $${params.length}`);
        }

        if (action_type) {
            params.push(action_type);
            conditions.push(`u.action_type = $${params.length}`);
        }

        if (api_key) {
            params.push(api_key);
            conditions.push(`u.api_key = $${params.length}`);
        }

        if (user_id) {
            params.push(user_id);
            conditions.push(`u.user_id = $${params.length}`);
        }

        if (execution_id) {
            params.push(execution_id);
            conditions.push(`u.execution_id = $${params.length}`);
        }
        
        if (search) {
            params.push(`%${search}%`);
            conditions.push(`u.execution_id ILIKE $${params.length}`);
        }

        if (start_time) {
            params.push(start_time);
            conditions.push(`u.created_at >= $${params.length}`);
        }

        if (end_time) {
            params.push(end_time);
            conditions.push(`u.created_at <= $${params.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        try {
            logger.info({ whereClause, params }, 'UsageService.listUsage: Querying count');
            // Get total count
            const countResult = await pool.query(
                `SELECT COUNT(*) FROM usage u ${whereClause}`,
                params
            );
            const total = parseInt(countResult.rows[0].count);

            // Get paginated items
            const queryParams = [...params, limit, offset];
            logger.info({ limit, offset, paramsCount: queryParams.length }, 'UsageService.listUsage: Querying items');
            const result = await pool.query(
                `SELECT 
                    u.*,
                    a.name as agent_name,
                    kb.name as kb_name,
                    kg.name as kg_name,
                    ak.name as api_key_name,
                    COALESCE(a.name, kb.name, kg.name) as resource_name
                FROM usage u
                LEFT JOIN agents a ON u.resource_type = 'agent' AND (u.resource_id = a.slug OR u.resource_id = a.id::text)
                LEFT JOIN knowledge_bases kb ON u.resource_type = 'knowledge-base' AND u.resource_id = kb.id::text
                LEFT JOIN knowledge_graphs kg ON u.resource_type = 'knowledge-graph' AND u.resource_id = kg.id::text
                LEFT JOIN api_keys ak ON u.api_key = ak.api_key_hash
                ${whereClause} 
                ORDER BY u.created_at DESC 
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
            resource_id,
            resource_type,
            action_type,
            api_key,
            user_id,
            execution_id,
            search,
            start_time,
            end_time
        } = filter;

        const params: any[] = [];
        const conditions: string[] = [];

        if (resource_id) {
            params.push(resource_id);
            conditions.push(`u.resource_id = $${params.length}`);
        }

        if (resource_type) {
            params.push(resource_type);
            conditions.push(`u.resource_type = $${params.length}`);
        }

        if (action_type) {
            params.push(action_type);
            conditions.push(`u.action_type = $${params.length}`);
        }

        if (api_key) {
            params.push(api_key);
            conditions.push(`u.api_key = $${params.length}`);
        }

        if (user_id) {
            params.push(user_id);
            conditions.push(`u.user_id = $${params.length}`);
        }

        if (execution_id) {
            params.push(execution_id);
            conditions.push(`u.execution_id = $${params.length}`);
        }
        
        if (search) {
            params.push(`%${search}%`);
            conditions.push(`u.execution_id ILIKE $${params.length}`);
        }

        if (start_time) {
            params.push(start_time);
            conditions.push(`u.created_at >= $${params.length}`);
        }

        if (end_time) {
            params.push(end_time);
            conditions.push(`u.created_at <= $${params.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        try {
            logger.info({ whereClause, params }, 'UsageService.getUsageStats: Querying stats');
            const result = await pool.query(
                `SELECT u.created_at, u.total_cost, u.total_tokens, u.total_input_tokens, u.total_completion_tokens
                 FROM usage u ${whereClause} 
                 ORDER BY u.created_at ASC`,
                params
            );

            return result.rows;
        } catch (error) {
            logger.error({ error }, 'Service: Failed to get usage stats');
            throw error;
        }
    }
}
