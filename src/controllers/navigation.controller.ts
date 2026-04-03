import { Request, Response } from 'express';
import { pool } from '../config/db.config';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

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
            const authReq = req as AuthenticatedRequest;
            const isAuthenticated = !!authReq.user;
            const userRoles = authReq.user?.roles || [];

            // Fetch navigation items from DB
            let query = 'SELECT * FROM navigation ';
            if (!isAuthenticated) {
                // If not authenticated, only show public items
                query += 'WHERE is_public = true ';
            }
            query += 'ORDER BY display_order ASC';

            const result = await pool.query(query);
            const allItems: NavigationItem[] = result.rows;

            // Filter items based on user roles
            const items = allItems.filter(item => {
                // Public items are always visible
                if (item.is_public) return true;
                
                // If the item is not public, user must be authenticated
                if (!isAuthenticated) return false;
                
                // If authenticated and the item has no specific role requirement, show it
                if (!item.role) return true;
                
                // If there's a specific role requirement, ensure the user has it
                return userRoles.includes(item.role);
            });

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
                    tab_title: i.page_tab_title,
                    role: i.role
                }))
            });
        } catch (error) {
            console.error('Error fetching navigation:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
