import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
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
import { Text } from '../components/StyledText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import ConfettiCannon from 'react-native-confetti-cannon';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { getAnimalImage } from '../assets/animals';
import { API_URL, donationsAPI } from '../services/api';

const EVERY_ORG_WWF_BASE = 'https://www.every.org/wwf';

interface CommunityStats {
  total_raised: number;
  total_donors: number;
  total_donations: number;
  this_month_raised: number;
  this_month_count: number;
  recent_donations: { name: string; amount: number; currency: string; date: string }[];
}

interface PersonalStats {
  total_donated: number;
  donation_count: number;
  history: { amount: number; currency: string; nonprofit: string; date: string }[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DONATION_AMOUNTS = [
  { amount: 2, label: '$2', nudge: 'Instead of a bottle of water' },
  { amount: 5, label: '$5', nudge: 'Instead of a takeaway coffee', popular: true },
  { amount: 10, label: '$10', nudge: 'Instead of a quick meal outside' },
  { amount: 25, label: '$25', nudge: 'Instead of an uber ride' },
  { amount: 50, label: '$50', nudge: 'Instead of a nice weekend brunch' },
];

const IMPACT_FACTS = [
  { icon: '🐘', stat: '40,000+', label: 'species at risk of extinction' },
  { icon: '🌍', stat: '68%', label: 'wildlife population lost since 1970' },
  { icon: '🌿', stat: '1M+', label: 'acres protected by WWF annually' },
];


const FALLBACK_MESSAGES = [
  '🩷 Be the first to donate through Endura!',
  '🐢 Every dollar goes directly to WWF conservation',
  '🐘 Every donation supports real-world conservation',
  '🌱 Your donation protects endangered species worldwide',
];

const MILESTONES = [
  { amount: 10, label: 'Seed Planter', icon: '🌱', desc: 'First steps for conservation' },
  { amount: 50, label: 'Habitat Guardian', icon: '🌿', desc: 'Protecting real habitats' },
  { amount: 100, label: 'Wildlife Protector', icon: '🛡️', desc: 'Funding anti-poaching patrols' },
  { amount: 250, label: 'Species Saviour', icon: '🦁', desc: 'Rescuing endangered animals' },
  { amount: 500, label: 'Conservation Hero', icon: '🏆', desc: 'Making a lasting impact' },
  { amount: 1000, label: 'Planet Champion', icon: '🌍', desc: 'A true force for nature' },
];

export default function TakeActionScreen() {
  const navigation = useNavigation<any>();
  const { user, profilePic } = useAuth();
  const [selectedAmount, setSelectedAmount] = useState(5);
  const [showThankYou, setShowThankYou] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);
  const [personalStats, setPersonalStats] = useState<PersonalStats | null>(null);

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
      if (__DEV__) console.log('Could not fetch community stats:', e);
    }
  };

  const fetchPersonalStats = async () => {
    if (!user?.id) return;
    try {
      const data = await donationsAPI.getUserStats(user.id);
      setPersonalStats(data);
    } catch (e) {
      if (__DEV__) console.log('Could not fetch personal stats:', e);
    }
  };

  const buildTickerMessages = useCallback((): string[] => {
    if (!communityStats || communityStats.total_donations === 0) return FALLBACK_MESSAGES;
    const msgs: string[] = [];
    if (communityStats.recent_donations.length > 0) {
      const recent = communityStats.recent_donations[0];
      msgs.push(`🌱 ${recent.name} just donated $${recent.amount}`);
    }
    msgs.push(`🩷 ${communityStats.this_month_count} donations this month`);
    msgs.push(`🐢 $${communityStats.total_raised.toFixed(0)} raised for conservation`);
    msgs.push(`🐘 ${communityStats.total_donors} donors and counting`);
    msgs.push(`🔥 Every donation goes directly to WWF`);
    return msgs;
  }, [communityStats]);

  useEffect(() => {
    fetchCommunityStats();
    fetchPersonalStats();
  }, []);

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


  const handleDonate = async () => {
    const donationId = user?.id ? `endura-u${user.id}-${Date.now()}` : `endura-${Date.now()}`;
    const donateUrl = `${EVERY_ORG_WWF_BASE}?amount=${selectedAmount}&frequency=ONCE&method=pay&partner_donation_id=${donationId}#donate`;
    try {
      await WebBrowser.openBrowserAsync(donateUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
        controlsColor: '#2F4A3E',
      });

      // Poll for webhook confirmation (up to 30s)
      let confirmed = false;
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 3000));
        try {
          const result = await donationsAPI.checkDonation(donationId);
          if (result.confirmed) {
            confirmed = true;
            break;
          }
        } catch {}
      }

      fetchCommunityStats();
      fetchPersonalStats();

      if (confirmed) {
        setShowConfetti(true);
        setShowThankYou(true);
        thankYouScale.setValue(0);
        Animated.spring(thankYouScale, { toValue: 1, friction: 4, tension: 50, useNativeDriver: true }).start();
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not open donation page');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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
            🩷
          </Animated.Text>
          <Text style={styles.heroTitle}>They Need You</Text>
          <Text style={styles.heroBody}>
            Your donation goes directly to WWF conservation efforts.
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

        {/* Your Impact + Community Stats Side-by-Side */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🌱</Text>
            <Text style={styles.statValue}>
              ${personalStats ? personalStats.total_donated.toFixed(0) : '0'}
            </Text>
            <Text style={styles.statLabel}>Your Donations</Text>
            {personalStats && personalStats.donation_count > 0 ? (
              <Text style={styles.statSub}>
                {personalStats.donation_count} donation{personalStats.donation_count !== 1 ? 's' : ''}
              </Text>
            ) : (
              <Text style={styles.statSub}>Make your first!</Text>
            )}
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🌍</Text>
            <Text style={styles.statValue}>
              ${communityStats ? communityStats.total_raised.toFixed(0) : '0'}
            </Text>
            <Text style={styles.statLabel}>Community Total</Text>
            <Text style={styles.statSub}>
              {communityStats ? `${communityStats.total_donors} donor${communityStats.total_donors !== 1 ? 's' : ''}` : 'Be the first!'}
            </Text>
          </View>
        </View>

        {/* Personal donation history */}
        {personalStats && personalStats.history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Your Recent Donations</Text>
            {personalStats.history.slice(0, 5).map((d, i) => (
              <View key={i} style={styles.historyRow}>
                <View style={styles.historyLeft}>
                  <Text style={styles.historyDot}>🩷</Text>
                  <View>
                    <Text style={styles.historyAmount}>${d.amount.toFixed(2)}</Text>
                    <Text style={styles.historyNonprofit}>to {d.nonprofit}</Text>
                  </View>
                </View>
                <Text style={styles.historyDate}>
                  {d.date ? new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                </Text>
              </View>
            ))}
          </View>
        )}


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
        <TouchableOpacity style={styles.thankYouOverlay} activeOpacity={1} onPress={() => { setShowThankYou(false); setShowConfetti(false); }}>
          <TouchableOpacity activeOpacity={1}>
          <Animated.View style={[styles.thankYouCard, { transform: [{ scale: thankYouScale }] }]}>
            <LinearGradient
              colors={['#E7EFEA', '#D4E8DE', '#C2DDD0']}
              style={styles.thankYouGradient}
            >
              <Text style={styles.thankYouTitle}>Thank You! 🎉</Text>
              <View style={styles.thankYouAnimals}>
                {['Sunda Island Tiger', 'Amur Leopard', 'Hawksbill Turtle'].map((name) => {
                  const img = getAnimalImage(name);
                  return img ? (
                    <Image key={name} source={img} style={styles.thankYouAnimalImg} resizeMode="contain" />
                  ) : null;
                })}
              </View>
              <View style={styles.thankYouFocalWrap}>
                <Text style={styles.thankYouImpact}>
                  You're not just studying{'\n'}— you're saving lives. 🌿
                </Text>
              </View>
              {personalStats && personalStats.donation_count > 0 && (
                <Text style={styles.thankYouStats}>
                  You've donated ${personalStats.total_donated.toFixed(0)} across {personalStats.donation_count} donation{personalStats.donation_count !== 1 ? 's' : ''}! 🌟
                </Text>
              )}
              <TouchableOpacity
                style={styles.thankYouClose}
                onPress={() => { setShowThankYou(false); setShowConfetti(false); }}
              >
                <Text style={styles.thankYouCloseText}>Keep Making a Difference</Text>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
          </TouchableOpacity>
          {showConfetti && (
            <ConfettiCannon
              count={200}
              origin={{ x: SCREEN_WIDTH / 2, y: -10 }}
              autoStart
              fadeOut
              explosionSpeed={400}
              fallSpeed={2500}
            />
          )}
        </TouchableOpacity>
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

  // Stats Row (Your Impact + Community)
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    ...shadows.small,
  },
  statEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  statSub: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },

  // Donation history
  historySection: {
    marginHorizontal: spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...shadows.small,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F2',
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyDot: {
    fontSize: 14,
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  historyNonprofit: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  historyDate: {
    fontSize: 12,
    color: colors.textMuted,
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

  // Milestone Tracker
  milestoneSection: {
    marginHorizontal: spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...shadows.medium,
  },
  milestoneHeader: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  milestoneRaised: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 16,
  },
  milestoneTrack: {
    gap: 0,
  },
  milestoneItem: {
    flexDirection: 'row',
    gap: 12,
  },
  milestoneLeft: {
    alignItems: 'center',
    width: 44,
  },
  milestoneIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F4F2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2EAE5',
  },
  milestoneIconUnlocked: {
    backgroundColor: '#E7F5ED',
    borderColor: colors.primary,
  },
  milestoneBar: {
    width: 4,
    flex: 1,
    backgroundColor: '#E2EAE5',
    borderRadius: 2,
    marginVertical: 2,
    overflow: 'hidden',
  },
  milestoneBarFill: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  } as any,
  milestoneInfo: {
    flex: 1,
    paddingBottom: 16,
    opacity: 0.5,
  },
  milestoneInfoUnlocked: {
    opacity: 1,
  },
  milestoneName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  milestoneNameUnlocked: {
    color: colors.primary,
  },
  milestoneDesc: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
    marginTop: 1,
  },
  milestoneTarget: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  milestoneMonthly: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 12,
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
    paddingTop: 32,
    alignItems: 'center',
  },
  thankYouTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#2F4A3E',
    marginBottom: 16,
  },
  thankYouStats: {
    fontSize: 13,
    color: '#5E7F6E',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  thankYouFocalWrap: {
    backgroundColor: 'rgba(47, 74, 62, 0.08)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(47, 74, 62, 0.12)',
  },
  thankYouImpact: {
    fontSize: 20,
    color: '#2F4A3E',
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 28,
  },
  thankYouAnimals: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  thankYouAnimalImg: {
    width: 80,
    height: 80,
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
