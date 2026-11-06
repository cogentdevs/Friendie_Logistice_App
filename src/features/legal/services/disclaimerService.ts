import { z } from 'zod';
import { disclaimerContent } from '../content/disclaimerContent';
import { legalSectionsSchema } from './legalDocumentSchema';
export const disclaimerSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('draft'),
    version: z.string().min(1),
    sections: legalSectionsSchema,
  }),
  z.object({
    status: z.literal('approved'),
    version: z.string().min(1),
    lastUpdated: z.iso.date(),
    sections: legalSectionsSchema.refine(
      items =>
        items.every(item => item.paragraphs.length > 0 && !item.reviewNote),
      'Approved sections require final copy without review notes.',
    ),
  }),
]);
export function loadDisclaimer() {
  return disclaimerSchema.parse(disclaimerContent);
}
