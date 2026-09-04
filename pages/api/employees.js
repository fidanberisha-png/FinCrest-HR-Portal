import { prisma } from '../../lib/prisma';
import { getCurrentUser } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
        }

          try {
              const user = await getCurrentUser(req);
                  if (!user) {
                        return res.status(401).json({ error: 'Not authenticated' });
                            }

                                // Fetch all active employees sorted by first name
                                    const employees = await prisma.user.findMany({
                                          where: {
                                                  active: true,
                                                          role: 'EMPLOYEE', // Only show regular employees
                                                                },
                                                                      select: {
                                                                              id: true,
                                                                                      name: true,
                                                                                              email: true,
                                                                                                      department: true,
                                                                                                              position: true,
                                                                                                                      allowance: true,
                                                                                                                              startDate: true,
                                                                                                                                      createdAt: true,
                                                                                                                                            },
                                                                                                                                                  orderBy: {
                                                                                                                                                          name: 'asc',
                                                                                                                                                                },
                                                                                                                                                                    });
                                                                                                                                                                    
                                                                                                                                                                        return res.status(200).json({
                                                                                                                                                                              employees,
                                                                                                                                                                                    count: employees.length,
                                                                                                                                                                                        });
                                                                                                                                                                                          } catch (error) {
                                                                                                                                                                                              console.error('[employees.js]', error);
                                                                                                                                                                                                  return res.status(500).json({ error: 'Internal server error' });
                                                                                                                                                                                                    }
                                                                                                                                                                                                    }
