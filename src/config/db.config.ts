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
                resource_id VARCHAR(255) NOT NULL,
                resource_type VARCHAR(50) NOT NULL,
                action_type VARCHAR(50) NOT NULL,
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

            -- Migration for existing usage table logic
            DO $$ 
            BEGIN 
                -- Handle existing columns if we are migrating
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usage' AND column_name='agent_id') THEN
                    -- Add new columns if missing
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usage' AND column_name='resource_id') THEN
                        ALTER TABLE usage ADD COLUMN resource_id VARCHAR(255);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usage' AND column_name='resource_type') THEN
                        ALTER TABLE usage ADD COLUMN resource_type VARCHAR(50);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usage' AND column_name='action_type') THEN
                        ALTER TABLE usage ADD COLUMN action_type VARCHAR(50);
                    END IF;

                    -- Data migration
                    UPDATE usage 
                    SET 
                        resource_id = COALESCE(resource_id, agent_id),
                        resource_type = COALESCE(resource_type, 'agent'),
                        action_type = COALESCE(action_type, 'execution')
                    WHERE agent_id IS NOT NULL;

                    -- Constraints
                    ALTER TABLE usage ALTER COLUMN resource_id SET NOT NULL;
                    ALTER TABLE usage ALTER COLUMN resource_type SET NOT NULL;
                    ALTER TABLE usage ALTER COLUMN action_type SET NOT NULL;

                    -- Cleanup
                    ALTER TABLE usage DROP COLUMN agent_id;
                END IF;
            END $$;

            CREATE INDEX IF NOT EXISTS idx_usage_resource_id ON usage(resource_id);
            CREATE INDEX IF NOT EXISTS idx_usage_resource_type ON usage(resource_type);
            CREATE INDEX IF NOT EXISTS idx_usage_action_type ON usage(action_type);
            CREATE INDEX IF NOT EXISTS idx_usage_api_key ON usage(api_key);
            CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage(user_id);
            CREATE INDEX IF NOT EXISTS idx_usage_execution_id ON usage(execution_id);
            CREATE INDEX IF NOT EXISTS idx_usage_created_at ON usage(created_at);

            -- Navigation Table
            CREATE TABLE IF NOT EXISTS navigation (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                url VARCHAR(255) UNIQUE NOT NULL,
                page_name VARCHAR(255) NOT NULL,
                page_description TEXT,
                page_tab_title VARCHAR(255),
                icon VARCHAR(255),
                category VARCHAR(255),
                is_public BOOLEAN DEFAULT FALSE,
                is_sidebar_item BOOLEAN DEFAULT TRUE,
                role VARCHAR(255),
                display_order INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            -- Seed Navigation Data
            INSERT INTO navigation (url, page_name, page_description, page_tab_title, icon, category, is_public, is_sidebar_item, display_order, role)
            VALUES 
                ('/', 'Home', 'Welcome to Antigravity', 'Home | Antigravity', 'Home09Icon', '', true, true, 0, NULL),
                ('/about', 'About Us', 'Learn more about Antigravity', 'About Us | Antigravity', 'InformationCircleIcon', '', true, false, 1, NULL),
                ('/pricing', 'Pricing', 'View our pricing plans', 'Pricing | Antigravity', 'Wallet03Icon', 'Developers', true, true, 32, NULL),
                ('/agents', 'Agents', 'Manage your AI agents', 'Agents | Antigravity', 'AiScanIcon', 'Playground', false, true, 10, NULL),
                ('/agent-create', 'Create Agent', 'Build a new AI agent', 'Create Agent | Antigravity', 'Add01Icon', 'Playground', false, true, 11, NULL),
                ('/mcp', 'MCP', 'Manage Model Context Protocol servers', 'MCP | Antigravity', 'McpServerFreeIcons', 'Capabilities', false, true, 20, NULL),
                ('/tools', 'Tools', 'Configure external tools', 'Tools | Antigravity', 'ToolsIcon', 'Capabilities', false, true, 21, NULL),
                ('/knowledge-base', 'Knowledge Base', 'Manage RAG knowledge bases', 'Knowledge Base | Antigravity', 'BrainIcon', 'Capabilities', false, true, 22, NULL),
                ('/knowledge-graph', 'Knowledge Graph', 'Visualize knowledge graphs', 'Knowledge Graph | Antigravity', 'AiNetworkIcon', 'Capabilities', false, true, 23, NULL),
                ('/api-keys-management', 'API Keys', 'Manage access tokens', 'API Keys | Antigravity', 'KeyIcon', 'Developers', false, true, 30, NULL),
                ('/usage', 'Usage', 'Monitor usage and costs', 'Usage | Antigravity', 'PieChartIcon', 'Developers', false, true, 31, NULL),
                ('/billing', 'Billing', 'Manage billing information', 'Billing | Antigravity', 'Invoice01Icon', 'Developers', false, true, 33, NULL),
                ('/profile', 'Profile', 'Manage your user profile', 'Profile | Antigravity', 'UserIcon', 'General', false, false, 40, NULL),
                ('/design-system', 'Design System', 'UI Components', 'Design System | Antigravity', 'BrandfetchIcon', 'Platform Admin', false, true, 50, 'platform-admin'),
                ('/users', 'Users', 'Manage platform users', 'Users | Antigravity', 'UserIcon', 'Platform Admin', false, true, 51, 'platform-admin'),
                ('/platform-features', 'Platform Features', 'Configure platform features', 'Platform Features | Antigravity', 'Settings01Icon', 'Platform Admin', false, true, 52, 'platform-admin'),
                ('/platform-roles', 'Platform Roles', 'Manage roles and permissions', 'Platform Roles | Antigravity', 'AiNetworkIcon', 'Platform Admin', false, true, 53, 'platform-admin'),
                ('/platform-prompts', 'System Prompts', 'Manage system templates', 'System Prompts | Antigravity', 'File01Icon', 'Platform Admin', false, true, 54, 'platform-admin')
            ON CONFLICT (url) DO UPDATE SET
                page_name = EXCLUDED.page_name,
                page_description = EXCLUDED.page_description,
                page_tab_title = EXCLUDED.page_tab_title,
                icon = EXCLUDED.icon,
                category = EXCLUDED.category,
                is_public = EXCLUDED.is_public,
                is_sidebar_item = EXCLUDED.is_sidebar_item,
                display_order = EXCLUDED.display_order,
                role = EXCLUDED.role,
                updated_at = CURRENT_TIMESTAMP;

            -- Pricing Plans Table
            CREATE TABLE IF NOT EXISTS pricing_plans (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                category VARCHAR(255) UNIQUE NOT NULL,
                title VARCHAR(255) NOT NULL,
                button_text VARCHAR(255) NOT NULL,
                button_variant VARCHAR(50) DEFAULT 'default',
                display_order INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            -- Pricing Features Table
            CREATE TABLE IF NOT EXISTS pricing_features (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                plan_id UUID REFERENCES pricing_plans(id) ON DELETE CASCADE,
                text VARCHAR(255) NOT NULL,
                subtext VARCHAR(255),
                display_order INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            -- FAQs Table
            CREATE TABLE IF NOT EXISTS faqs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                question TEXT UNIQUE NOT NULL,
                answer TEXT NOT NULL,
                display_order INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            -- Seed Pricing Plans
            INSERT INTO pricing_plans (category, title, button_text, button_variant, display_order)
            VALUES 
                ('Starter', 'Pay as you go', 'Get Started', 'outline', 0),
                ('Pro', '$49 / month', 'Upgrade to Pro', 'default', 1),
                ('Business', '$200 / month', 'Upgrade to Business', 'default', 2)
            ON CONFLICT (category) DO UPDATE SET
                title = EXCLUDED.title,
                button_text = EXCLUDED.button_text,
                button_variant = EXCLUDED.button_variant,
                display_order = EXCLUDED.display_order,
                updated_at = CURRENT_TIMESTAMP;

            -- Seed Pricing Features
            DELETE FROM pricing_features; -- Clean sync for features
            INSERT INTO pricing_features (plan_id, text, subtext, display_order)
            SELECT id, 'No Bonus Credits', 'Standard rate applies', 0 FROM pricing_plans WHERE category = 'Starter' UNION ALL
            SELECT id, 'Full API Access', 'Access to all models', 1 FROM pricing_plans WHERE category = 'Starter' UNION ALL
            SELECT id, 'Community Support', '24/7 access to docs', 2 FROM pricing_plans WHERE category = 'Starter' UNION ALL
            SELECT id, '5000 Bonus Credits', 'Monthly recurring', 0 FROM pricing_plans WHERE category = 'Pro' UNION ALL
            SELECT id, 'Priority API Access', 'Higher rate limits', 1 FROM pricing_plans WHERE category = 'Pro' UNION ALL
            SELECT id, 'Premium Support', 'Direct email support', 2 FROM pricing_plans WHERE category = 'Pro' UNION ALL
            SELECT id, '25000 Bonus Credits', 'Monthly recurring', 0 FROM pricing_plans WHERE category = 'Business' UNION ALL
            SELECT id, 'Priority API Access', 'Higher rate limits', 1 FROM pricing_plans WHERE category = 'Business' UNION ALL
            SELECT id, 'Premium Support', 'Direct email support', 2 FROM pricing_plans WHERE category = 'Business' UNION ALL
            SELECT id, 'Advanced Analytics', 'Real-time usage tracking', 3 FROM pricing_plans WHERE category = 'Business';

            -- Seed FAQs
            INSERT INTO faqs (question, answer, display_order)
            VALUES
                ('What are bonus credits?', 'Bonus credits are additional usage units included in your subscription that can be used for LLM calls.', 0),
                ('Do credits expire?', 'No, any credits you purchase or receive as part of a plan do not expire as long as your account is active.', 1),
                ('Can I upgrade my plan?', 'Yes, you can upgrade or downgrade your plan at any time from your dashboard.', 2)
            ON CONFLICT (question) DO UPDATE SET
                answer = EXCLUDED.answer,
                display_order = EXCLUDED.display_order,
                updated_at = CURRENT_TIMESTAMP;
        `);
        logger.info('Platform database initialized successfully');
    } catch (error) {
        logger.error({ error }, 'Failed to initialize platform database');
        throw error;
    }
};
