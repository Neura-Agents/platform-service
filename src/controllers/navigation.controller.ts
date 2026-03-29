import { Request, Response } from 'express';
import { pool } from '../config/db.config';
import jwt from 'jsonwebtoken';

interface NavigationItem {
    id: string;
    url: string;
    page_name: string;
    page_description: string;
    page_tab_title: string;
    icon: string;
    category: string;
    is_public: boolean;
    is_sidebar_item: boolean;
    role: string | null;
    display_order: number;
}

export class NavigationController {
    static async getNavigation(req: Request, res: Response) {
        try {
            // Check for optional Auth token to determine visibility
            let isAuthenticated = false;
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                try {
                    const decoded = jwt.decode(token);
                    if (decoded) {
                        isAuthenticated = true;
                    }
                } catch (e) {
                    // Invalid token, treat as guest
                }
            }

            // Fetch navigation items
            let query = 'SELECT * FROM navigation ';
            if (!isAuthenticated) {
                query += 'WHERE is_public = true ';
            }
            query += 'ORDER BY display_order ASC';

            const result = await pool.query(query);
            const items: NavigationItem[] = result.rows;

            // Group into sidebar structure
            const sidebarGroups: any[] = [];
            const categories = [...new Set(items.map((i: NavigationItem) => i.category))];

            categories.forEach(cat => {
                const groupItems = items.filter((i: NavigationItem) => i.category === cat && i.is_sidebar_item);
                if (groupItems.length > 0) {
                    sidebarGroups.push({
                        label: cat || "",
                        collapsible: cat !== "",
                        items: groupItems.map((i: NavigationItem) => ({
                            title: i.page_name,
                            url: i.url,
                            icon: i.icon,
                            role: i.role
                        }))
                    });
                }
            });

            res.json({
                sidebar: sidebarGroups,
                all_urls: items.map((i: NavigationItem) => ({
                    url: i.url,
                    name: i.page_name,
                    description: i.page_description,
                    tab_title: i.page_tab_title
                }))
            });
        } catch (error) {
            console.error('Error fetching navigation:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
