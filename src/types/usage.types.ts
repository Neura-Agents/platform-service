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
    agent_id: string;
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
}

export interface UsageFilter {
    agent_id?: string;
    api_key?: string;
    user_id?: string;
    execution_id?: string;
    search?: string;
    start_time?: string;
    end_time?: string;
    page?: number;
    limit?: number;
}
