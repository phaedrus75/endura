import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
  Animated,
  ScrollView,
  Image,
  Platform,
  ActionSheetIOS,
  KeyboardAvoidingView,
  ImageSourcePropType,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import * as SecureStore from 'expo-secure-store';
import { API_URL, authAPI, SchoolSearchResult } from '../services/api';

const { width: SW, height: SH } = Dimensions.get('window');

const C = {
  bg: '#E8F5E9', hero: '#C5DEC9', surface: '#FFFFFF', sage: '#6B9B9B',
  green: '#6B8F71', textDark: '#2F4A3E', textMid: '#5F8C87', textMute: '#7C8F86',
  border: '#A9BDAF', primary: '#5F8C87', dark: '#3B5466', light: '#A8C8D8',
  tipsBg: '#F4F7F5',
};

// ═══════════════════════════════════════════════════════════════════════════
//  SCREENSHOT IMAGES — actual app screenshots used as onboarding backgrounds
// ═══════════════════════════════════════════════════════════════════════════

const SCREENSHOTS = {
  home: require('../assets/onboarding/home.png'),
  timer: require('../assets/onboarding/timer.png'),
  sanctuary: require('../assets/onboarding/sanctuary.png'),
  progress: require('../assets/onboarding/progress.png'),
  tips: require('../assets/onboarding/tips.png'),
  friends: require('../assets/onboarding/friends.png'),
};

