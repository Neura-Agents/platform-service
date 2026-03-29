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

            CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(key);

            CREATE TABLE IF NOT EXISTS roles (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) UNIQUE NOT NULL,
                description TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS prompt_types (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) UNIQUE NOT NULL,
                description TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS prompts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                prompt_type_id UUID REFERENCES prompt_types(id),
                content TEXT NOT NULL,
                prompt_text TEXT,
                metadata JSONB DEFAULT '{}',
                storage_path VARCHAR(255),
                is_active BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            -- Ensure prompt_type_id column exists for existing installations
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='prompts' AND column_name='prompt_type_id') THEN
                    ALTER TABLE prompts ADD COLUMN prompt_type_id UUID REFERENCES prompt_types(id);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='prompts' AND column_name='prompt_text') THEN
                    ALTER TABLE prompts ADD COLUMN prompt_text TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='prompts' AND column_name='metadata') THEN
                    ALTER TABLE prompts ADD COLUMN metadata JSONB DEFAULT '{}';
                END IF;
            END $$;

            -- Seed default prompt types
            INSERT INTO prompt_types (name, description)
            VALUES 
                ('agent-execution', 'Main agent execution instruction template')
            ON CONFLICT (name) DO NOTHING;

            -- Migrate existing 'type' string data to prompt_type_id if prompt_type_id is null
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='prompts' AND column_name='type') THEN
                    -- Make it nullable first to avoid insertion errors during transition
                    ALTER TABLE prompts ALTER COLUMN type DROP NOT NULL;

                    UPDATE prompts p
                    SET prompt_type_id = pt.id
                    FROM prompt_types pt
                    WHERE p.type = pt.name AND p.prompt_type_id IS NULL;
                END IF;
            END $$;

            -- Optional: Index on prompt_type_id
            CREATE INDEX IF NOT EXISTS idx_prompts_type_id ON prompts(prompt_type_id);
            CREATE INDEX IF NOT EXISTS idx_prompts_type_active ON prompts(prompt_type_id, is_active);

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

            CREATE TABLE IF NOT EXISTS usage (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                execution_id VARCHAR(255) NOT NULL,
                agent_id VARCHAR(255) NOT NULL,
                api_key VARCHAR(255),
                user_id VARCHAR(255),
                total_input_tokens INTEGER DEFAULT 0,
                total_completion_tokens INTEGER DEFAULT 0,
                total_tokens INTEGER DEFAULT 0,
                total_cost NUMERIC(15, 10) DEFAULT 0,
                initial_request JSONB,
                final_response JSONB,
                llm_calls JSONB DEFAULT '[]',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_usage_agent_id ON usage(agent_id);
            CREATE INDEX IF NOT EXISTS idx_usage_api_key ON usage(api_key);
            CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage(user_id);
            CREATE INDEX IF NOT EXISTS idx_usage_execution_id ON usage(execution_id);
            CREATE INDEX IF NOT EXISTS idx_usage_created_at ON usage(created_at);
        `);
        logger.info('Platform database initialized successfully');
    } catch (error) {
        logger.error({ error }, 'Failed to initialize platform database');
        throw error;
    }
};
