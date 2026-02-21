import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { animalImages } from '../assets/animals';
import { API_URL } from '../services/api';

const EVERY_ORG_WWF_BASE = 'https://www.every.org/wwf/donate';
const EVERY_ORG_API_KEY = 'pk_live_8913a39d0db6790bf98977221209232b';

interface CommunityStats {
  total_raised: number;
  total_donors: number;
  total_donations: number;
  this_month_raised: number;
  this_month_count: number;
  recent_donations: { name: string; amount: number; currency: string; date: string }[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DONATION_AMOUNTS = [
  { amount: 1, label: '$1', nudge: 'A small step for wildlife' },
  { amount: 2, label: '$2', nudge: 'A coffee for conservation' },
  { amount: 5, label: '$5', nudge: 'Protect 1 acre of habitat', popular: true },
  { amount: 10, label: '$10', nudge: 'Feed a rescued animal for a week' },
  { amount: 25, label: '$25', nudge: 'Fund anti-poaching patrols' },
  { amount: 50, label: '$50', nudge: 'Rehabilitate an injured animal' },
];

const IMPACT_FACTS = [
  { icon: '🐘', stat: '40,000+', label: 'species at risk of extinction' },
  { icon: '🌍', stat: '68%', label: 'wildlife population lost since 1970' },
  { icon: '🌿', stat: '1M+', label: 'acres protected by WWF annually' },
];

const ENDANGERED_STORIES = [
  {
    animal: 'Sumatran Orangutan',
    image: 'sumatran_orangutan',
    fact: 'Only 14,000 remain in the wild. Their rainforest home is disappearing at an alarming rate.',
    urgency: 'Critically Endangered',
  },
  {
    animal: 'Amur Leopard',
    image: 'amur_leopard',
    fact: 'Fewer than 100 remain in the wild, making them the world\'s rarest big cat.',
    urgency: 'Critically Endangered',
  },
  {
    animal: 'Hawksbill Sea Turtle',
    image: 'hawksbill_sea_turtle',
    fact: 'Their population has declined by 80% in the last century due to habitat loss and poaching.',
    urgency: 'Critically Endangered',
  },
  {
    animal: 'Javan Rhino',
    image: 'javan_rhino',
    fact: 'Only 72 individuals survive. They\'re one step from disappearing forever.',
    urgency: 'Critically Endangered',
  },
];

const FALLBACK_MESSAGES = [
  '💚 Be the first to donate through Endura!',
  '🐢 Every dollar goes directly to WWF conservation',
  '🐘 94% of every dollar funds real-world impact',
  '🌱 Your donation protects endangered species worldwide',
];

const animalImageMap: Record<string, any> = {
  sumatran_orangutan: animalImages['Sumatran Orangutan'],
  amur_leopard: animalImages['Amur Leopard'],
  hawksbill_sea_turtle: animalImages['Hawksbill Sea Turtle'],
  javan_rhino: animalImages['Javan Rhino'],
};

export default function TakeActionScreen() {
  const navigation = useNavigation<any>();
  const { user, profilePic } = useAuth();
  const [selectedAmount, setSelectedAmount] = useState(1);
  const [showThankYou, setShowThankYou] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);

  const potFill = useRef(new Animated.Value(0.15)).current;
  const coinAnim = useRef(new Animated.Value(0)).current;
  const coinOpacity = useRef(new Animated.Value(0)).current;
  const heartPulse = useRef(new Animated.Value(1)).current;
  const thankYouScale = useRef(new Animated.Value(0)).current;
  const nudgeFade = useRef(new Animated.Value(1)).current;
  const communityIdx = useRef(0);
  const [communityMsg, setCommunityMsg] = useState(FALLBACK_MESSAGES[0]);

  const fetchCommunityStats = async () => {
    try {
      const res = await fetch(`${API_URL}/donations/community-stats`);
      if (res.ok) {
        const data: CommunityStats = await res.json();
        setCommunityStats(data);
        const goalProgress = Math.min(0.15 + (data.total_raised / 10000) * 0.85, 1);
        Animated.spring(potFill, { toValue: goalProgress, friction: 6, useNativeDriver: false }).start();
      }
    } catch (e) {
      console.log('Could not fetch community stats:', e);
    }
  };

  const buildTickerMessages = useCallback((): string[] => {
    if (!communityStats || communityStats.total_donations === 0) return FALLBACK_MESSAGES;
    const msgs: string[] = [];
    if (communityStats.recent_donations.length > 0) {
      const recent = communityStats.recent_donations[0];
      msgs.push(`🌱 ${recent.name} just donated $${recent.amount}`);
    }
    msgs.push(`💚 ${communityStats.this_month_count} donations this month`);
    msgs.push(`🐢 $${communityStats.total_raised.toFixed(0)} raised for conservation`);
    msgs.push(`🐘 ${communityStats.total_donors} donors and counting`);
    msgs.push(`🔥 94% of every dollar goes directly to WWF`);
    return msgs;
  }, [communityStats]);

  useEffect(() => { fetchCommunityStats(); }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(heartPulse, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(heartPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(nudgeFade, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        const msgs = buildTickerMessages();
        communityIdx.current = (communityIdx.current + 1) % msgs.length;
        setCommunityMsg(msgs[communityIdx.current]);
        Animated.timing(nudgeFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [buildTickerMessages]);

  useEffect(() => {
    const storyTimer = setInterval(() => {
      setStoryIndex(prev => (prev + 1) % ENDANGERED_STORIES.length);
    }, 6000);
    return () => clearInterval(storyTimer);
  }, []);

  const handleDonate = async () => {
    const donateUrl = `${EVERY_ORG_WWF_BASE}?amount=${selectedAmount}&frequency=ONCE&partner_id=${EVERY_ORG_API_KEY}&utm_source=endura&utm_medium=app`;
    try {
      await WebBrowser.openBrowserAsync(donateUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
        controlsColor: '#2F4A3E',
      });
      fetchCommunityStats();
      setShowThankYou(true);
      thankYouScale.setValue(0);
      Animated.spring(thankYouScale, { toValue: 1, friction: 4, tension: 50, useNativeDriver: true }).start();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not open donation page');
    }
  };

  const story = ENDANGERED_STORIES[storyIndex];
  const storyImg = animalImageMap[story.image];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Take Action</Text>
            <Text style={styles.headerSubtitle}>Make a real difference</Text>
          </View>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate('Profile')}
          >
            {profilePic ? (
              <Image source={{ uri: profilePic }} style={styles.profileImg} />
            ) : (
              <Text style={{ fontSize: 18 }}>👤</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Compact Hero + Donation — immediate action */}
        <LinearGradient
          colors={['#E7EFEA', '#D4E8DE']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.heroSection}
        >
          <Animated.Text style={[styles.heroHeart, { transform: [{ scale: heartPulse }] }]}>
            💚
          </Animated.Text>
          <Text style={styles.heroTitle}>They Need You</Text>
          <Text style={styles.heroBody}>
            Your donation goes directly to WWF conservation efforts.{'\n'}94% of every dollar funds real-world impact.
          </Text>
        </LinearGradient>

        {/* Donation Amount Selector */}
        <View style={styles.donationSection}>
          <Text style={styles.donationTitle}>Choose Your Impact</Text>
          <View style={styles.amountGrid}>
            {DONATION_AMOUNTS.map((d) => (
              <TouchableOpacity
                key={d.amount}
                style={[
                  styles.amountCard,
                  selectedAmount === d.amount && styles.amountCardSelected,
                ]}
                onPress={() => setSelectedAmount(d.amount)}
                activeOpacity={0.7}
              >
                {d.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>Most Popular</Text>
                  </View>
                )}
                <Text style={[styles.amountLabel, selectedAmount === d.amount && styles.amountLabelSelected]}>
                  {d.label}
                </Text>
                <Text style={[styles.amountNudge, selectedAmount === d.amount && styles.amountNudgeSelected]}>
                  {d.nudge}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Donate Button */}
        <View style={styles.paySection}>
          <TouchableOpacity activeOpacity={0.8} onPress={handleDonate}>
            <LinearGradient
              colors={['#2F4A3E', '#1A2F26']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.applePayBtn}
            >
              <Text style={styles.applePayText}>Donate ${selectedAmount} to WWF</Text>
            </LinearGradient>
          </TouchableOpacity>
          <View style={styles.trustRowInline}>
            <Text style={styles.trustInlineText}>🔒 Secure</Text>
            <Text style={styles.trustInlineText}>✅ Verified</Text>
            <Text style={styles.trustInlineText}>📋 Tax Deductible</Text>
          </View>
        </View>

        {/* Community Social Proof Ticker */}
        <Animated.View style={[styles.communityTicker, { opacity: nudgeFade }]}>
          <Text style={styles.communityText}>{communityMsg}</Text>
        </Animated.View>

        {/* Donation Pot Visual */}
        <View style={styles.potSection}>
          <Text style={styles.potTitle}>🫙 Community Conservation Fund</Text>
          <View style={styles.potContainer}>
            <View style={styles.potOutline}>
              <Animated.View
                style={[
                  styles.potFill,
                  {
                    height: potFill.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              >
                <LinearGradient
                  colors={['#A8C8D8', '#5F8C87', '#4A7A62']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              <View style={styles.potCoinsOverlay}>
                <Text style={styles.potCoinsEmoji}>🪙🪙🪙</Text>
              </View>
            </View>
            <Animated.Text
              style={[
                styles.coinDropEmoji,
                {
                  opacity: coinOpacity,
                  transform: [
                    {
                      translateY: coinAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-30, 40],
                      }),
                    },
                  ],
                },
              ]}
            >
              🪙
            </Animated.Text>
          </View>
          <Text style={styles.potAmount}>
            ${communityStats ? communityStats.total_raised.toFixed(0) : '0'} raised by our community
          </Text>
          <Text style={styles.potGoal}>
            {communityStats && communityStats.this_month_count > 0
              ? `${communityStats.this_month_count} donations this month · $${communityStats.this_month_raised.toFixed(0)} raised`
              : 'Community goal: $10,000 this month'}
          </Text>
        </View>

        {/* Endangered Animal Story Card */}
        <View style={styles.storyCard}>
          <View style={styles.storyImageWrap}>
            {storyImg ? (
              <Image source={storyImg} style={styles.storyImage} resizeMode="contain" />
            ) : (
              <Text style={{ fontSize: 50 }}>🐾</Text>
            )}
          </View>
          <View style={styles.storyContent}>
            <View style={styles.urgencyBadge}>
              <Text style={styles.urgencyText}>⚠️ {story.urgency}</Text>
            </View>
            <Text style={styles.storyAnimalName}>{story.animal}</Text>
            <Text style={styles.storyFact}>{story.fact}</Text>
          </View>
          <View style={styles.storyDots}>
            {ENDANGERED_STORIES.map((_, i) => (
              <View key={i} style={[styles.storyDot, i === storyIndex && styles.storyDotActive]} />
            ))}
          </View>
        </View>

        {/* Impact Stats */}
        <View style={styles.impactRow}>
          {IMPACT_FACTS.map((fact, i) => (
            <View key={i} style={styles.impactCard}>
              <Text style={styles.impactIcon}>{fact.icon}</Text>
              <Text style={styles.impactStat}>{fact.stat}</Text>
              <Text style={styles.impactLabel}>{fact.label}</Text>
            </View>
          ))}
        </View>

        {/* Bottom Motivational */}
        <LinearGradient
          colors={['#E7EFEA', '#D8E8DE']}
          style={styles.bottomMotivation}
        >
          <Text style={styles.bottomQuote}>
            "The greatest threat to our planet is the belief that someone else will save it."
          </Text>
          <Text style={styles.bottomAuthor}>— Robert Swan</Text>
        </LinearGradient>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Thank You Modal */}
      <Modal visible={showThankYou} transparent animationType="fade">
        <View style={styles.thankYouOverlay}>
          <Animated.View style={[styles.thankYouCard, { transform: [{ scale: thankYouScale }] }]}>
            <LinearGradient
              colors={['#E7EFEA', '#D4E8DE', '#C2DDD0']}
              style={styles.thankYouGradient}
            >
              <Text style={styles.thankYouEmoji}>💚</Text>
              <Text style={styles.thankYouTitle}>Thank You!</Text>
              <Text style={styles.thankYouBody}>
                Your donation is making a real difference for endangered species around the world.
              </Text>
              {communityStats && communityStats.total_donations > 0 && (
                <Text style={styles.thankYouStats}>
                  Together, {communityStats.total_donors} donor{communityStats.total_donors !== 1 ? 's' : ''} have raised ${communityStats.total_raised.toFixed(0)} for conservation 🌿
                </Text>
              )}
              <Text style={styles.thankYouImpact}>
                You're not just studying — you're saving lives. 🌿
              </Text>
              <View style={styles.thankYouAnimals}>
                {['Sumatran Orangutan', 'Amur Leopard', 'Hawksbill Sea Turtle'].map((name) => {
                  const img = animalImages[name];
                  return img ? (
                    <Image key={name} source={img} style={styles.thankYouAnimalImg} resizeMode="contain" />
                  ) : null;
                })}
              </View>
              <TouchableOpacity
                style={styles.thankYouClose}
                onPress={() => setShowThankYou(false)}
              >
                <Text style={styles.thankYouCloseText}>Keep Making a Difference</Text>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8F5',
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    ...shadows.small,
  },
  backText: {
    fontSize: 24,
    fontWeight: '300',
    color: colors.textPrimary,
    marginTop: -2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  profileBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    ...shadows.small,
  },
  profileImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },

  // Hero
  heroSection: {
    marginHorizontal: spacing.md,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  heroHeart: {
    fontSize: 48,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2F4A3E',
    marginBottom: 8,
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 22,
    color: '#3B5F50',
    textAlign: 'center',
    fontWeight: '500',
  },

  // Community Ticker
  communityTicker: {
    marginHorizontal: spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
    ...shadows.small,
  },
  communityText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },

  // Story Card
  storyCard: {
    marginHorizontal: spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    ...shadows.medium,
  },
  storyImageWrap: {
    height: 160,
    backgroundColor: '#E7EFEA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyImage: {
    width: 120,
    height: 120,
  },
  storyContent: {
    padding: 16,
  },
  urgencyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF0E8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B85C4A',
  },
  storyAnimalName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  storyFact: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  storyDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 12,
  },
  storyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D0D8D4',
  },
  storyDotActive: {
    backgroundColor: colors.primary,
    width: 18,
  },

