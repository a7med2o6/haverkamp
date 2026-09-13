'use server';

import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { action } from '@/lib/action-utils';
import { db } from '@/lib/db';
import { customerIdsByPhone, vehicleIdsByPlate } from '@/lib/search-db';

export const globalSearch = action({
  permission: 'crm:read',
  schema: z.object({
    q: z
      .string()
      .trim()
      .min(2, 'اكتب حرفين على الأقل')
      .max(60, 'مصطلح البحث طويل جداً'),
  }),
  handler: async ({ q }) => {
    const [plateIds, phoneIds] = await Promise.all([
      vehicleIdsByPlate(q, 24),
      customerIdsByPhone(q, 24),
    ]);
    const vehicleMatches: Prisma.VehicleWhereInput[] = [
      { make: { contains: q, mode: 'insensitive' } },
      { model: { contains: q, mode: 'insensitive' } },
    ];

    if (plateIds.length > 0) {
      vehicleMatches.push({ id: { in: plateIds } });
    }

    const [customers, vehicles] = await Promise.all([
      db.customer.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            ...(phoneIds.length > 0 ? [{ id: { in: phoneIds } }] : []),
            { code: { contains: q, mode: 'insensitive' } },
            { civilId: { contains: q } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, name: true, phone: true, code: true },
      }),
      db.vehicle.findMany({
        where: { OR: vehicleMatches },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          plateNo: true,
          make: true,
          model: true,
          customer: { select: { id: true, name: true } },
        },
      }),
    ]);

    return { data: { customers, vehicles } };
  },
});
