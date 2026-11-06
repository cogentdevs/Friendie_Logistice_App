// Versioned editorial scaffold. This is NOT an approved or operative privacy policy.
export const privacyPolicyContent: unknown = {
  status: 'draft',
  version: 'draft-1',
  sections: [
    { id: 'collection', title: 'Information We Collect', paragraphs: [] },
    { id: 'use', title: 'How We Use Information', paragraphs: [] },
    {
      id: 'location',
      title: 'Location Information',
      paragraphs: [],
      reviewNote:
        'Implementation review: GPS radius mode uses actual device coordinates. Manual mode uses the resolved selected point, with an exact pin taking precedence; worldwide mode removes location restrictions. Whether precise coordinates are shared with other members has not been verified. An approved disclosure covering backend use, visibility and retention is required.',
    },
    { id: 'listings', title: 'Listing and Profile Data', paragraphs: [] },
    { id: 'messages', title: 'Messages and Communications', paragraphs: [] },
    { id: 'payments', title: 'Payment Information', paragraphs: [] },
    { id: 'sharing', title: 'Sharing and Disclosure', paragraphs: [] },
    { id: 'retention', title: 'Data Retention', paragraphs: [] },
    { id: 'security', title: 'Security', paragraphs: [] },
    { id: 'rights', title: 'User Rights', paragraphs: [] },
    { id: 'children', title: "Children's Privacy", paragraphs: [] },
    { id: 'transfers', title: 'International Data Transfers', paragraphs: [] },
    { id: 'changes', title: 'Policy Changes', paragraphs: [] },
    { id: 'contact', title: 'Contact Information', paragraphs: [] },
  ],
};
