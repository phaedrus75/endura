/**
 * FeedbackModal — inbox (signed-in), thread detail, and compose flows.
 *
 * Signed-in users see an Intercom-style inbox of their past submissions plus
 * admin replies (`GET /me/feedback`). Anonymous / optional-auth users still
 * get the friction-free compose form only.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as ImagePicker from 'expo-image-picker';
import { Text, TextInput } from './StyledText';
import { feedbackAPI, FeedbackType, type FeedbackInboxItem, type FeedbackThreadPayload } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ensurePermission } from '../utils/permissions';
import FeedbackInbox from './FeedbackInbox';
import FeedbackThread from './FeedbackThread';

const MAX_ATTACHMENTS = 4;

type Attachment = {
  /** Stable client-side id so React can track entries while uploading. */
  id: string;
  /** Local file URI shown in the preview. */
  localUri: string;
  /** Server URL once upload completes. */
  remoteUrl?: string;
  /** True while the upload is in flight. */
  uploading: boolean;
  /** Error message if upload failed; user can retry by removing & re-adding. */
  error?: string;
};

const TYPES: { id: FeedbackType; label: string; emoji: string; placeholder: string }[] = [
  { id: 'bug', label: 'Bug', emoji: '🐛', placeholder: "What's broken? Steps to reproduce help us fix it faster." },
  { id: 'feature', label: 'Idea', emoji: '💡', placeholder: 'What would make Endura better for you?' },
  { id: 'question', label: 'Question', emoji: '❓', placeholder: 'Ask us anything — we read everything.' },
  { id: 'praise', label: 'Love', emoji: '🩷', placeholder: 'Tell us what you love so we keep doing more of it.' },
];

type FeedbackView = 'inbox' | 'thread' | 'compose';

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  /** Where in the app the user opened the modal — used for triage. */
  screenContext?: string;
  /** When set (e.g. from a push notification route param), open this thread. */
  initialThreadId?: number | null;
}

