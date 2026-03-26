# Platform Service

The **Platform Service** is responsible for managing system-level configurations, feature toggles, and UI-specific settings for the AgenticAI platform. It ensures a consistent experience across different user segments and enables dynamic control over platform capabilities.

---

## 🚀 Key Features

- **Feature Toggle Management**: Dynamically enable or disable platform features for specific users or roles.
- **UI Configuration**: Centralized storage and retrieval of UI-bound settings and theme preferences.
- **Rollout Control**: Manage feature releases with targeting rules and status monitoring.
- **Role-Based Access**: Specialized APIs for managing system roles and their permissions relative to platform features.

---

## 🛠 Technology Stack

- **Framework**: Express.js
- **Database**: PostgreSQL
- **Language**: TypeScript
- **Logging**: Pino

---

## 📥 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL instance

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables by copying `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

### Development

Run the service in development mode:
```bash
npm run dev
```

### Production

1. Build the service:
   ```bash
   npm run build
   ```

2. Start the service:
   ```bash
   npm start
   ```

---

## 🏗 Architecture

- **`src/index.ts`**: Entry point for the Express server.
- **`src/config/`**: Database and environment configuration.
- **`src/controllers/`**: API request handlers for feature and UI management.
- **`src/services/`**: Core business logic for feature evaluation and rollout strategy.
- **`src/routes/`**: Endpoint definitions for external and internal access.
- **`src/middlewares/`**: Authentication and validation logic.
- **`src/types/`**: Shared TypeScript definitions.