  // Impact Stats
  impactRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    gap: 8,
    marginBottom: 16,
  },
  impactCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    ...shadows.small,
  },
  impactIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  impactStat: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  impactLabel: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 13,
  },

  // Pot Section
  potSection: {
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: 16,
  },
  potTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  potContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  potOutline: {
    width: 120,
    height: 140,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#5F8C87',
    backgroundColor: 'rgba(232, 240, 236, 0.5)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  potFill: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  potCoinsOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  potCoinsEmoji: {
    fontSize: 20,
    letterSpacing: 4,
  },
  coinDropEmoji: {
    position: 'absolute',
    top: -10,
    fontSize: 28,
  },
  potAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 10,
  },
  potGoal: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Personal Nudge
  personalNudge: {
    marginHorizontal: spacing.md,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    ...shadows.small,
  },
  personalIcon: {
    fontSize: 28,
  },
  personalText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: '#3B5F50',
    fontWeight: '500',
  },

  // Donation Section
  donationSection: {
    marginHorizontal: spacing.md,
    marginBottom: 16,
  },
  donationTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  donationSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 14,
    fontWeight: '500',
  },
  amountGrid: {
    gap: 8,
  },
  amountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 2,
    borderColor: '#E2EAE5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F0F7F3',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  popularText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  amountLabel: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    width: 60,
  },
  amountLabelSelected: {
    color: colors.primary,
  },
  amountNudge: {
    flex: 1,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
    fontWeight: '500',
  },
  amountNudgeSelected: {
    color: colors.textSecondary,
  },

  // Apple Pay
  paySection: {
    marginHorizontal: spacing.md,
    marginBottom: 20,
  },
  applePayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 4,
  },
  applePayIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  applePayText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  trustRowInline: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
  },
  trustInlineText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },

  // Bottom Motivation
  bottomMotivation: {
    marginHorizontal: spacing.md,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  bottomQuote: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#3B5F50',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  bottomAuthor: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
    fontWeight: '600',
  },

  // Thank You Modal
  thankYouOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  thankYouCard: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    ...shadows.large,
  },
  thankYouGradient: {
    padding: 28,
    alignItems: 'center',
  },
  thankYouEmoji: {
    fontSize: 56,
    marginBottom: 12,
  },
  thankYouTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2F4A3E',
    marginBottom: 10,
  },
  thankYouBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#3B5F50',
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 8,
  },
  thankYouStats: {
    fontSize: 13,
    color: '#5E7F6E',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  thankYouImpact: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: 16,
  },
  thankYouAnimals: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  thankYouAnimalImg: {
    width: 50,
    height: 50,
  },
  thankYouClose: {
    backgroundColor: '#2F4A3E',
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  thankYouCloseText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
