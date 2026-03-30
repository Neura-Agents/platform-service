export interface LLMCall {
    request: any;
    response: any;
    tokens: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    cost: number;
    timestamp: string;
}

export interface Usage {
    id?: string;
    execution_id: string;
    resource_id: string;
    resource_type: 'agent' | 'knowledge-base' | 'knowledge-graph';
    action_type: 'execution' | 'ingestion' | 'search';
    api_key?: string;
    user_id?: string;
    total_input_tokens: number;
    total_completion_tokens: number;
    total_tokens: number;
    total_cost: number;
    initial_request?: any;
    final_response?: any;
    llm_calls?: LLMCall[];
    created_at?: Date;
    resource_name?: string;
    agent_name?: string;
    kb_name?: string;
    kg_name?: string;
    api_key_name?: string;
}

export interface UsageFilter {
    resource_id?: string;
    resource_type?: string;
    action_type?: string;
    api_key?: string;
    user_id?: string;
    execution_id?: string;
    search?: string;
    start_time?: string;
    end_time?: string;
    page?: number;
    limit?: number;
}
