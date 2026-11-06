import { z } from 'zod';
import { termsConditionsContent } from '../content/termsConditionsContent';
import { legalSectionsSchema } from './legalDocumentSchema';
export const termsConditionsSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('draft'),
    version: z.string().min(1),
    sections: legalSectionsSchema,
  }),
  z.object({
    status: z.literal('approved'),
    version: z.string().min(1),
    lastUpdated: z.iso.date(),
    effectiveDate: z.iso.date(),
    sections: legalSectionsSchema.refine(
      items =>
        items.every(item => item.paragraphs.length > 0 && !item.reviewNote),
      'Approved sections require final copy without review notes.',
    ),
  }),
]);
export type TermsConditionsDocument = z.infer<typeof termsConditionsSchema>;
export function loadTermsConditions(): TermsConditionsDocument {
  return termsConditionsSchema.parse(termsConditionsContent);
}
