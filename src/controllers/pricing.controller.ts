import { Request, Response } from 'express';
import { pool } from '../config/db.config';

export const getPricingPlans = async (req: Request, res: Response) => {
    try {
        // Fetch plans with features
        const plansResult = await pool.query(`
            SELECT 
                p.*,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'text', f.text,
                            'subtext', f.subtext
                        ) ORDER BY f.display_order
                    ) FILTER (WHERE f.id IS NOT NULL),
                    '[]'
                ) as features
            FROM pricing_plans p
            LEFT JOIN pricing_features f ON p.id = f.plan_id
            GROUP BY p.id
            ORDER BY p.display_order ASC
        `);

        // Fetch FAQs
        const faqsResult = await pool.query(`
            SELECT question, answer 
            FROM faqs 
            ORDER BY display_order ASC
        `);

        res.json({ 
            status: 'success', 
            data: {
                plans: plansResult.rows.map(row => ({
                    category: row.category,
                    title: row.title,
                    buttonText: row.button_text,
                    buttonVariant: row.button_variant,
                    features: row.features
                })),
                faqs: faqsResult.rows
            }
        });
    } catch (error) {
        console.error('Error fetching pricing data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