function ScreenshotSlide({ source }: { source: ImageSourcePropType }) {
  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <Image
        source={source}
        style={{ width: '100%', height: '108.5%', position: 'absolute', bottom: 0 }}
        resizeMode="contain"
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  SLIDE DATA
// ═══════════════════════════════════════════════════════════════════════════

interface Slide {
  image: ImageSourcePropType;
  tag: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    image: SCREENSHOTS.home,
    tag: 'YOUR DASHBOARD',
    title: 'Everything starts here',
    body: 'See your streaks, badges, animals and tasks at a glance. Tap the egg to jump into a study session!',
  },
  {
    image: SCREENSHOTS.timer,
    tag: 'FOCUS TIMER',
    title: 'Study to earn eco-credits',
    body: 'Pick a duration, hit start, and every minute you study earns eco-credits that hatch your egg.',
  },
  {
    image: SCREENSHOTS.sanctuary,
    tag: 'YOUR SANCTUARY',
    title: 'Hatch & collect animals',
    body: 'When your egg fills up it hatches into a real endangered species. Build your own wildlife sanctuary!',
  },
  {
    image: SCREENSHOTS.progress,
    tag: 'TRACK PROGRESS',
    title: 'See how far you\'ve come',
    body: 'View weekly study stats, subject breakdowns, and badges. Watch your consistency grow over time.',
  },
  {
    image: SCREENSHOTS.tips,
    tag: 'STUDY TIPS',
    title: 'Tap 💡 on any screen',
    body: 'Open Study Tips from the 💡 icon on any page. Swipe through advice from animal friends, save favourites, and share with mates.',
  },
  {
    image: SCREENSHOTS.friends,
    tag: 'FRIENDS & LEADERBOARD',
    title: 'Better together',
    body: 'Add friends from your school, climb the leaderboard, join study groups, and motivate each other.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const crossfade = useRef(new Animated.Value(1)).current;
  const isAnimating = useRef(false);

  // Profile setup state
  const [username, setUsername] = useState('');
  const [profilePicUri, setProfilePicUri] = useState<string | null>(null);
  const [school, setSchool] = useState('');
  const [country, setCountry] = useState('');
  const [schoolSuggestions, setSchoolSuggestions] = useState<SchoolSearchResult[]>([]);
  const [showSchoolSuggestions, setShowSchoolSuggestions] = useState(false);
  const schoolSearchTimeout = useRef<NodeJS.Timeout | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { refreshUser, setProfilePic } = useAuth();

  const isSetup = step === SLIDES.length;

  const go = (next: number) => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    crossfade.setValue(0);
    setStep(next);
    Animated.timing(crossfade, { toValue: 1, duration: 300, useNativeDriver: true }).start(() => {
      isAnimating.current = false;
    });
  };

  // ── helpers ──
  const handleSchoolSearch = (text: string) => {
    setSchool(text);
    if (schoolSearchTimeout.current) clearTimeout(schoolSearchTimeout.current);
    if (text.length < 2) { setSchoolSuggestions([]); setShowSchoolSuggestions(false); return; }
    schoolSearchTimeout.current = setTimeout(async () => {
      try { const r = await authAPI.searchSchools(text); setSchoolSuggestions(r); setShowSchoolSuggestions(r.length > 0); }
      catch { setSchoolSuggestions([]); setShowSchoolSuggestions(false); }
    }, 300);
  };
  const selectSchool = (s: SchoolSearchResult) => {
    setSchool(s.name);
    if (s.country && !country) setCountry(s.country === 'UK' ? 'United Kingdom' : s.country === 'US' ? 'United States' : s.country);
    setShowSchoolSuggestions(false);
  };

  const pickImage = async (src: 'camera' | 'gallery') => {
    try {
      if (src === 'camera') {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) { Alert.alert('Permission needed', 'Please allow camera access in Settings.'); return; }
        const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
        if (!r.canceled && r.assets[0]) setProfilePicUri(r.assets[0].uri);
      } else {
        const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
        if (!r.canceled && r.assets[0]) setProfilePicUri(r.assets[0].uri);
      }
    } catch { }
  };
  const handleAvatarPress = () => {
    if (Platform.OS === 'ios') {
      const o = profilePicUri ? ['Take Photo', 'Choose from Library', 'Remove Photo', 'Cancel'] : ['Take Photo', 'Choose from Library', 'Cancel'];
      ActionSheetIOS.showActionSheetWithOptions({ options: o, cancelButtonIndex: o.length - 1, destructiveButtonIndex: profilePicUri ? 2 : undefined },
        i => { if (i === 0) pickImage('camera'); else if (i === 1) pickImage('gallery'); else if (i === 2 && profilePicUri) setProfilePicUri(null); });
    } else {
      const b: any[] = [{ text: 'Take Photo', onPress: () => pickImage('camera') }, { text: 'Choose from Library', onPress: () => pickImage('gallery') }];
      if (profilePicUri) b.push({ text: 'Remove Photo', style: 'destructive', onPress: () => setProfilePicUri(null) });
      b.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert('Profile Photo', 'Choose an option', b);
    }
  };

  const handleComplete = async () => {
    if (!profilePicUri) { Alert.alert('Profile Photo Required', 'Please add a profile picture to continue.'); return; }
    const u = username.trim();
    if (!u) { Alert.alert('Username Required', 'Please enter a username to continue.'); return; }
    if (!school.trim()) { Alert.alert('School Required', 'Please enter your school to continue.'); return; }
    if (!country.trim()) { Alert.alert('Country Required', 'Please enter your country to continue.'); return; }

    setIsLoading(true);
    try {
      const token = await SecureStore.getItemAsync('authToken');
      const res = await fetch(`${API_URL}/user/username?username=${encodeURIComponent(u)}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to set username' }));
        const d = err.detail || 'Failed to set username';
        if (typeof d === 'string' && d.toLowerCase().includes('taken')) Alert.alert('Username Taken', `@${u} is already in use. Try a different one.`);
        else Alert.alert('Error', d);
        return;
      }
      try { await authAPI.updateProfile({ school: school.trim(), country: country.trim() }); } catch {}
      try { await setProfilePic(profilePicUri); } catch {}
      await refreshUser();
    } catch (e: any) { Alert.alert('Error', e?.message || 'Something went wrong'); }
    finally { setIsLoading(false); }
  };

  // ═══════ PROFILE SETUP ═══════
  if (isSetup) {
    return (
      <LinearGradient colors={['#E7EFEA', '#DCEAE3']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={ps.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={ps.title}>Set Up Your Profile</Text>
              <Text style={ps.sub}>All fields are required to continue</Text>

              <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.8} style={ps.avatarWrap}>
                <View style={ps.avatarCircle}>
                  {profilePicUri ? <Image source={{ uri: profilePicUri }} style={ps.avatarImg} /> : <Text style={ps.avatarPlus}>+</Text>}
                </View>
                <Text style={ps.avatarLabel}>Add Photo *</Text>
              </TouchableOpacity>

              <View style={ps.field}>
                <Text style={ps.label}>Username *</Text>
                <TextInput style={ps.input} placeholder="Choose a username" placeholderTextColor={C.textMute} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} maxLength={30} />
              </View>

              <View style={[ps.field, { zIndex: 10 }]}>
                <Text style={ps.label}>School *</Text>
                <TextInput style={ps.input} placeholder="e.g. Southbank International School" placeholderTextColor={C.textMute} value={school} onChangeText={handleSchoolSearch} autoCapitalize="words" />
                {showSchoolSuggestions && schoolSuggestions.length > 0 && (
                  <View style={ps.sugBox}><ScrollView style={{ maxHeight: 150 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                    {schoolSuggestions.map((sc, i) => (
                      <TouchableOpacity key={`${sc.name}-${i}`} style={ps.sugItem} onPress={() => selectSchool(sc)}>
                        <Text style={ps.sugName} numberOfLines={1}>{sc.name}</Text>
                        <Text style={ps.sugLoc} numberOfLines={1}>{[sc.city, sc.country].filter(Boolean).join(', ')}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView></View>
                )}
              </View>

              <View style={ps.field}>
                <Text style={ps.label}>Country *</Text>
                <TextInput style={ps.input} placeholder="e.g. United Kingdom" placeholderTextColor={C.textMute} value={country} onChangeText={setCountry} autoCapitalize="words" />
              </View>

              <TouchableOpacity style={[ps.cta, isLoading && { opacity: 0.7 }, { marginTop: spacing.md }]} onPress={handleComplete} disabled={isLoading} activeOpacity={0.8}>
                <LinearGradient colors={[C.primary, C.dark]} style={ps.ctaGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={ps.ctaText}>Start My Journey</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ═══════ WALKTHROUGH SLIDES ═══════
  const sl = SLIDES[step];

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flex: 1, backgroundColor: '#E7EFEA' }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          {/* Progress bar at top */}
          <View style={wb.progressRow}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[wb.progressSeg, i <= step && wb.progressSegActive]} />
            ))}
          </View>

          {/* Screenshot fades in */}
          <Animated.View style={{ flex: 1, opacity: crossfade }}>
            <ScreenshotSlide source={sl.image} />
          </Animated.View>
        </SafeAreaView>
      </View>

      {/* Instruction card at bottom */}
      <View style={[wb.card, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={wb.cardHandle} />
        <Animated.View style={{ opacity: crossfade, alignItems: 'center' }}>
          <Text style={wb.cardTag}>{sl.tag}</Text>
          <Text style={wb.cardTitle}>{sl.title}</Text>
          <Text style={wb.cardBody}>{sl.body}</Text>
        </Animated.View>

        <View style={wb.dotsRow}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[wb.dot, i === step && wb.dotActive]} />
          ))}
        </View>

        <View style={wb.btnRow}>
          {step > 0 && (
            <TouchableOpacity style={wb.backBtn} onPress={() => go(step - 1)} activeOpacity={0.8}>
              <Text style={wb.backText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={wb.nextBtn} onPress={() => go(step + 1)} activeOpacity={0.8}>
            <LinearGradient colors={['#5F8C87', '#3B5466']} style={wb.nextGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={wb.nextText}>{step === SLIDES.length - 1 ? 'Set Up Profile' : 'Next'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={{ paddingVertical: 6 }} onPress={() => go(SLIDES.length)}>
          <Text style={wb.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════════════════

// Walkthrough wrapper styles
const wb = StyleSheet.create({
  progressRow: { flexDirection: 'row', gap: 5, marginHorizontal: 20, marginTop: 6, marginBottom: 4 },
  progressSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(95,140,135,0.18)' },
  progressSegActive: { backgroundColor: '#5F8C87' },

  card: {
    backgroundColor: '#fff', borderTopLeftRadius: 0, borderTopRightRadius: 0,
    paddingHorizontal: 24, paddingTop: 14, alignItems: 'center',
  },
  cardHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#D0DDD6', marginBottom: 14 },
  cardTag: { fontSize: 12, fontWeight: '700', color: '#5F8C87', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 },
  cardTitle: { fontSize: 26, fontWeight: '800', color: '#2F4A3E', textAlign: 'center', marginBottom: 8 },
  cardBody: { fontSize: 16, lineHeight: 23, color: '#7C8F86', textAlign: 'center', marginBottom: 16, paddingHorizontal: 4 },

  dotsRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D0DDD6' },
  dotActive: { backgroundColor: '#5F8C87', width: 18 },

  btnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  backBtn: { flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: '#C0D0C6', justifyContent: 'center', alignItems: 'center', paddingVertical: 12 },
  backText: { color: '#5F8C87', fontSize: 15, fontWeight: '700' },
  nextBtn: { flex: 2, borderRadius: 14, overflow: 'hidden', ...shadows.medium },
  nextGrad: { paddingVertical: 12, alignItems: 'center', borderRadius: 14 },
  nextText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  skipText: { color: '#7C8F86', fontSize: 13, fontWeight: '500' },
});

// Profile setup styles
const ps = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 32, paddingTop: 32, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '800', color: C.textDark, textAlign: 'center', marginBottom: 4 },
  sub: { fontSize: 15, color: C.textMid, textAlign: 'center', marginBottom: 28 },
  avatarWrap: { alignItems: 'center', marginBottom: 20 },
  avatarCircle: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: C.primary, borderStyle: 'dashed', overflow: 'hidden', ...shadows.small },
  avatarImg: { width: 110, height: 110, borderRadius: 55 },
  avatarPlus: { fontSize: 36, color: C.primary, fontWeight: '300' },
  avatarLabel: { marginTop: 8, fontSize: 14, fontWeight: '600', color: C.primary },
  field: { marginBottom: 14, width: '100%' },
  label: { fontSize: 14, fontWeight: '600', color: C.textMid, marginBottom: 6 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 16, color: C.textDark, borderWidth: 1.5, borderColor: C.border },
  sugBox: { backgroundColor: '#fff', borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: C.border, ...shadows.small },
  sugItem: { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  sugName: { fontSize: 15, fontWeight: '600', color: C.textDark },
  sugLoc: { fontSize: 12, color: C.textMute, marginTop: 2 },
  cta: { width: '100%', borderRadius: 16, overflow: 'hidden', ...shadows.medium },
  ctaGrad: { paddingVertical: 16, alignItems: 'center', borderRadius: 16 },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
