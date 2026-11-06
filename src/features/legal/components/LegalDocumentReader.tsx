import React, { useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { SafeScreen } from '../../../components/layout/SafeScreen';
import { AppText } from '../../../components/ui/AppText';
import { AppButton } from '../../../components/ui/AppButton';
import { colors } from '../../../theme';
import { z } from 'zod';
import { legalSectionsSchema } from '../services/legalDocumentSchema';
export interface LegalDocument {
  status: 'draft' | 'approved';
  version: string;
  sections: z.infer<typeof legalSectionsSchema>;
  lastUpdated?: string;
  effectiveDate?: string;
}
function readDocument(loadDocument: () => LegalDocument): {
  document: LegalDocument | null;
} {
  try {
    return { document: loadDocument() };
  } catch {
    return { document: null };
  }
}
export function LegalDocumentReader({
  title,
  loadDocument,
  onBack,
  retryLabel,
  draftNotice,
  draftDetail,
  showContents = false,
  relatedDocument,
  relatedDocuments = [],
  introduction,
}: {
  title: string;
  loadDocument: () => LegalDocument;
  onBack: () => void;
  retryLabel: string;
  draftNotice: string;
  draftDetail?: string;
  showContents?: boolean;
  relatedDocument?: { label: string; onPress: () => void };
  relatedDocuments?: { label: string; onPress: () => void }[];
  introduction?: { title: string; text: string; icon: React.ReactNode };
}) {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const sectionOffsets = useRef<Record<string, number>>({});
  const focused = useIsFocused();
  const [state, setState] = useState(() => readDocument(loadDocument));
  const [linkError, setLinkError] = useState(''),
    [opening, setOpening] = useState(false);
  const openingRef = useRef(false);
  const document = state.document;
  const openLink = async (url: string) => {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    setLinkError('');
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password)
        throw Error();
      await Linking.openURL(url);
    } catch {
      setLinkError('Could not open the referenced document. Please try again.');
    } finally {
      openingRef.current = false;
      setOpening(false);
    }
  };
  return (
    <SafeScreen
      edges={['top', 'bottom', 'left', 'right']}
      backgroundColor={colors.white}
    >
      {focused && <StatusBar barStyle="dark-content" />}
      <View style={styles.header}>
        <Pressable
          cssInterop={false}
          accessibilityRole="button"
          accessibilityLabel={'Back from ' + title}
          style={styles.back}
          onPress={onBack}
        >
          <ArrowLeft size={24} color={colors.navy} />
        </Pressable>
        <AppText
          accessibilityRole="header"
          color={colors.navy}
          style={styles.title}
        >
          {title}
        </AppText>
      </View>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        {introduction && (
          <View style={styles.notice}>
            <View style={styles.introIcon}>{introduction.icon}</View>
            <AppText
              accessibilityRole="header"
              color={colors.navy}
              style={styles.sectionTitle}
            >
              {introduction.title}
            </AppText>
            <AppText style={styles.paragraph}>{introduction.text}</AppText>
          </View>
        )}
        {!document ? (
          <View style={styles.feedback}>
            <AppText accessibilityRole="alert" color={colors.navy}>
              {title + ' content is unavailable.'}
            </AppText>
            <AppText>
              No legal text could be validated. Please try again later.
            </AppText>
            <AppButton
              title={retryLabel}
              onPress={() => setState(readDocument(loadDocument))}
            />
          </View>
        ) : (
          <>
            <AppText variant="caption">
              {document.status === 'approved'
                ? 'Last Updated: ' + document.lastUpdated
                : 'Last Updated: unavailable - approved document pending'}
            </AppText>
            {document.status === 'draft' && (
              <View style={styles.notice}>
                <AppText
                  accessibilityRole="header"
                  color={colors.primary}
                  style={styles.noticeTitle}
                >
                  Draft / Development Preview
                </AppText>
                <AppText style={styles.paragraph}>{draftNotice}</AppText>
                {draftDetail && (
                  <AppText style={styles.paragraph}>{draftDetail}</AppText>
                )}
              </View>
            )}
            {document.status === 'approved' && (
              <AppText variant="caption">
                Document version: {document.version}
              </AppText>
            )}
            {document.status === 'approved' && document.effectiveDate && (
              <AppText variant="caption">
                {'Effective Date: ' + document.effectiveDate}
              </AppText>
            )}
            {showContents && (
              <View style={styles.feedback}>
                <AppText
                  accessibilityRole="header"
                  color={colors.navy}
                  style={[
                    styles.sectionTitle,
                    showContents && styles.accentHeading,
                  ]}
                >
                  Contents
                </AppText>
                {document.sections.map((section, index) => (
                  <Pressable
                    cssInterop={false}
                    key={section.id}
                    accessibilityRole="button"
                    accessibilityLabel={'Go to ' + section.title}
                    style={styles.link}
                    onPress={() => {
                      const y = sectionOffsets.current[section.id];
                      if (y !== undefined)
                        scrollRef.current?.scrollTo({
                          y: Math.max(0, y - 12),
                          animated: false,
                        });
                    }}
                  >
                    <AppText color={colors.primary} style={styles.linkText}>
                      {index + 1}. {section.title}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            )}
            {document.sections.map(section => (
              <View
                key={section.id}
                style={styles.section}
                onLayout={event => {
                  sectionOffsets.current[section.id] =
                    event.nativeEvent.layout.y;
                }}
              >
                <AppText
                  accessibilityRole="header"
                  color={colors.navy}
                  style={styles.sectionTitle}
                >
                  {section.title}
                </AppText>
                {section.paragraphs.length ? (
                  section.paragraphs.map((paragraph, index) => (
                    <AppText selectable key={index} style={styles.paragraph}>
                      {paragraph}
                    </AppText>
                  ))
                ) : (
                  <AppText style={styles.paragraph}>
                    Pending approved content.
                  </AppText>
                )}
                {document.status === 'draft' && section.reviewNote && (
                  <View style={styles.review}>
                    <AppText selectable style={styles.paragraph}>
                      {section.reviewNote}
                    </AppText>
                  </View>
                )}
                {section.links?.map(link => (
                  <Pressable
                    cssInterop={false}
                    key={link.url}
                    accessibilityRole="link"
                    accessibilityLabel={link.label}
                    disabled={opening}
                    accessibilityState={{ disabled: opening, busy: opening }}
                    style={styles.link}
                    onPress={() => {
                      openLink(link.url).catch(() => {});
                    }}
                  >
                    <AppText color={colors.primary} style={styles.linkText}>
                      {link.label}
                    </AppText>
                    <ArrowRight color={colors.primary} size={18} />
                  </Pressable>
                ))}
              </View>
            ))}
            {!!linkError && (
              <AppText accessibilityRole="alert" color={colors.danger}>
                {linkError}
              </AppText>
            )}
          </>
        )}
        {[
          ...(relatedDocument ? [relatedDocument] : []),
          ...relatedDocuments,
        ].map(link => (
          <Pressable
            cssInterop={false}
            key={link.label}
            accessibilityRole="link"
            accessibilityLabel={link.label}
            style={styles.link}
            onPress={link.onPress}
          >
            <AppText color={colors.primary} style={styles.linkText}>
              {link.label}
            </AppText>
            <ArrowRight size={18} color={colors.primary} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeScreen>
  );
}
const styles = StyleSheet.create({
  header: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  back: {
    position: 'absolute',
    left: 10,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: 20,
    gap: 20,
    paddingBottom: 36,
  },
  notice: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: colors.softPink,
    gap: 12,
  },
  introIcon: { minHeight: 36, justifyContent: 'center' },
  noticeTitle: { fontSize: 17, lineHeight: 25, fontWeight: '700' },
  paragraph: { fontSize: 15, lineHeight: 26, color: colors.text },
  section: {
    gap: 14,
    paddingBottom: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sectionTitle: { fontSize: 20, lineHeight: 29, fontWeight: '700' },
  accentHeading: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingLeft: 12,
  },
  review: { padding: 14, borderRadius: 12, backgroundColor: colors.offWhite },
  feedback: { gap: 16 },
  link: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
  },
  linkText: { flex: 1, lineHeight: 24 },
});
