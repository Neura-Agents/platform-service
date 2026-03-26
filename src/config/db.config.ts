import { Pool } from 'pg';
import { ENV } from './env.config';
import logger from './logger';

export const pool = new Pool({
    host: ENV.DB.HOST,
    port: ENV.DB.PORT,
    user: ENV.DB.USER,
    password: ENV.DB.PASSWORD,
    database: ENV.DB.NAME,
});

export const initDb = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS feature_flags (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                key VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                enabled BOOLEAN DEFAULT FALSE,
                targeting_rules JSONB DEFAULT '{"users": [], "roles": [], "percentage": 100}',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS roles (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) UNIQUE NOT NULL,
                description TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(key);

            -- Seed roles
            INSERT INTO roles (name, description)
            VALUES 
                ('platform-users', 'Standard platform user access'),
                ('platform-admin', 'Administrative platform access')
            ON CONFLICT (name) DO NOTHING;

            -- Seed default feature flags if they don't exist
            INSERT INTO feature_flags (key, name, description, enabled, targeting_rules)
            VALUES 
                ('feature-agent-list', 'Agent Dashboard', 'Main dashboard showing list of agents', true, '{"users": [], "roles": [], "percentage": 100}'),
                ('feature-create-agent', 'Agent Creation', 'Access to build and edit new agents', true, '{"users": [], "roles": [], "percentage": 100}'),
                ('feature-chat-playground', 'Chat Playground', 'Interactive testing environment for agents', true, '{"users": [], "roles": [], "percentage": 100}'),
                ('feature-mcp-management', 'MCP Control', 'Model Context Protocol management interface', true, '{"users": [], "roles": [], "percentage": 100}'),
                ('feature-tools-registry', 'Tools Registry', 'Agent tools and capability registry', true, '{"users": [], "roles": [], "percentage": 100}'),
                ('feature-knowledge-base', 'Knowledge Base', 'RAG and knowledge asset management', true, '{"users": [], "roles": [], "percentage": 100}'),
                ('feature-api-keys', 'API Key Management', 'Developer API key tools', false, '{"users": [], "roles": ["platform-admin"], "percentage": 100}'),
                ('feature-usage-analytics', 'Usage Dashboard', 'Detailed consumption analytics', true, '{"users": [], "roles": [], "percentage": 50}')
            ON CONFLICT (key) DO NOTHING;
        `);
        logger.info('Platform database initialized successfully');
    } catch (error) {
        logger.error({ error }, 'Failed to initialize platform database');
        throw error;
    }
};
