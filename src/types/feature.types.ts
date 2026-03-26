export interface TargetingRules {
    users?: string[];
    roles?: string[];
    percentage?: number; // 0-100
}

export interface FeatureFlag {
    id: string;
    key: string;
    name: string;
    description: string;
    enabled: boolean;
    targeting_rules: TargetingRules;
    created_at: Date;
    updated_at: Date;
}
