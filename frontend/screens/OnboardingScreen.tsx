import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
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
import { Text, TextInput } from '../components/StyledText';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import * as SecureStore from 'expo-secure-store';
import { API_URL, authAPI, SchoolSearchResult, subjectsAPI, Subject } from '../services/api';
import { Analytics } from '../services/analytics';
import COUNTRIES from '../constants/countries';

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
    title: 'Study and earn eco-credits',
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
    title: 'Scroll through study tips',
    body: 'Swipe through unique, research-backed advice from animal friends, save favourites, and share with mates.',
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
  const slideOpacities = useRef(SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  const textOpacity = useRef(new Animated.Value(1)).current;
  const isAnimating = useRef(false);
  const onboardingStartRef = useRef<number>(Date.now());

  useEffect(() => {
    Analytics.onboardingStarted();
  }, []);

  useEffect(() => {
    if (step < SLIDES.length) {
      Analytics.onboardingSlideViewed(step, SLIDES[step].tag);
    }
  }, [step]);

  // Profile setup state
  const [username, setUsername] = useState('');
  const [profilePicUri, setProfilePicUri] = useState<string | null>(null);
  const [school, setSchool] = useState('');
  const [country, setCountry] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [schoolSuggestions, setSchoolSuggestions] = useState<SchoolSearchResult[]>([]);
  const [showSchoolSuggestions, setShowSchoolSuggestions] = useState(false);
  const schoolSearchTimeout = useRef<NodeJS.Timeout | null>(null);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES.slice();
    const q = countrySearch.toLowerCase();
    return COUNTRIES.filter(c => c.toLowerCase().includes(q));
  }, [countrySearch]);
  const [isLoading, setIsLoading] = useState(false);
  const { refreshUser, setProfilePic } = useAuth();

  // Subject picker state
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<Subject[]>([]);
  const [subjectSearchText, setSubjectSearchText] = useState('');
  const [subjectSuggestions, setSubjectSuggestions] = useState<Subject[]>([]);
  const [showSubjectSuggestions, setShowSubjectSuggestions] = useState(false);
  const subjectSearchTimeout = useRef<NodeJS.Timeout | null>(null);
  const [subjectSaving, setSubjectSaving] = useState(false);

  const isSetup = step === SLIDES.length;

  const go = (next: number) => {
    if (isAnimating.current || next < 0 || next > SLIDES.length) return;
    isAnimating.current = true;
    const prev = step;
    Animated.parallel([
      Animated.timing(slideOpacities[prev], { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(textOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      if (next < SLIDES.length) {
        Animated.parallel([
          Animated.timing(slideOpacities[next], { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.timing(textOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        ]).start(() => { isAnimating.current = false; });
      } else {
        isAnimating.current = false;
      }
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

  const handleSubjectSearch = (text: string) => {
    setSubjectSearchText(text);
    if (subjectSearchTimeout.current) clearTimeout(subjectSearchTimeout.current);
    if (text.trim().length < 1) {
      setSubjectSuggestions([]);
      setShowSubjectSuggestions(false);
      return;
    }
    subjectSearchTimeout.current = setTimeout(async () => {
      try {
        const results = await subjectsAPI.search(text.trim());
        const selectedIds = new Set(selectedSubjects.map(s => s.id));
        const filtered = results.filter(s => !selectedIds.has(s.id));
        setSubjectSuggestions(filtered);
        setShowSubjectSuggestions(filtered.length > 0);
      } catch {
        setSubjectSuggestions([]);
        setShowSubjectSuggestions(false);
      }
    }, 250);
  };

  const selectSubject = (subject: Subject) => {
    setSelectedSubjects(prev => [...prev, subject]);
    setSubjectSearchText('');
    setSubjectSuggestions([]);
    setShowSubjectSuggestions(false);
  };

  const removeSelectedSubject = (subjectId: number) => {
    setSelectedSubjects(prev => prev.filter(s => s.id !== subjectId));
  };

  const addCustomSubject = async () => {
    const name = subjectSearchText.trim();
    if (!name) return;
    try {
      const newSub = await subjectsAPI.createCustom(name);
      setSelectedSubjects(prev => [...prev, newSub]);
      setSubjectSearchText('');
      setSubjectSuggestions([]);
      setShowSubjectSuggestions(false);
    } catch {}
  };

  const handleSaveSubjects = async () => {
    setSubjectSaving(true);
    if (selectedSubjects.length > 0) {
      Analytics.onboardingSubjectsSaved(selectedSubjects.length);
    } else {
      Analytics.onboardingSubjectsSkipped();
    }
    try {
      for (const sub of selectedSubjects) {
        try { await subjectsAPI.addSubject(sub.id); } catch {}
      }
      try { await authAPI.completeOnboarding(); } catch {}
      await refreshUser();
      const totalSeconds = Math.round((Date.now() - onboardingStartRef.current) / 1000);
      Analytics.onboardingCompleted(totalSeconds);
    } catch {}
    finally { setSubjectSaving(false); }
  };

  const handleComplete = async () => {
    if (!profilePicUri) { Alert.alert('Profile Photo Required', 'Please add a profile picture to continue.'); return; }
    const u = username.trim();
    if (!u) { Alert.alert('Username Required', 'Please enter a username to continue.'); return; }
    if (!school.trim()) { Alert.alert('School Required', 'Please enter your school to continue.'); return; }
    if (!country.trim()) { Alert.alert('Country Required', 'Please enter your country to continue.'); return; }

    Analytics.onboardingProfileSubmitted({
      has_photo: !!profilePicUri,
      has_school: !!school.trim(),
      has_country: !!country.trim(),
    });

    setIsLoading(true);
    try {
      const token = await SecureStore.getItemAsync('authToken');
      const res = await fetch(`${API_URL}/user/username?username=${encodeURIComponent(u)}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to set username' }));
        const d = err.detail || 'Failed to set username';
        Analytics.onboardingProfileSaveFailed('username', typeof d === 'string' ? d : 'Failed to set username');
        if (typeof d === 'string' && d.toLowerCase().includes('taken')) Alert.alert('Username Taken', `@${u} is already in use. Try a different one.`);
        else Alert.alert('Error', d);
        return;
      }
      try {
        await authAPI.updateProfile({ school: school.trim(), country: country.trim() });
      } catch (err: any) {
        Analytics.onboardingProfileSaveFailed('profile_update', err?.message || 'unknown');
      }
      try {
        await setProfilePic(profilePicUri);
      } catch (err: any) {
        Analytics.onboardingProfileSaveFailed('profile_pic', err?.message || 'unknown');
      }
      setShowSubjectPicker(true);
    } catch (e: any) {
      Analytics.onboardingProfileSaveFailed('exception', e?.message || 'unknown');
      Alert.alert('Error', e?.message || 'Something went wrong');
    }
    finally { setIsLoading(false); }
  };

  // ═══════ SUBJECT PICKER (after profile setup) ═══════
  if (showSubjectPicker) {
    return (
      <LinearGradient colors={['#E7EFEA', '#DCEAE3']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={ps.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={ps.title}>What do you study?</Text>
              <Text style={ps.sub}>Add your subjects so we can personalise your experience</Text>

              <View style={[ps.field, { zIndex: 10 }]}>
                <Text style={ps.label}>Search subjects</Text>
                <View style={sp.searchRow}>
                  <TextInput
                    style={[ps.input, { flex: 1 }]}
                    placeholder="e.g. Biology, Maths, History..."
                    placeholderTextColor={C.textMute}
                    value={subjectSearchText}
                    onChangeText={handleSubjectSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {subjectSearchText.trim().length > 0 && (
                    <TouchableOpacity style={sp.addBtn} onPress={addCustomSubject}>
                      <Text style={sp.addBtnText}>Add</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {showSubjectSuggestions && subjectSuggestions.length > 0 && (
                  <View style={sp.sugBox}>
                    <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                      {subjectSuggestions.map((s) => (
                        <TouchableOpacity key={s.id} style={sp.sugItem} onPress={() => selectSubject(s)}>
                          <Text style={sp.sugText}>{s.display_name}</Text>
                          <Text style={sp.sugPlus}>+</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {selectedSubjects.length > 0 && (
                <View style={sp.chipsWrap}>
                  {selectedSubjects.map((s) => (
                    <TouchableOpacity key={s.id} style={sp.chip} onPress={() => removeSelectedSubject(s.id)} activeOpacity={0.7}>
                      <Text style={sp.chipText}>{s.display_name}</Text>
                      <Text style={sp.chipX}>✕</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={{ flex: 1, minHeight: 40 }} />

              <TouchableOpacity
                style={[ps.cta, subjectSaving && { opacity: 0.7 }]}
                onPress={handleSaveSubjects}
                disabled={subjectSaving}
                activeOpacity={0.8}
              >
                <LinearGradient colors={[C.primary, C.dark]} style={ps.ctaGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {subjectSaving ? <ActivityIndicator color="#fff" /> : (
                    <Text style={ps.ctaText}>
                      {selectedSubjects.length > 0 ? `Continue with ${selectedSubjects.length} subject${selectedSubjects.length > 1 ? 's' : ''}` : 'Skip for now'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

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

              <View style={[ps.field, { zIndex: 5 }]}>
                <Text style={ps.label}>Country *</Text>
                <TouchableOpacity
                  style={ps.input}
                  onPress={() => { setShowCountryPicker(true); setCountrySearch(''); }}
                  activeOpacity={0.7}
                >
                  <Text style={country ? { color: C.textDark, fontSize: 16 } : { color: C.textMute, fontSize: 16 }}>
                    {country || 'Select your country'}
                  </Text>
                </TouchableOpacity>
                {showCountryPicker && (
                  <View style={ps.sugBox}>
                    <TextInput
                      style={[ps.input, { marginBottom: 4 }]}
                      placeholder="Search countries..."
                      placeholderTextColor={C.textMute}
                      value={countrySearch}
                      onChangeText={setCountrySearch}
                      autoFocus
                    />
                    <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                      {filteredCountries.map((c) => (
                        <TouchableOpacity
                          key={c}
                          style={ps.sugItem}
                          onPress={() => { setCountry(c); setShowCountryPicker(false); setCountrySearch(''); }}
                        >
                          <Text style={[ps.sugName, country === c && { color: C.primary, fontWeight: '700' }]}>{c}</Text>
                        </TouchableOpacity>
                      ))}
                      {filteredCountries.length === 0 && (
                        <Text style={{ padding: 12, color: C.textMute, textAlign: 'center', fontSize: 14 }}>No countries found</Text>
                      )}
                    </ScrollView>
                  </View>
                )}
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

          {/* All slides stacked, each with its own opacity */}
          <View style={{ flex: 1 }}>
            {SLIDES.map((slide, i) => (
              <Animated.View
                key={i}
                style={{ ...StyleSheet.absoluteFillObject, opacity: slideOpacities[i] }}
                pointerEvents={i === step ? 'auto' : 'none'}
              >
                <ScreenshotSlide source={slide.image} />
              </Animated.View>
            ))}
          </View>
        </SafeAreaView>
      </View>

      {/* Instruction card at bottom */}
      <View style={[wb.card, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={wb.cardHandle} />
        <Animated.View style={{ opacity: textOpacity, alignItems: 'center' }}>
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
          <TouchableOpacity
            style={wb.nextBtn}
            onPress={() => {
              if (step === SLIDES.length - 1) Analytics.onboardingWalkthroughCompleted();
              go(step + 1);
            }}
            activeOpacity={0.8}
          >
            <LinearGradient colors={['#5F8C87', '#3B5466']} style={wb.nextGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={wb.nextText}>{step === SLIDES.length - 1 ? 'Set Up Profile' : 'Next'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={{ paddingVertical: 6 }}
          onPress={() => {
            Analytics.onboardingWalkthroughSkipped(step);
            go(SLIDES.length);
          }}
        >
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

// Subject picker styles
const sp = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  sugBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: C.border,
    ...shadows.small,
  },
  sugItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  sugText: {
    fontSize: 15,
    fontWeight: '500',
    color: C.textDark,
  },
  sugPlus: {
    fontSize: 18,
    fontWeight: '600',
    color: C.primary,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 10,
    borderWidth: 1.5,
    borderColor: C.primary,
    gap: 6,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.primary,
  },
  chipX: {
    fontSize: 12,
    color: C.textMute,
    fontWeight: '600',
  },
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
