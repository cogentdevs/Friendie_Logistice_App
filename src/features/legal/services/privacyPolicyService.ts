import { z } from 'zod';
import { privacyPolicyContent } from '../content/privacyPolicyContent';
import { legalSectionsSchema as sections } from './legalDocumentSchema';
export const privacyPolicySchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('draft'),
    version: z.string().min(1),
    sections,
  }),
  z.object({
    status: z.literal('approved'),
    version: z.string().min(1),
    lastUpdated: z.iso.date(),
    sections: sections.refine(
      items =>
        items.every(item => item.paragraphs.length > 0 && !item.reviewNote),
      'Approved sections require final copy without review notes.',
    ),
  }),
]);
export type PrivacyPolicyDocument = z.infer<typeof privacyPolicySchema>;
export function loadPrivacyPolicy(): PrivacyPolicyDocument {
  return privacyPolicySchema.parse(privacyPolicyContent);
}
