import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const ENV = {
    PORT: process.env.PORT || 3006,
    NODE_ENV: process.env.NODE_ENV || 'development',
    DB: {
        HOST: process.env.DB_HOST || 'localhost',
        PORT: Number(process.env.DB_PORT) || 5432,
        USER: process.env.DB_USER || 'postgres',
        PASSWORD: process.env.DB_PASSWORD || 'postgres',
        NAME: process.env.DB_NAME || 'neura-agents-platform',
    },
    LOG: {
        LEVEL: process.env.LOG_LEVEL || 'info',
    },
    STORAGE_SERVICE_URL: process.env.STORAGE_SERVICE_URL || 'http://localhost:3005',
    KEYCLOAK: {
        ISSUER_URL: process.env.KEYCLOAK_ISSUER_URL || 'http://keycloak:8080/realms/neura-agents',
        PUBLIC_ISSUER_URL: process.env.KEYCLOAK_PUBLIC_ISSUER_URL || 'http://localhost:8081/realms/neura-agents',
        REALM: process.env.VITE_KEYCLOAK_REALM || 'neura-agents'
    }
};
