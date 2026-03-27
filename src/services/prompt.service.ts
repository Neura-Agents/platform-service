import { pool } from '../config/db.config';
import axios from 'axios';
import { ENV } from '../config/env.config';
import FormData from 'form-data';
import logger from '../config/logger';
import yaml from 'js-yaml';

export interface PromptMetadata {
    id: string;
    name: string;
    type: string;
    content: string;
    prompt_text: string | null;
    metadata: Record<string, any>;
    storage_path: string;
    is_active: boolean;
    targeting_users: string[];
    targeting_agents: string[];
    targeting_roles: string[];
    created_at: Date;
    updated_at: Date;
}

export class PromptService {
    private parsePromptFile(content: string) {
        const parts = content.split('---');
        // Check if it has YAML frontmatter (starts with --- and has at least one more ---)
        if (content.trim().startsWith('---') && parts.length >= 3) {
            try {
                const frontmatter = parts[1].trim();
                const metadata = yaml.load(frontmatter) as Record<string, any>;
                const promptText = parts.slice(2).join('---').trim();
                return { metadata: metadata || {}, promptText };
            } catch (e) {
                logger.warn({ error: e }, 'Failed to parse prompt frontmatter, treating as raw text');
                return { metadata: {}, promptText: content };
            }
        }
        return { metadata: {}, promptText: content };
    }

    async uploadPrompt(file: Express.Multer.File, name: string, type: string, userId: string, token?: string): Promise<PromptMetadata> {
        try {
            // 1. Forward the file to storage-service
            const formData = new FormData();
            formData.append('file', file.buffer, { filename: file.originalname, contentType: file.mimetype });
            formData.append('fileName', `${type}-${Date.now()}-${file.originalname}`);

            logger.info({ type, name, userId }, 'Forwarding prompt file to storage-service');
            
            const headers: any = {
                ...formData.getHeaders(),
                'x-user-id': userId
            };

            if (token) {
                headers['Authorization'] = token;
            }

            const response = await axios.post(`${ENV.STORAGE_SERVICE_URL}/backend/api/storage/upload`, formData, {
                headers
            });

            const storagePath = response.data.key;
            const fullContent = file.buffer.toString('utf8');
            const { metadata, promptText } = this.parsePromptFile(fullContent);

            // 2. Database Transaction: set previous inactive and insert new active
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                
                // Set all existing prompts of this type to inactive
                await client.query(
                    'UPDATE prompts SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE type = $1',
                    [type]
                );

                // Insert new prompt as active
                const result = await client.query(
                    `INSERT INTO prompts (name, type, content, prompt_text, metadata, storage_path, is_active) 
                     VALUES ($1, $2, $3, $4, $5, $6, true) 
                     RETURNING *`,
                    [name, type, fullContent, promptText, JSON.stringify(metadata), storagePath]
                );

                await client.query('COMMIT');
                logger.info({ id: result.rows[0].id, type }, 'New active prompt saved to DB with parsed metadata');
                return result.rows[0] as PromptMetadata;
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } catch (error: any) {
            logger.error({ error: error.message, status: error.response?.status }, 'Failed to upload prompt');
            throw error;
        }
    }

    async getActivePrompt(type: string): Promise<PromptMetadata | null> {
        const result = await pool.query(
            'SELECT * FROM prompts WHERE type = $1 AND is_active = true',
            [type]
        );
        return result.rows[0] || null;
    }

    async listPrompts(type?: string): Promise<PromptMetadata[]> {
        let query = 'SELECT * FROM prompts';
        const params: any[] = [];
        if (type) {
            query += ' WHERE type = $1';
            params.push(type);
        }
        query += ' ORDER BY created_at DESC';
        const result = await pool.query(query, params);
        return result.rows;
    }

    async activatePrompt(id: string): Promise<PromptMetadata> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // 1. Get the prompt to find its type
            const getPrompt = await client.query('SELECT type FROM prompts WHERE id = $1', [id]);
            if (getPrompt.rows.length === 0) {
                throw new Error('Prompt not found');
            }
            const type = getPrompt.rows[0].type;

            // 2. Deactivate all of that type
            await client.query(
                'UPDATE prompts SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE type = $1',
                [type]
            );

            // 3. Activate the chosen one
            const result = await client.query(
                'UPDATE prompts SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
                [id]
            );

            await client.query('COMMIT');
            return result.rows[0] as PromptMetadata;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async updateTargeting(id: string, targeting: { users?: string[], agents?: string[], roles?: string[] }): Promise<PromptMetadata> {
        const { users, agents, roles } = targeting;
        
        // Validation
        const resolvedUsers = users ? await this.validateUsers(users) : undefined;
        if (agents) await this.validateAgents(agents);
        if (roles) await this.validateRoles(roles);

        const result = await pool.query(
            `UPDATE prompts 
             SET targeting_users = COALESCE($1, targeting_users),
                 targeting_agents = COALESCE($2, targeting_agents),
                 targeting_roles = COALESCE($3, targeting_roles),
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $4 
             RETURNING *`,
            [resolvedUsers || users, agents, roles, id]
        );
        
        if (result.rows.length === 0) {
            throw new Error('Prompt not found');
        }
        
        return result.rows[0] as PromptMetadata;
    }

    private async validateRoles(roles: string[]): Promise<void> {
        if (roles.length === 0) return;
        const result = await pool.query(
            'SELECT name FROM roles WHERE name = ANY($1)',
            [roles]
        );
        const existingRoles = result.rows.map(r => r.name);
        const invalidRoles = roles.filter(r => !existingRoles.includes(r));
        if (invalidRoles.length > 0) {
            throw new Error(`Invalid roles: ${invalidRoles.join(', ')}`);
        }
    }

    private async validateUsers(identifiers: string[]): Promise<string[]> {
        if (identifiers.length === 0) return [];
        const resolvedUsers: string[] = [];
        for (const identifier of identifiers) {
            const result = await pool.query(
                'SELECT keycloak_id FROM users WHERE keycloak_id = $1 OR username = $2 OR email = $3',
                [identifier, identifier, identifier]
            );
            if (result.rowCount === 0) {
                throw new Error(`Invalid user identifier: ${identifier}`);
            }
            resolvedUsers.push(result.rows[0].keycloak_id);
        }
        return [...new Set(resolvedUsers)];
    }

    private async validateAgents(slugs: string[]): Promise<void> {
        if (slugs.length === 0) return;
        const result = await pool.query(
            'SELECT slug FROM agents WHERE slug = ANY($1)',
            [slugs]
        );
        const existingSlugs = result.rows.map(r => r.slug);
        const invalidSlugs = slugs.filter(s => !existingSlugs.includes(s));
        if (invalidSlugs.length > 0) {
            throw new Error(`Invalid agent slugs: ${invalidSlugs.join(', ')}`);
        }
    }
}

export const promptService = new PromptService();
