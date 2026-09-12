'use server';

import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { action } from '@/lib/action-utils';
import { db } from '@/lib/db';
import { digitsOnly, normalizePlate } from '@/lib/search';

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
    const plateTerm = normalizePlate(q);
    const plateDigits = digitsOnly(q);
    const vehicleMatches: Prisma.VehicleWhereInput[] = [
      { make: { contains: q, mode: 'insensitive' } },
      { model: { contains: q, mode: 'insensitive' } },
    ];

    if (plateTerm) {
      vehicleMatches.push({ plateNo: { contains: plateTerm, mode: 'insensitive' } });
    }
    if (plateDigits && plateDigits !== plateTerm) {
      vehicleMatches.push({ plateNo: { contains: plateDigits, mode: 'insensitive' } });
    }

    const [customers, vehicles] = await Promise.all([
      db.customer.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
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
