import { z } from 'zod';
const httpsUrl = z
  .string()
  .url()
  .refine(value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch {
      return false;
    }
  }, 'Only approved HTTPS document links are supported.');
const section = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  paragraphs: z.array(z.string().trim().min(1)),
  reviewNote: z.string().optional(),
  links: z
    .array(z.object({ label: z.string().min(1), url: httpsUrl }))
    .optional(),
});
export const legalSectionsSchema = z
  .array(section)
  .min(1)
  .refine(
    items => new Set(items.map(item => item.id)).size === items.length,
    'Section IDs must be unique.',
  );
