import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Platform,
  ActionSheetIOS,
  KeyboardAvoidingView,
} from 'react-native';
import { Text, TextInput } from '../components/StyledText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { shadows, spacing } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import * as SecureStore from 'expo-secure-store';
import { API_URL, authAPI, SchoolSearchResult, subjectsAPI, Subject } from '../services/api';
import { Analytics } from '../services/analytics';
import COUNTRIES from '../constants/countries';
import Avatar from '../components/Avatar';

const C = {
  bg: '#E8F5E9', hero: '#C5DEC9', surface: '#FFFFFF', sage: '#6B9B9B',
  green: '#6B8F71', textDark: '#2F4A3E', textMid: '#5F8C87', textMute: '#7C8F86',
  border: '#A9BDAF', primary: '#5F8C87', dark: '#3B5466', light: '#A8C8D8',
  tipsBg: '#F4F7F5',
};

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function OnboardingScreen() {
  const onboardingStartRef = useRef<number>(Date.now());

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
  const { refreshUser, setProfilePic, logout } = useAuth();

  const handleSignOut = () => {
    Alert.alert(
      'Sign out?',
      'You can come back any time and pick up where you left off.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            try { await logout(); } catch {}
          },
        },
      ],
    );
  };

  // Subject picker state
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<Subject[]>([]);
  const [subjectSearchText, setSubjectSearchText] = useState('');
  const [subjectSuggestions, setSubjectSuggestions] = useState<Subject[]>([]);
  const [showSubjectSuggestions, setShowSubjectSuggestions] = useState(false);
  const subjectSearchTimeout = useRef<NodeJS.Timeout | null>(null);
  const [subjectSaving, setSubjectSaving] = useState(false);

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

  if (showSubjectPicker) {
    return (
      <LinearGradient colors={['#E7EFEA', '#DCEAE3']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={ps.topBar}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={handleSignOut} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={ps.signOutText}>Sign out</Text>
            </TouchableOpacity>
          </View>
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
  return (
    <LinearGradient colors={['#E7EFEA', '#DCEAE3']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={ps.topBar}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={handleSignOut} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={ps.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={ps.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={ps.title}>Set Up Your Profile</Text>
            <Text style={ps.sub}>Choose a username to get started — you can always update the rest later</Text>

            <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.8} style={ps.avatarWrap}>
              <View style={ps.avatarCircle}>
                {profilePicUri ? (
                  <Image source={{ uri: profilePicUri }} style={ps.avatarImg} />
                ) : (
                  <Avatar
                    name={username.trim() || '?'}
                    size={110}
                    style={{ borderRadius: 55 }}
                  />
                )}
              </View>
              <Text style={ps.avatarLabel}>{profilePicUri ? 'Change Photo' : 'Add Photo (optional)'}</Text>
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

// ═══════════════════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════════════════

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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  signOutText: {
    color: C.textMid,
    fontSize: 14,
    fontWeight: '600',
  },
  content: { flexGrow: 1, paddingHorizontal: 32, paddingTop: 8, paddingBottom: 48 },
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