export default function FeedbackModal({ visible, onClose, screenContext, initialThreadId }: FeedbackModalProps) {
  const { user } = useAuth();
  const [view, setView] = useState<FeedbackView>('compose');
  const [inboxItems, setInboxItems] = useState<FeedbackInboxItem[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [threadData, setThreadData] = useState<FeedbackThreadPayload | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [composeFromInbox, setComposeFromInbox] = useState(false);
  const [inboxLoadError, setInboxLoadError] = useState<string | null>(null);

  const [type, setType] = useState<FeedbackType>('bug');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const reloadInbox = useCallback(async () => {
    try {
      const { items } = await feedbackAPI.list();
      setInboxItems(items);
      setInboxLoadError(null);
    } catch (e: any) {
      setInboxItems([]);
      setInboxLoadError(e?.message || 'Could not load messages');
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      setView('compose');
      setInboxItems([]);
      setInboxLoading(false);
      setThreadData(null);
      setThreadLoading(false);
      setComposeFromInbox(false);
      setInboxLoadError(null);
      return;
    }

    setType('bug');
    setTitle('');
    setMessage('');
    setEmail(user?.email || '');
    setAttachments([]);
    setSubmitting(false);

    if (!user) {
      setView('compose');
      return;
    }

    if (initialThreadId != null && initialThreadId > 0) {
      setView('thread');
      setThreadLoading(true);
      void (async () => {
        try {
          const d = await feedbackAPI.thread(initialThreadId);
          setThreadData(d);
          await feedbackAPI.markRead(initialThreadId);
        } catch {
          setThreadData(null);
          Alert.alert('Could not load', 'This conversation may have been removed.');
          setView('compose');
        } finally {
          setThreadLoading(false);
        }
      })();
      void reloadInbox();
      return;
    }

    setInboxLoading(true);
    void (async () => {
      try {
        const { items } = await feedbackAPI.list();
        setInboxItems(items);
        setInboxLoadError(null);
        setView(items.length ? 'inbox' : 'compose');
      } catch (e: any) {
        setInboxItems([]);
        setInboxLoadError(e?.message || 'Could not load messages');
        setView('inbox');
      } finally {
        setInboxLoading(false);
      }
    })();
  }, [visible, user?.id, user?.email, initialThreadId]);

  const retryInboxLoad = useCallback(() => {
    if (!user) return;
    setInboxLoadError(null);
    setInboxLoading(true);
    void (async () => {
      try {
        const { items } = await feedbackAPI.list();
        setInboxItems(items);
        setInboxLoadError(null);
        setView(items.length ? 'inbox' : 'compose');
      } catch (e: any) {
        setInboxItems([]);
        setInboxLoadError(e?.message || 'Could not load messages');
        setView('inbox');
      } finally {
        setInboxLoading(false);
      }
    })();
  }, [user]);

  const updateAttachment = (id: string, patch: Partial<Attachment>) => {
    setAttachments(prev => prev.map(a => (a.id === id ? { ...a, ...patch } : a)));
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const uploadAttachment = async (id: string, uri: string) => {
    try {
      const { url } = await feedbackAPI.uploadAttachment(uri);
      updateAttachment(id, { uploading: false, remoteUrl: url, error: undefined });
    } catch (e: any) {
      updateAttachment(id, { uploading: false, error: e?.message || 'Upload failed' });
    }
  };

  const pickImages = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert('Limit reached', `You can attach up to ${MAX_ATTACHMENTS} images.`);
      return;
    }
    if (!(await ensurePermission('media'))) return;
    const remaining = MAX_ATTACHMENTS - attachments.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.7,
      // No `allowsEditing` so multi-select works on iOS.
    });
    if (result.canceled || !result.assets?.length) return;

    const newOnes: Attachment[] = result.assets.slice(0, remaining).map(asset => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      localUri: asset.uri,
      uploading: true,
    }));
    setAttachments(prev => [...prev, ...newOnes]);
    newOnes.forEach(a => { void uploadAttachment(a.id, a.localUri); });
  };

  const metadata = useMemo(() => {
    // Prefer the version from app.json (`expo.version`) because:
    //   1. In Expo Go, `Application.nativeApplicationVersion` returns
    //      Expo Go's own version (e.g. "54.0.6"), not our app — see the
    //      misleading "App 54.0.6" we shipped in the first cut.
    //   2. In standalone production builds, `Constants.expoConfig.version`
    //      and `nativeApplicationVersion` are both populated from the same
    //      `expo.version` field, so they agree.
    const appVersion =
      Constants.expoConfig?.version ||
      Application.nativeApplicationVersion ||
      undefined;
    return {
      app_version: appVersion,
      os: `${Platform.OS} ${Platform.Version}`.slice(0, 40),
      device_model: (Device.modelName || Device.deviceName || undefined)?.slice(0, 80),
      screen_context: screenContext?.slice(0, 120),
    };
  }, [screenContext]);

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (trimmed.length < 1) {
      Alert.alert('One more thing', 'Please write a short message before sending.');
      return;
    }
    if (attachments.some(a => a.uploading)) {
      Alert.alert('Hang on', 'Your images are still uploading — try again in a moment.');
      return;
    }
    const failed = attachments.filter(a => a.error);
    if (failed.length) {
      Alert.alert(
        'Some images failed to upload',
        'Remove them and try again, or send the feedback without those attachments.'
      );
      return;
    }
    const attachment_urls = attachments
      .map(a => a.remoteUrl)
      .filter((u): u is string => !!u);

    setSubmitting(true);
    try {
      await feedbackAPI.submit({
        feedback_type: type,
        message: trimmed,
        title: title.trim() || undefined,
        email: email.trim() || undefined,
        attachment_urls: attachment_urls.length ? attachment_urls : undefined,
        ...metadata,
      });
      onClose();
      Alert.alert(
        'Thank you!',
        user
          ? "We've received your feedback. When the team replies, you'll see it here under Messages (💬) and get a notification."
          : "We've received your feedback and will take a look. Replies (when needed) come from team@endura.eco."
      );
    } catch (e: any) {
      Alert.alert(
        "Couldn't send",
        e?.message || 'Please try again in a moment. Your feedback matters.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const activeType = TYPES.find(t => t.id === type) ?? TYPES[0];

  const headerTitle =
    !user ? 'Send feedback' : view === 'inbox' ? 'Messages' : view === 'thread' ? 'Reply' : 'Send feedback';

  const showHeaderBack =
    !!user && (view === 'thread' || (view === 'compose' && composeFromInbox));

  const handleHeaderBack = () => {
    if (view === 'thread') {
      setThreadData(null);
      setView(inboxItems.length ? 'inbox' : 'compose');
      return;
    }
    if (view === 'compose' && composeFromInbox) {
      setComposeFromInbox(false);
      setView('inbox');
    }
  };

  const openThread = (id: number) => {
    setView('thread');
    setThreadLoading(true);
    void (async () => {
      try {
        const d = await feedbackAPI.thread(id);
        setThreadData(d);
        await feedbackAPI.markRead(id);
        void reloadInbox();
      } catch {
        Alert.alert('Could not load', 'Please try again.');
        setView('inbox');
      } finally {
        setThreadLoading(false);
      }
    })();
  };

  const goToComposeFromInbox = () => {
    setComposeFromInbox(true);
    setView('compose');
  };

  const renderCompose = () => (
    <>
            <Text style={styles.subtle}>
              We read every message. Your input shapes the next build.
            </Text>

            <Text style={styles.fieldLabel}>What's this about?</Text>
            <View style={styles.typeRow}>
              {TYPES.map(t => {
                const selected = t.id === type;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.typeChip, selected && styles.typeChipActive]}
                    onPress={() => setType(t.id)}
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${t.label}: ${t.emoji}`}
                  >
                    <Text style={styles.typeEmoji}>{t.emoji}</Text>
                    <Text
                      style={[styles.typeLabel, selected && styles.typeLabelActive]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Title (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="One-line summary"
              placeholderTextColor="#A4B0AA"
              value={title}
              onChangeText={setTitle}
              maxLength={200}
              returnKeyType="next"
            />

            <Text style={styles.fieldLabel}>Message</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={activeType.placeholder}
              placeholderTextColor="#A4B0AA"
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={5000}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{message.length}/5000</Text>

            <Text style={styles.fieldLabel}>
              Attachments {attachments.length > 0 ? `(${attachments.length}/${MAX_ATTACHMENTS})` : '(optional)'}
            </Text>
            <View style={styles.attachRow}>
              {attachments.map(a => (
                <View key={a.id} style={styles.thumbWrap}>
                  <Image source={{ uri: a.localUri }} style={styles.thumb} />
                  {a.uploading && (
                    <View style={styles.thumbOverlay}>
                      <ActivityIndicator color="#fff" />
                    </View>
                  )}
                  {!!a.error && (
                    <View style={[styles.thumbOverlay, styles.thumbErrorOverlay]}>
                      <Text style={styles.thumbErrorText}>Failed</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.thumbRemove}
                    onPress={() => removeAttachment(a.id)}
                    accessibilityLabel="Remove attachment"
                  >
                    <Text style={styles.thumbRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {attachments.length < MAX_ATTACHMENTS && (
                <TouchableOpacity
                  style={styles.addThumb}
                  onPress={pickImages}
                  accessibilityLabel="Add image"
                >
                  <Text style={styles.addThumbPlus}>＋</Text>
                  <Text style={styles.addThumbLabel}>Add image</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.attachHint}>
              Screenshots help us reproduce bugs faster. Images stay private.
            </Text>

            <Text style={styles.fieldLabel}>Your email (so we can reply)</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#A4B0AA"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={120}
            />

            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>Auto-attached for triage</Text>
              <Text style={styles.metaText}>App {metadata.app_version || 'dev'}</Text>
              <Text style={styles.metaText}>{metadata.os}</Text>
              {metadata.device_model && (
                <Text style={styles.metaText}>{metadata.device_model}</Text>
              )}
              {metadata.screen_context && (
                <Text style={styles.metaText}>From: {metadata.screen_context}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.submit, submitting && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Send feedback</Text>
              )}
            </TouchableOpacity>
    </>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              {showHeaderBack ? (
                <TouchableOpacity onPress={handleHeaderBack} style={styles.headerBackBtn} accessibilityLabel="Back">
                  <Text style={styles.headerBackText}>‹</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.headerBackPlaceholder} />
              )}
              <Text style={styles.headerTitle} numberOfLines={1}>
                {headerTitle}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {!user || view === 'compose' ? (
              renderCompose()
            ) : view === 'inbox' ? (
              <FeedbackInbox
                items={inboxItems}
                loading={inboxLoading}
                onSelect={openThread}
                onCompose={goToComposeFromInbox}
                loadError={inboxLoadError}
                onRetry={retryInboxLoad}
              />
            ) : (
              <FeedbackThread data={threadData} loading={threadLoading} />
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 35, 30, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: '92%',
  },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D7DFD9',
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    marginRight: 8,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  headerBackText: {
    fontSize: 28,
    fontWeight: '300',
    color: '#5E7F6E',
    marginTop: -2,
  },
  headerBackPlaceholder: {
    width: 36,
    marginRight: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#2D3B36',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EEF3EF',
  },
  closeText: {
    fontSize: 16,
    color: '#5A6B65',
    fontWeight: '600',
  },
  subtle: {
    fontSize: 13,
    color: '#7C8A84',
    marginBottom: 16,
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5A6B65',
    marginTop: 14,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
  },
  typeChip: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 2,
    minWidth: 0,
    borderRadius: 14,
    backgroundColor: '#F2F6F3',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeChipActive: {
    backgroundColor: '#E1F0E5',
    borderColor: '#6B9B9B',
  },
  typeEmoji: {
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
    includeFontPadding: false,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5A6B65',
    textAlign: 'center',
    width: '100%',
  },
  typeLabelActive: {
    color: '#2D3B36',
  },
  input: {
    backgroundColor: '#F5F8F5',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#2D3B36',
    borderWidth: 1,
    borderColor: '#E2EAE5',
  },
  textArea: {
    height: 140,
    paddingTop: 12,
  },
  charCount: {
    alignSelf: 'flex-end',
    fontSize: 11,
    color: '#A4B0AA',
    marginTop: 4,
  },
  attachRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  thumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'visible',
    position: 'relative',
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#EEF3EF',
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    backgroundColor: 'rgba(45,59,54,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbErrorOverlay: {
    backgroundColor: 'rgba(190,55,55,0.85)',
  },
  thumbErrorText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2D3B36',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  thumbRemoveText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  addThumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#F2F6F3',
    borderWidth: 1,
    borderColor: '#C9D6CC',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addThumbPlus: {
    fontSize: 22,
    color: '#5A6B65',
    lineHeight: 24,
  },
  addThumbLabel: {
    fontSize: 10,
    color: '#7C8A84',
    marginTop: 2,
  },
  attachHint: {
    fontSize: 11,
    color: '#A4B0AA',
    marginTop: 8,
  },
  metaCard: {
    marginTop: 18,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F2F6F3',
    borderWidth: 1,
    borderColor: '#E2EAE5',
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C8A84',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#5A6B65',
    lineHeight: 18,
  },
  submit: {
    marginTop: 20,
    backgroundColor: '#5E7F6E',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
