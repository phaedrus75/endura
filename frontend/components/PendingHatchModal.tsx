/**
 * PendingHatchModal — "hatch on next launch" recovery flow.
 *
 * Surfaced when the server returns a non-empty list from
 * GET /me/pending-hatches: the reaper auto-completed one or more of the
 * user's sessions (so coins/streak are credited) but no animal hatched
 * because the reaper has no idea what the user picked.
 *
 * UX goal: convert that lost-celebration moment into the egg-hatch
 * payoff the user did the work for. Stripped-down on purpose — just
 * pick an animal and tap. Every pixel that doesn't earn its place
 * delays the dopamine hit, so we deliberately skip the Lottie egg /
 * cracking sequence and go straight to the reveal.
 *
 * Day-1 SQL (May 4–6 post-build-33) showed ~32% of new-user sessions
 * landing in the auto_completed bucket without a hatch. This modal is
 * the activation lever for that cohort.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, shadows } from '../theme/colors';
import { sessionsAPI, PendingHatchEntry } from '../services/api';
import { getAnimalImage } from '../assets/animals';

// Subset of the full animal list — keep the picker scannable and let the
// user choose from "core" species first. Order mirrors the unlock order
// in TimerScreen / ENDANGERED_ANIMALS so the visual identity is consistent.
const PICKABLE_ANIMALS: { name: string; emoji: string }[] = [
  { name: 'Sunda Island Tiger', emoji: '🐅' },
  { name: 'Javan Rhino', emoji: '🦏' },
  { name: 'Amur Leopard', emoji: '🐆' },
  { name: 'Mountain Gorilla', emoji: '🦍' },
  { name: 'Tapanuli Orangutan', emoji: '🦧' },
  { name: 'Polar Bear', emoji: '🐻‍❄️' },
  { name: 'African Forest Elephant', emoji: '🐘' },
  { name: 'Hawksbill Turtle', emoji: '🐢' },
  { name: 'Axolotl', emoji: '🦎' },
  { name: 'Red Panda', emoji: '🐼' },
  { name: 'Panda', emoji: '🐼' },
  { name: 'Koala', emoji: '🐨' },
  { name: 'Otter', emoji: '🦦' },
  { name: 'Blue Whale', emoji: '🐋' },
  { name: 'Monarch Butterfly', emoji: '🦋' },
];

type Props = {
  visible: boolean;
  pending: PendingHatchEntry | null;
  /** Called after the user successfully hatches OR dismisses the modal.
   * Parent decides whether to fetch the next pending entry or reset. */
  onClose: (didHatch: boolean) => void;
};

