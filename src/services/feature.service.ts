import { pool } from '../config/db.config';
import { FeatureFlag, TargetingRules } from '../types/feature.types';
import crypto from 'crypto';

export class FeatureService {
    async list(): Promise<FeatureFlag[]> {
        const result = await pool.query('SELECT * FROM feature_flags ORDER BY key ASC');
        return result.rows;
    }

    async getByKey(key: string): Promise<FeatureFlag | null> {
        const result = await pool.query('SELECT * FROM feature_flags WHERE key = $1', [key]);
        return result.rows[0] || null;
    }

    async create(data: Partial<FeatureFlag>): Promise<FeatureFlag> {
        const { key, name, description, enabled, targeting_rules } = data;
        const result = await pool.query(
            `INSERT INTO feature_flags (key, name, description, enabled, targeting_rules) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING *`,
            [key, name, description, enabled ?? false, JSON.stringify(targeting_rules || { users: [], roles: [], percentage: 100 })]
        );
        return result.rows[0];
    }

    async update(id: string, data: Partial<FeatureFlag>): Promise<FeatureFlag | null> {
        const { name, description, enabled, targeting_rules } = data;
        
        if (targeting_rules) {
            await this.validateTargeting(targeting_rules);
        }

        let query = 'UPDATE feature_flags SET updated_at = CURRENT_TIMESTAMP';
        const params: any[] = [id];
        let count = 2;

        if (name !== undefined) {
            query += `, name = $${count++}`;
            params.push(name);
        }
        if (description !== undefined) {
            query += `, description = $${count++}`;
            params.push(description);
        }
        if (enabled !== undefined) {
            query += `, enabled = $${count++}`;
            params.push(enabled);
        }
        if (targeting_rules !== undefined) {
            query += `, targeting_rules = $${count++}`;
            params.push(JSON.stringify(targeting_rules));
        }

        query += ` WHERE id = $1 RETURNING *`;
        
        const result = await pool.query(query, params);
        return result.rows[0] || null;
    }

    private async validateTargeting(rules: TargetingRules): Promise<void> {
        // 1. Validate Roles
        if (rules.roles && rules.roles.length > 0) {
            const roleChecks = await pool.query(
                'SELECT name FROM roles WHERE name = ANY($1)',
                [rules.roles]
            );
            const existingRoles = roleChecks.rows.map(r => r.name);
            const invalidRoles = rules.roles.filter(role => !existingRoles.includes(role));
            
            if (invalidRoles.length > 0) {
                throw new Error(`Invalid roles: ${invalidRoles.join(', ')}`);
            }
        }

        // 2. Validate and Resolve Users
        if (rules.users && rules.users.length > 0) {
            const resolvedUsers: string[] = [];
            for (const identifier of rules.users) {
                // Check if identifier is keycloak_id, username or email
                const userCheck = await pool.query(
                    'SELECT keycloak_id FROM users WHERE keycloak_id = $1 OR username = $2 OR email = $3',
                    [identifier, identifier, identifier]
                );

                if (userCheck.rowCount === 0) {
                    throw new Error(`Invalid user identifier: ${identifier}`);
                }
                
                // Add the canonical keycloak_id
                resolvedUsers.push(userCheck.rows[0].keycloak_id);
            }
            // Update rules with resolved canonical IDs
            rules.users = [...new Set(resolvedUsers)];
        }
    }

    async delete(id: string): Promise<boolean> {
        const result = await pool.query('DELETE FROM feature_flags WHERE id = $1', [id]);
        return (result.rowCount ?? 0) > 0;
    }

    async evaluate(key: string, user?: { id: string; roles?: string[] }): Promise<boolean> {
        const feature = await this.getByKey(key);
        if (!feature) return false;
        if (!feature.enabled) return false;

        if (!user) {
             // If enabled but no user context, return true only if percentage is 100 or no specific users/roles rules
             const rules = feature.targeting_rules;
             if ((rules.users?.length ?? 0) > 0 || (rules.roles?.length ?? 0) > 0) return false;
             return rules.percentage === 100;
        }

        const rules = feature.targeting_rules;

        // 1. Specific Users
        if (rules.users && rules.users.length > 0) {
            if (rules.users.includes(user.id)) return true;
        }

        // 2. Roles
        if (rules.roles && rules.roles.length > 0 && user.roles) {
            const hasRole = user.roles.some(role => rules.roles?.includes(role));
            if (hasRole) return true;
        }

        // 3. Percentage Rollout
        if (rules.percentage !== undefined && rules.percentage < 100) {
            if (rules.percentage === 0) return false;
            
            // Hash the userID + featureKey to get a stable score between 0-99
            const hash = crypto.createHash('sha1')
                .update(`${user.id}:${key}`)
                .digest('hex');
            const score = parseInt(hash.substring(0, 8), 16) % 100;
            
            return score < rules.percentage;
        }

        // If no specific blocking rules and enabled is true
        return true;
    }
}

export const featureService = new FeatureService();