export default function PendingHatchModal({ visible, pending, onClose }: Props) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hatched, setHatched] = useState<{ name: string; coins: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset internal state every time a new pending entry arrives so the
  // modal feels fresh per session (e.g. user has 3 pending and the
  // parent re-renders us once each pending is hatched).
  useEffect(() => {
    if (pending) {
      setSelectedName(null);
      setSubmitting(false);
      setHatched(null);
      setError(null);
    }
  }, [pending?.session_id]);

  const subjectLabel = useMemo(() => {
    if (!pending?.subject_name) return null;
    return pending.subject_name.charAt(0).toUpperCase() + pending.subject_name.slice(1);
  }, [pending?.subject_name]);

  const handleHatch = async () => {
    if (!pending || !selectedName || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await sessionsAPI.hatchPendingSession(pending.session_id, selectedName);
      const animalName = result.hatched_animal?.name || selectedName;
      // The server already credited coins at reap time; reuse the
      // coins_earned field for the celebration line.
      const coins = result.session?.coins_earned ?? pending.duration_minutes;
      setHatched({ name: animalName, coins });
    } catch (e: any) {
      // 409 means the server has decided this isn't pending anymore
      // (e.g. the user hatched something else on another device). We
      // close gracefully rather than nag.
      const msg = e?.message || 'Could not hatch — try again later.';
      if (msg.includes('409') || msg.toLowerCase().includes('no pending hatch')) {
        onClose(false);
        return;
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!pending) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onClose(!!hatched)}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <LinearGradient
            colors={['#8FC4BC', '#4A6A7A'] as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
          />
          <View style={styles.cardInner}>
            {!hatched ? (
              <>
                <Text style={styles.eyebrow}>We saved your session 🌳</Text>
                <Text style={styles.title}>Your egg is ready to hatch</Text>
                <Text style={styles.body}>
                  You completed{' '}
                  <Text style={styles.bodyBold}>{pending.duration_minutes} min</Text>
                  {subjectLabel ? (
                    <>
                      {' '}of <Text style={styles.bodyBold}>{subjectLabel}</Text>
                    </>
                  ) : null}
                  . Pick the animal you'd like to add to your sanctuary.
                </Text>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.animalRow}
                >
                  {PICKABLE_ANIMALS.map((a) => {
                    const img = getAnimalImage(a.name);
                    const isSelected = selectedName === a.name;
                    return (
                      <TouchableOpacity
                        key={a.name}
                        style={[styles.animalChip, isSelected && styles.animalChipSelected]}
                        onPress={() => setSelectedName(a.name)}
                        accessibilityRole="button"
                        accessibilityLabel={`Pick ${a.name}`}
                        accessibilityState={{ selected: isSelected }}
                      >
                        {img ? (
                          <Image source={img} style={styles.animalImage} resizeMode="contain" />
                        ) : (
                          <Text style={styles.animalEmoji}>{a.emoji}</Text>
                        )}
                        <Text style={[styles.animalName, isSelected && styles.animalNameSelected]}>
                          {a.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {error && <Text style={styles.errorText}>{error}</Text>}

                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    (!selectedName || submitting) && styles.primaryBtnDisabled,
                  ]}
                  onPress={handleHatch}
                  disabled={!selectedName || submitting}
                  accessibilityRole="button"
                >
                  {submitting ? (
                    <ActivityIndicator color={colors.textOnPrimary} />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      {selectedName ? `Hatch ${selectedName}` : 'Pick an animal'}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => onClose(false)}
                  disabled={submitting}
                  accessibilityRole="button"
                >
                  <Text style={styles.secondaryBtnText}>Maybe later</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.eyebrow}>Welcome back 🎉</Text>
                <Text style={styles.title}>{hatched.name} hatched!</Text>
                <View style={styles.hatchedAnimalWrap}>
                  {getAnimalImage(hatched.name) ? (
                    <Image
                      source={getAnimalImage(hatched.name)}
                      style={styles.hatchedAnimalImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={styles.hatchedAnimalEmoji}>🐾</Text>
                  )}
                </View>
                <Text style={styles.body}>
                  Added to your sanctuary. {hatched.coins > 0 ? `You earned 🍀 ${hatched.coins} eco-credits from this session.` : ''}
                </Text>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => onClose(true)}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryBtnText}>Continue</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    overflow: 'hidden',
    ...shadows.large,
  },
  cardInner: {
    padding: 24,
    paddingTop: 28,
  },
  eyebrow: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.textOnPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 18,
  },
  bodyBold: {
    fontFamily: fonts.bold,
    color: colors.textOnPrimary,
  },
  animalRow: {
    paddingHorizontal: 4,
    paddingBottom: 4,
    gap: 10,
  },
  animalChip: {
    width: 96,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    marginRight: 8,
  },
  animalChipSelected: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderColor: '#FFFFFF',
  },
  animalImage: {
    width: 56,
    height: 56,
    marginBottom: 6,
  },
  animalEmoji: {
    fontSize: 36,
    marginBottom: 6,
  },
  animalName: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  animalNameSelected: {
    color: colors.textOnPrimary,
    fontFamily: fonts.semiBold,
  },
  primaryBtn: {
    marginTop: 18,
    backgroundColor: colors.textOnPrimary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.primaryDark,
  },
  secondaryBtn: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#FFD9D2',
    textAlign: 'center',
    marginTop: 6,
  },
  hatchedAnimalWrap: {
    alignItems: 'center',
    marginVertical: 16,
  },
  hatchedAnimalImage: {
    width: 140,
    height: 140,
  },
  hatchedAnimalEmoji: {
    fontSize: 80,
  },
});
