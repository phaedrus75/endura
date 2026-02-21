import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  Dimensions,
  Image,
  Animated,
  PanResponder,
  ImageSourcePropType,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import LottieView from 'lottie-react-native';
import { colors, shadows, spacing, borderRadius } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { animalsAPI, badgesAPI, donationsAPI, UserAnimal, Animal, DonationLeaderboardEntry } from '../services/api';
import { getAnimalImage } from '../assets/animals';
import { Analytics } from '../services/analytics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - spacing.lg * 2 - spacing.md) / 2;

// Emoji representations for animals (synced with backend - 30 animals)
const animalEmojis: Record<string, string> = {
  'Sunda Island Tiger': '🐅',
  'Javan Rhino': '🦏',
  'Amur Leopard': '🐆',
  'Mountain Gorilla': '🦍',
  'Tapanuli Orangutan': '🦧',
  'Polar Bear': '🐻‍❄️',
  'African Forest Elephant': '🐘',
  'Hawksbill Turtle': '🐢',
  'Calamian Deer': '🦌',
  'Axolotl': '🦎',
  'Red Wolf': '🐺',
  'Monarch Butterfly': '🦋',
  'Red Panda': '🐼',
  'Panda': '🐼',
  'Mexican Bobcat': '🐱',
  'Chinchilla': '🐭',
  'Otter': '🦦',
  'Koala': '🐨',
  'Langur Monkey': '🐒',
  'Pacific Pocket Mouse': '🐁',
  'Wallaby': '🦘',
  'Avahi': '🐒',
  'Blue Whale': '🐋',
  'Gray Bat': '🦇',
  'Grey Parrot': '🦜',
  'Grizzly Bear': '🐻',
  'Mountain Zebra': '🦓',
  'Pangolin': '🦔',
  'Seal': '🦭',
  'Wombat': '🐻',
};

const rarityColors: Record<string, string> = {
  common: colors.common,
  rare: colors.rare,
  epic: colors.epic,
  legendary: colors.legendary,
};

// Habitat and fun fact data for animals
const animalDetails: Record<string, { habitat: string; funFact: string }> = {
  'Red Panda': { habitat: 'Himalayan forests of Nepal, India, Bhutan, Myanmar, and China', funFact: 'Red pandas spend most of their lives in trees and even sleep aloft.' },
  'Sea Turtle': { habitat: 'Tropical and subtropical oceans worldwide', funFact: 'Sea turtles can hold their breath for up to 7 hours while sleeping.' },
  'Penguin': { habitat: 'Antarctica and sub-Antarctic islands', funFact: 'Emperor penguins can dive to depths of 1,800 feet!' },
  'Koala': { habitat: 'Eucalyptus forests of eastern Australia', funFact: 'Koalas sleep up to 22 hours a day to conserve energy.' },
  'Flamingo': { habitat: 'Lagoons and lakes in Africa, Asia, Americas, and Europe', funFact: 'Flamingos are born gray and turn pink from eating shrimp.' },
  'Giant Panda': { habitat: 'Bamboo forests in central China mountains', funFact: 'Pandas spend 12 hours a day eating up to 38kg of bamboo.' },
  'Snow Leopard': { habitat: 'High mountains of Central Asia', funFact: 'Snow leopards can leap up to 50 feet in a single bound.' },
  'Orangutan': { habitat: 'Rainforests of Borneo and Sumatra', funFact: 'Orangutans share 97% of their DNA with humans.' },
  'Elephant': { habitat: 'Savannas, forests, and deserts of Africa and Asia', funFact: 'Elephants can recognize themselves in mirrors.' },
  'Polar Bear': { habitat: 'Arctic sea ice and tundra', funFact: 'Polar bear fur is actually transparent, not white!' },
  'Tiger': { habitat: 'Forests and grasslands of Asia', funFact: 'No two tigers have the same stripe pattern.' },
  'Gorilla': { habitat: 'Tropical forests of central Africa', funFact: 'Gorillas can learn sign language and communicate with humans.' },
  'Blue Whale': { habitat: 'All oceans except the Arctic', funFact: 'A blue whale\'s heart is the size of a small car.' },
  'Cheetah': { habitat: 'Grasslands and savannas of Africa', funFact: 'Cheetahs can accelerate from 0 to 60 mph in 3 seconds.' },
  'Rhinoceros': { habitat: 'Grasslands and tropical forests of Africa and Asia', funFact: 'Rhino horns are made of keratin, like human fingernails.' },
  'Amur Leopard': { habitat: 'Temperate forests of Far Eastern Russia', funFact: 'Only about 100 Amur leopards remain in the wild.' },
  'Vaquita': { habitat: 'Northern Gulf of California, Mexico', funFact: 'The vaquita is the world\'s rarest marine mammal.' },
  'Sumatran Rhino': { habitat: 'Tropical rainforests of Sumatra and Borneo', funFact: 'Sumatran rhinos are the smallest and hairiest of all rhino species.' },
  'Kakapo': { habitat: 'Islands of New Zealand', funFact: 'The kakapo is the only flightless parrot in the world.' },
  'Axolotl': { habitat: 'Lake Xochimilco near Mexico City', funFact: 'Axolotls can regenerate their limbs, heart, and even parts of their brain.' },
};

const conservationStatusInfo: Record<string, { color: string; description: string }> = {
  'Least Concern': { color: '#5E7F6E', description: 'Population is stable and widespread' },
  'Near Threatened': { color: '#A9BDAF', description: 'May become endangered in the near future' },
  'Vulnerable': { color: '#3B5466', description: 'High risk of extinction in the wild' },
  'Endangered': { color: '#B85C4A', description: 'Very high risk of extinction in the wild' },
  'Critically Endangered': { color: '#B85C4A', description: 'Extremely high risk of extinction' },
};

// Progress Ring Component
const ProgressRing = ({ progress, size = 80 }: { progress: number; size?: number }) => {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress * circumference);
  
  return (
    <Svg width={size} height={size}>
      <Defs>
        <SvgLinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={colors.primary} />
          <Stop offset="100%" stopColor={colors.primaryLight} />
        </SvgLinearGradient>
      </Defs>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={colors.surfaceAlt}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="url(#ringGrad)"
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
};

const generatePositions = (count: number, containerW: number, containerH: number) => {
  const positions: { left: number; bottom: number; scale: number }[] = [];
  const animalSize = 62;
  const minGap = 10;
  const padding = 10;
  const usableW = containerW - padding * 2;
  const maxBottom = containerH * 0.75;

  const cols = Math.max(2, Math.min(5, Math.floor(usableW / (animalSize + minGap))));
  const rows = Math.ceil(count / cols);
  const cellW = usableW / cols;
  const rowGap = rows > 1 ? Math.min(maxBottom / rows, animalSize + minGap) : 0;

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const itemsInRow = Math.min(cols, count - row * cols);
    const rowWidth = itemsInRow * cellW;
    const rowStart = padding + (usableW - rowWidth) / 2;
    const isOddRow = row % 2 === 1;
    const stagger = isOddRow ? cellW * 0.35 : 0;
    const centerX = rowStart + col * cellW + cellW / 2 - animalSize / 2 + stagger;
    const left = Math.max(padding, Math.min(centerX, containerW - animalSize - padding));
    const bottom = 16 + row * rowGap;
    const scale = 0.92 + Math.sin(i * 2.3) * 0.08;

    positions.push({ left, bottom, scale });
  }
  return positions;
};

const PURCHASED_ITEMS_PREFIX = 'endura_purchased_items_';
const ASSIGNMENTS_PREFIX = 'endura_item_assignments_';

interface ItemAssignment {
  itemId: string;
  x: number;
  y: number;
}

interface DraggableItemProps {
  itemId: string;
  image: ImageSourcePropType;
  startX: number;
  startY: number;
  size?: number;
  onDrop: (itemId: string, x: number, y: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

const DraggableItem = ({ itemId, image, startX, startY, size, onDrop, onDragStart, onDragEnd }: DraggableItemProps) => {
  const currentPos = useRef({ x: startX, y: startY });
  const panX = useRef(new Animated.Value(startX)).current;
  const panY = useRef(new Animated.Value(startY)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const lastGesture = useRef({ dx: 0, dy: 0 });
  const hasBeenDragged = useRef(false);
  const startPosRef = useRef({ x: startX, y: startY });

  const onDropRef = useRef(onDrop);
  const onDragStartRef = useRef(onDragStart);
  const onDragEndRef = useRef(onDragEnd);
  onDropRef.current = onDrop;
  onDragStartRef.current = onDragStart;
  onDragEndRef.current = onDragEnd;

  React.useEffect(() => {
    if (!hasBeenDragged.current && (startX !== startPosRef.current.x || startY !== startPosRef.current.y)) {
      startPosRef.current = { x: startX, y: startY };
      currentPos.current = { x: startX, y: startY };
      panX.setValue(startX);
      panY.setValue(startY);
    }
  }, [startX, startY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        lastGesture.current = { dx: 0, dy: 0 };
        onDragStartRef.current?.();
        Animated.spring(scaleAnim, { toValue: 1.15, friction: 6, useNativeDriver: false }).start();
      },
      onPanResponderMove: (_, gesture) => {
        lastGesture.current = { dx: gesture.dx, dy: gesture.dy };
        panX.setValue(currentPos.current.x + gesture.dx);
        panY.setValue(currentPos.current.y + gesture.dy);
      },
      onPanResponderRelease: () => {
        hasBeenDragged.current = true;
        const finalX = currentPos.current.x + lastGesture.current.dx;
        const finalY = currentPos.current.y + lastGesture.current.dy;
        currentPos.current = { x: finalX, y: finalY };
        Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: false }).start();
        onDragEndRef.current?.();
        onDropRef.current(itemId, finalX, finalY);
      },
      onPanResponderTerminate: () => {
        onDragEndRef.current?.();
        Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: false }).start();
      },
    })
  ).current;

  const s = size || 24;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.draggableItem,
        {
          width: s + 4,
          height: s + 4,
          opacity: opacityAnim,
          transform: [
            { translateX: panX },
            { translateY: panY },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <Image source={image} style={{ width: s, height: s }} resizeMode="contain" />
    </Animated.View>
  );
};

const getBaseItemId = (instanceId: string): string => {
  const parts = instanceId.split('__');
  return parts[0];
};

const getShopImage = (instanceId: string): any => {
  return SHOP_IMAGES[getBaseItemId(instanceId)];
};

const SHOP_IMAGES: Record<string, any> = {
  acc_tophat: require('../assets/shop/accessories/tophat.png'),
  acc_sunnies: require('../assets/shop/accessories/sunnies.png'),
  acc_crown: require('../assets/shop/accessories/crown.png'),
  acc_gradcap: require('../assets/shop/accessories/gradcap.png'),
  acc_eyemask: require('../assets/shop/accessories/eyemask.png'),
  acc_partyhat: require('../assets/shop/accessories/partyhat.png'),
  acc_halo: require('../assets/shop/accessories/halo.png'),
  acc_bow: require('../assets/shop/accessories/bow.png'),
  dec_daisy: require('../assets/shop/decorations/daisy.png'),
  dec_mushroom: require('../assets/shop/decorations/mushroom.png'),
  dec_tree: require('../assets/shop/decorations/tree.png'),
  dec_tulips: require('../assets/shop/decorations/tulips.png'),
  dec_stones: require('../assets/shop/decorations/stones.png'),
  dec_bamboo: require('../assets/shop/decorations/bamboo.png'),
};

export default function CollectionScreen() {
  const navigation = useNavigation<any>();
  const { profilePic, user } = useAuth();
  const purchasedKey = `${PURCHASED_ITEMS_PREFIX}${user?.id || 'anon'}`;
  const assignmentsKey = `${ASSIGNMENTS_PREFIX}${user?.id || 'anon'}`;
  const [myAnimals, setMyAnimals] = useState<UserAnimal[]>([]);
  const [allAnimals, setAllAnimals] = useState<Animal[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedAnimal, setSelectedAnimal] = useState<UserAnimal | null>(null);
  const [nicknameInput, setNicknameInput] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showSanctuaryModal, setShowSanctuaryModal] = useState(false);
  const [purchasedItems, setPurchasedItems] = useState<Record<string, number>>({});
  const [itemAssignments, setItemAssignments] = useState<ItemAssignment[]>([]);
  const itemAssignmentsRef = useRef<ItemAssignment[]>([]);
  const [sanctuaryContentH, setSanctuaryContentH] = useState(0);
  const sanctuaryContentHRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [communityTotal, setCommunityTotal] = useState(0);
  const [showChampionsModal, setShowChampionsModal] = useState(false);
  const [donationLeaderboard, setDonationLeaderboard] = useState<DonationLeaderboardEntry[]>([]);

  const loadPurchases = async () => {
    try {
      const raw = await AsyncStorage.getItem(purchasedKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const migrated: Record<string, number> = {};
        for (const [key, val] of Object.entries(parsed)) {
          migrated[key] = typeof val === 'number' ? (val as number) : (val ? 1 : 0);
        }
        setPurchasedItems(migrated);
      } else {
        setPurchasedItems({});
      }
    } catch (e) {}
  };

  const loadAssignments = async () => {
    try {
      const raw = await AsyncStorage.getItem(assignmentsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const valid = Array.isArray(parsed)
          ? parsed.filter((a: any) => a.itemId && typeof a.x === 'number' && typeof a.y === 'number')
          : [];
        itemAssignmentsRef.current = valid;
        setItemAssignments(valid);
        if (valid.length !== parsed.length) {
          await AsyncStorage.setItem(assignmentsKey, JSON.stringify(valid));
        }
      } else {
        itemAssignmentsRef.current = [];
        setItemAssignments([]);
      }
    } catch (e) {
      await AsyncStorage.removeItem(assignmentsKey);
    }
  };

  const handleItemDrop = useCallback(async (itemId: string, x: number, y: number) => {
    const filtered = itemAssignmentsRef.current.filter(a => a.itemId !== itemId);
    const updated = [...filtered, { itemId, x, y }];
    itemAssignmentsRef.current = updated;
    setItemAssignments(updated);
    await AsyncStorage.setItem(assignmentsKey, JSON.stringify(updated));
  }, [assignmentsKey]);

  const removeAssignment = async (itemId: string) => {
    const updated = itemAssignmentsRef.current.filter(a => a.itemId !== itemId);
    itemAssignmentsRef.current = updated;
    setItemAssignments(updated);
    await AsyncStorage.setItem(assignmentsKey, JSON.stringify(updated));
  };

  const ownedDecorationItems = Object.keys(purchasedItems)
    .filter(id => (purchasedItems[id] || 0) > 0 && SHOP_IMAGES[id])
    .flatMap(id => {
      const count = purchasedItems[id] || 0;
      return Array.from({ length: count }, (_, i) => ({
        id: i === 0 ? id : `${id}__${i}`,
        image: SHOP_IMAGES[id],
      }));
    });

  const openSanctuary = async () => {
    Analytics.sanctuaryViewed();
    setSanctuaryContentH(0);
    sanctuaryContentHRef.current = 0;
    await loadPurchases();
    await loadAssignments();
    setShowSanctuaryModal(true);
  };

  const loadData = async () => {
    try {
      loadPurchases();
      loadAssignments();
      const [myData, allData] = await Promise.all([
        animalsAPI.getMyAnimals(),
        animalsAPI.getAllAnimals(),
      ]);
      setMyAnimals(myData);
      setAllAnimals(allData);
    } catch (error) {
      console.error('Failed to load animals:', error);
    }
  };

  const fetchCommunityTotal = async () => {
    try {
      const res = await fetch(`${API_URL}/donations/community-stats`);
      if (res.ok) {
        const data = await res.json();
        setCommunityTotal(data.total_raised || 0);
      }
    } catch (e) {}
    try {
      const lb = await donationsAPI.getLeaderboard();
      setDonationLeaderboard(lb);
    } catch (e) {}
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
      fetchCommunityTotal();
    }, [])
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const openAnimalDetail = (animal: UserAnimal) => {
    setSelectedAnimal(animal);
    setNicknameInput(animal.nickname || '');
    setShowModal(true);
  };

  const saveNickname = async () => {
    if (!selectedAnimal || !nicknameInput.trim()) return;
    
    try {
      await animalsAPI.nameAnimal(selectedAnimal.id, nicknameInput.trim());
      await loadData();
      try { await badgesAPI.checkBadges(); } catch {}
      setShowModal(false);
      Alert.alert('Success', `${selectedAnimal.animal.name} is now named "${nicknameInput.trim()}"!`);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  // Count collected animals by id
  const collectedIds = new Set(myAnimals.map((a) => a.animal.id));
  const collectionProgress = collectedIds.size / Math.max(allAnimals.length, 1);

  // Group animals: one card per species, with count
  const animalCountMap = new Map<number, { userAnimal: UserAnimal; count: number }>();
  for (const ua of myAnimals) {
    const existing = animalCountMap.get(ua.animal.id);
    if (existing) {
      existing.count += 1;
      if (new Date(ua.hatched_at) > new Date(existing.userAnimal.hatched_at)) {
        existing.userAnimal = ua;
      }
    } else {
      animalCountMap.set(ua.animal.id, { userAnimal: ua, count: 1 });
    }
  }
  const groupedAnimals = Array.from(animalCountMap.values());

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={isRefreshing} 
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.titleBlack}>My Sanctuary</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => navigation.navigate('Tips')}
            >
              <Text style={styles.profileButtonEmoji}>💡</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => navigation.navigate('Profile')}
            >
              {profilePic ? (
                <Image source={{ uri: profilePic }} style={styles.profileButtonImage} />
              ) : (
                <Text style={styles.profileButtonEmoji}>👤</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Take Action CTA */}
        <TouchableOpacity
          style={styles.takeActionWrap}
          onPress={() => navigation.navigate('TakeAction')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#7BB5AD', '#2D4055']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.takeActionBtn}
          >
            <Text style={styles.takeActionEmoji}>🤝</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.takeActionTitle}>Take Action — Save Endangered Species</Text>
              <Text style={styles.takeActionSub}>
                {communityTotal > 0
                  ? `$${communityTotal.toFixed(0)} raised by our community`
                  : 'Donate to WWF and make a real difference'}
              </Text>
            </View>
            <Text style={styles.takeActionArrow}>›</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Conservation Champions Link */}
        <TouchableOpacity
          style={styles.championsLink}
          onPress={() => setShowChampionsModal(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.championsLinkIcon}>🌍</Text>
          <Text style={styles.championsLinkText}>Conservation Champions</Text>
          <Text style={styles.championsLinkArrow}>›</Text>
        </TouchableOpacity>

        {/* Animal Sanctuary */}
        {myAnimals.length > 0 && (() => {
          const previewW = SCREEN_WIDTH - spacing.lg * 2;
          const previewH = 200;
          const previewPositions = generatePositions(Math.min(myAnimals.length, 8), previewW, previewH);
          return (
            <View style={styles.sanctuarySection}>
              <Text style={styles.sanctuaryTitle}>🌿 My Animal Sanctuary</Text>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={openSanctuary}
              >
                <View style={styles.sanctuaryContainer}>
                  <View style={styles.sanctuaryLandscape}>
                    <LottieView
                      source={require('../assets/nature-landscape.json')}
                      autoPlay
                      loop
                      style={styles.sanctuaryLottie}
                      resizeMode="cover"
                    />
                  </View>
                  <View style={styles.sanctuaryAnimals}>
                    {myAnimals.slice(0, 8).map((userAnimal, index) => {
                      const imageSource = getAnimalImage(userAnimal.animal.name);
                      const pos = previewPositions[index];
                      return (
                        <View
                          key={userAnimal.id}
                          style={[
                            styles.sanctuaryAnimal,
                            { bottom: pos.bottom, left: pos.left, transform: [{ scale: pos.scale }] },
                          ]}
                        >
                          {imageSource ? (
                            <Image source={imageSource} style={styles.sanctuaryAnimalImage} />
                          ) : (
                            <Text style={styles.sanctuaryAnimalEmoji}>
                              {animalEmojis[userAnimal.animal.name] || '🦁'}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                  <View style={styles.sanctuaryGround} />
                  {myAnimals.length > 8 && (
                    <View style={styles.sanctuaryMoreBadge}>
                      <Text style={styles.sanctuaryMoreText}>+{myAnimals.length - 8} more</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={openSanctuary}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#5F8C87', '#3B5466']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.viewSanctuaryBtn}
                >
                  <Text style={styles.viewSanctuaryBtnEmoji}>🏞️</Text>
                  <Text style={styles.viewSanctuaryBtnTextWhite}>View Whole Sanctuary</Text>
                </LinearGradient>
              </TouchableOpacity>
              <Text style={styles.sanctuaryClickHint}>tap to view items</Text>
              <Text style={styles.sanctuaryCaption}>
                {myAnimals.length === 1
                  ? 'Your first friend is settling in!'
                  : `${myAnimals.length} friends roaming happily in your sanctuary`}
              </Text>

              {/* Shop Entry */}
              <TouchableOpacity
                style={styles.shopEntryBtn}
                onPress={() => navigation.navigate('Shop')}
                activeOpacity={0.8}
              >
                <Text style={styles.shopEntryEmoji}>🛒</Text>
                <View>
                  <Text style={styles.shopEntryTitle}>Sanctuary Shop</Text>
                  <Text style={styles.shopEntrySub}>Habitats, paths, accessories & more</Text>
                </View>
                <Text style={styles.shopEntryArrow}>›</Text>
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* Progress Card */}
        <LinearGradient
          colors={['#FFFFFF', '#E7EFEA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.progressCard}
        >
          <View style={styles.progressLeft}>
            <ProgressRing progress={collectionProgress} size={42} />
            <View style={styles.progressTextContainer}>
              <Text style={styles.progressPercent}>
                {Math.round(collectionProgress * 100)}%
              </Text>
            </View>
          </View>
          <View style={styles.progressRight}>
            <Text style={styles.progressLabel}>Collection Progress</Text>
            <Text style={styles.progressValue}>
              {collectedIds.size} of {allAnimals.length} species
            </Text>
          </View>
        </LinearGradient>

        {/* My Animals */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Animals</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>
              {collectedIds.size} species{myAnimals.length > collectedIds.size ? ` · ${myAnimals.length} total` : ''}
            </Text>
          </View>
        </View>

        {myAnimals.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🥚</Text>
            <Text style={styles.emptyTitle}>No Animals Yet</Text>
            <Text style={styles.emptyText}>
              Complete study sessions to earn eco-credits and hatch eggs!
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {groupedAnimals.map(({ userAnimal, count }) => {
              const imageSource = getAnimalImage(userAnimal.animal.name);
              return (
                <TouchableOpacity
                  key={userAnimal.animal.id}
                  style={[
                    styles.animalCard,
                    { borderLeftColor: rarityColors[userAnimal.animal.rarity] },
                  ]}
                  onPress={() => openAnimalDetail(userAnimal)}
                >
                  <View>
                    {imageSource ? (
                      <Image source={imageSource} style={styles.animalImage} />
                    ) : (
                      <Text style={styles.animalEmoji}>
                        {animalEmojis[userAnimal.animal.name] || '🦁'}
                      </Text>
                    )}
                    {count > 1 && (
                      <View style={styles.animalCountBadge}>
                        <Text style={styles.animalCountText}>x{count}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.animalName} numberOfLines={2}>
                    {userAnimal.nickname || userAnimal.animal.name}
                  </Text>
                  <Text style={styles.tapToNickname}>tap to nickname</Text>
                  <View
                    style={[
                      styles.rarityBadge,
                      { backgroundColor: rarityColors[userAnimal.animal.rarity] + '20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.rarityText,
                        { color: rarityColors[userAnimal.animal.rarity] },
                      ]}
                    >
                      {userAnimal.animal.rarity.toUpperCase()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* All Animals (Dex) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All Animals</Text>
        </View>
        <View style={styles.dexGrid}>
          {allAnimals.map((animal) => {
            const isCollected = collectedIds.has(animal.id);
            const imageSource = getAnimalImage(animal.name);
            return (
              <View
                key={animal.id}
                style={[
                  styles.dexCard,
                  !isCollected && styles.dexCardLocked,
                ]}
              >
                {isCollected && imageSource ? (
                  <Image source={imageSource} style={styles.dexImage} />
                ) : (
                  <Text style={[styles.dexEmoji, !isCollected && styles.dexEmojiLocked]}>
                    {isCollected ? animalEmojis[animal.name] || '🦁' : '🥚'}
                  </Text>
                )}
                {!isCollected && (
                  <View style={styles.lockOverlay}>
                    <Text style={styles.lockEmoji}>🔒</Text>
                  </View>
                )}
                <Text style={[styles.dexName, !isCollected && styles.dexNameLocked]} numberOfLines={2}>
                  {isCollected ? animal.name : '???'}
                </Text>
                {isCollected && (
                  <View
                    style={[
                      styles.dexRarityDot,
                      { backgroundColor: rarityColors[animal.rarity] },
                    ]}
                  />
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Animal Detail Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView 
            style={styles.modalScrollView}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <LinearGradient
              colors={['#FFFFFF', '#E7EFEA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.modalContent}
            >
              {selectedAnimal && (
                <>
                  <View style={styles.modalHeader}>
                    <TouchableOpacity
                      style={styles.closeButton}
                      onPress={() => setShowModal(false)}
                    >
                      <Text style={styles.closeButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.modalAnimalContainer}>
                    {getAnimalImage(selectedAnimal.animal.name) ? (
                      <Image 
                        source={getAnimalImage(selectedAnimal.animal.name)} 
                        style={styles.modalImage} 
                      />
                    ) : (
                      <Text style={styles.modalEmoji}>
                        {animalEmojis[selectedAnimal.animal.name] || '🦁'}
                      </Text>
                    )}
                  </View>
                  
                  <Text style={styles.modalTitle}>
                    {selectedAnimal.nickname || selectedAnimal.animal.name}
                  </Text>
                  <Text style={styles.modalSpecies}>
                    {selectedAnimal.animal.species}
                  </Text>
                  
                  <View
                    style={[
                      styles.modalRarity,
                      { backgroundColor: rarityColors[selectedAnimal.animal.rarity] },
                    ]}
                  >
                    <Text style={styles.modalRarityText}>
                      {selectedAnimal.animal.rarity.toUpperCase()}
                    </Text>
                  </View>

                  {/* Nickname Section */}
                  <View style={styles.nicknameSection}>
                    <Text style={styles.nicknameLabel}>Give a Nickname</Text>
                    <View style={styles.nicknameRow}>
                      <TextInput
                        style={styles.nicknameInput}
                        placeholder="Enter nickname..."
                        placeholderTextColor={colors.textMuted}
                        value={nicknameInput}
                        onChangeText={setNicknameInput}
                        maxLength={20}
                      />
                      <TouchableOpacity
                        style={styles.saveButton}
                        onPress={saveNickname}
                      >
                        <Text style={styles.saveButtonText}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Conservation Status Section */}
                  <View style={styles.infoSection}>
                    <View style={styles.infoSectionHeader}>
                      <Text style={styles.infoSectionIcon}>🌍</Text>
                      <Text style={styles.infoSectionTitle}>Conservation Status</Text>
                    </View>
                    <View style={[
                      styles.statusBadge, 
                      { backgroundColor: conservationStatusInfo[selectedAnimal.animal.conservation_status || '']?.color || colors.textMuted }
                    ]}>
                      <Text style={styles.statusBadgeText}>
                        {selectedAnimal.animal.conservation_status || 'Unknown'}
                      </Text>
                    </View>
                    <Text style={styles.infoSectionText}>
                      {conservationStatusInfo[selectedAnimal.animal.conservation_status || '']?.description || 
                        'Help protect this species by learning more about conservation efforts.'}
                    </Text>
                  </View>

                  {/* Habitat Section */}
                  <View style={styles.infoSection}>
                    <View style={styles.infoSectionHeader}>
                      <Text style={styles.infoSectionIcon}>🏔️</Text>
                      <Text style={styles.infoSectionTitle}>Habitat</Text>
                    </View>
                    <Text style={styles.infoSectionText}>
                      {animalDetails[selectedAnimal.animal.name]?.habitat || 
                        'Various ecosystems around the world'}
                    </Text>
                  </View>

                  {/* Fun Fact Section */}
                  <LinearGradient
                    colors={['rgba(168, 200, 216, 0.2)', '#E7EFEA']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.funFactSection}
                  >
                    <View style={styles.infoSectionHeader}>
                      <Text style={styles.infoSectionIcon}>💡</Text>
                      <Text style={styles.infoSectionTitle}>Fun Fact</Text>
                    </View>
                    <Text style={styles.funFactText}>
                      {animalDetails[selectedAnimal.animal.name]?.funFact || 
                        selectedAnimal.animal.description || 
                        'This amazing creature is part of your collection!'}
                    </Text>
                  </LinearGradient>

                </>
              )}
            </LinearGradient>
          </ScrollView>
        </View>
      </Modal>

      {/* Full Sanctuary Modal */}
      <Modal visible={showSanctuaryModal} transparent animationType="fade">
        <View style={styles.sanctuaryModalOverlay}>
          <View style={styles.sanctuaryModalContent}>
            {/* Header */}
            <View
              style={[styles.sanctuaryModalHeader, { backgroundColor: '#FFFFFF' }]}
            >
              <View>
                <Text style={styles.sanctuaryModalTitle}>🌿 Your Sanctuary</Text>
                <Text style={styles.sanctuaryModalSub}>
                  {myAnimals.length} {myAnimals.length === 1 ? 'friend' : 'friends'} living here
                </Text>
              </View>
              <TouchableOpacity
                style={styles.sanctuaryModalClose}
                onPress={() => setShowSanctuaryModal(false)}
              >
                <Text style={styles.sanctuaryModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Scrollable scene + tray wrapper */}
            <ScrollView
              style={styles.sanctuaryScroll}
              contentContainerStyle={styles.sanctuaryScrollContent}
              scrollEnabled={!isDragging}
              showsVerticalScrollIndicator={true}
              bounces={false}
            >
              <View
                style={styles.sanctuaryDragWrapper}
                onLayout={(e: LayoutChangeEvent) => {
                  const h = e.nativeEvent.layout.height;
                  sanctuaryContentHRef.current = h;
                  if (sanctuaryContentH === 0 || Math.abs(h - sanctuaryContentH) > 5) {
                    setSanctuaryContentH(h);
                  }
                }}
              >
                {/* Landscape Scene */}
                {(() => {
                  const modalW = SCREEN_WIDTH - 20 - spacing.sm * 2;
                  const cols = Math.max(2, Math.min(5, Math.floor((modalW - 20) / (62 + 10))));
                  const rows = Math.ceil(myAnimals.length / cols);
                  const sceneH = Math.max(SCREEN_HEIGHT * 0.65, rows * 72 + 80);
                  return (
                    <View style={[styles.sanctuaryModalScene, { height: sceneH }]}>
                      <View style={styles.sanctuaryModalLandscapeBg}>
                        <LottieView
                          source={require('../assets/nature-landscape.json')}
                          autoPlay
                          loop
                          style={styles.sanctuaryModalLottie}
                          resizeMode="cover"
                        />
                      </View>

                      {/* Animals */}
                      <View style={styles.sanctuaryModalAnimals}>
                        {(() => {
                          const positions = generatePositions(myAnimals.length, modalW, sceneH);
                          return myAnimals.map((userAnimal, index) => {
                            const imageSource = getAnimalImage(userAnimal.animal.name);
                            const pos = positions[index];
                            return (
                              <View
                                key={userAnimal.id}
                                style={[
                                  styles.sanctuaryModalAnimal,
                                  { bottom: pos.bottom, left: pos.left, transform: [{ scale: pos.scale }] },
                                ]}
                              >
                                {imageSource ? (
                                  <Image source={imageSource} style={styles.sanctuaryModalAnimalImg} />
                                ) : (
                                  <Text style={styles.sanctuaryModalAnimalEmoji}>
                                    {animalEmojis[userAnimal.animal.name] || '🦁'}
                                  </Text>
                                )}
                                <View style={styles.sanctuaryModalNameTag}>
                                  <Text style={styles.sanctuaryModalNameText} numberOfLines={1}>
                                    {userAnimal.nickname || userAnimal.animal.name.split(' ').pop()}
                                  </Text>
                                </View>
                              </View>
                            );
                          });
                        })()}
                      </View>

                      <View style={styles.sanctuaryModalGround} />
                    </View>
                  );
                })()}

                {/* White item tray footer */}
                {ownedDecorationItems.length > 0 && (
                  <View style={styles.itemTrayFooter}>
                    <Text style={styles.itemTrayLabel}>Drag items!</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.itemTrayRow}>
                      {ownedDecorationItems.map((item) => {
                        const isPlaced = itemAssignments.some(a => a.itemId === item.id);
                        return (
                          <View key={item.id} style={[styles.itemTraySlot, isPlaced && styles.itemTraySlotEmpty]}>
                            {!isPlaced && (
                              <Image source={item.image} style={styles.itemTraySlotImg} resizeMode="contain" />
                            )}
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* Draggable items — absolutely positioned over the whole wrapper */}
                {sanctuaryContentH > 0 && (() => {
                  const trayTopY = sanctuaryContentHRef.current - 50;
                  const trayPadLeft = spacing.md + spacing.sm;
                  const slotSize = 50;
                  let unplacedIdx = 0;
                  return ownedDecorationItems.map((item) => {
                    const existing = itemAssignments.find(a => a.itemId === item.id);
                    const isDecoration = getBaseItemId(item.id).startsWith('dec_');
                    let spawnX: number;
                    let spawnY: number;
                    if (existing) {
                      spawnX = existing.x;
                      spawnY = existing.y;
                    } else {
                      spawnX = trayPadLeft + unplacedIdx * slotSize;
                      spawnY = trayTopY;
                      unplacedIdx++;
                    }
                    return (
                      <DraggableItem
                        key={item.id}
                        itemId={item.id}
                        image={item.image}
                        size={isDecoration ? 40 : 24}
                        startX={spawnX}
                        startY={spawnY}
                        onDrop={handleItemDrop}
                        onDragStart={() => setIsDragging(true)}
                        onDragEnd={() => setIsDragging(false)}
                      />
                    );
                  });
                })()}
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.sanctuaryModalFooter}>
              <TouchableOpacity
                onPress={() => setShowSanctuaryModal(false)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#5F8C87', '#3B5466']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sanctuaryModalDoneBtn}
                >
                  <Text style={styles.sanctuaryModalDoneBtnText}>Close Sanctuary</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Conservation Champions Modal */}
      <Modal visible={showChampionsModal} transparent animationType="slide">
        <View style={styles.championsOverlay}>
          <View style={styles.championsContent}>
            <View style={styles.championsHeader}>
              <View>
                <Text style={styles.championsTitle}>🌍 Conservation Champions</Text>
                <Text style={styles.championsSub}>Ranked by total donations to WWF</Text>
              </View>
              <TouchableOpacity
                style={styles.championsClose}
                onPress={() => setShowChampionsModal(false)}
              >
                <Text style={styles.championsCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.championsScroll}
            >
              {donationLeaderboard.length === 0 ? (
                <View style={styles.championsEmpty}>
                  <Text style={{ fontSize: 48, marginBottom: 12 }}>💚</Text>
                  <Text style={styles.championsEmptyText}>No donations yet.</Text>
                  <Text style={styles.championsEmptySub}>Be the first to donate and lead the board!</Text>
                  <TouchableOpacity
                    style={styles.championsDonateBtn}
                    onPress={() => { setShowChampionsModal(false); navigation.navigate('TakeAction'); }}
                  >
                    <Text style={styles.championsDonateBtnText}>Donate Now</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                donationLeaderboard.map((entry) => (
                  <View
                    key={entry.user_id}
                    style={[
                      styles.championsRow,
                      entry.is_current_user && styles.championsRowMe,
                    ]}
                  >
                    <Text style={styles.championsRank}>
                      {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                    </Text>
                    <View style={styles.championsInfo}>
                      <Text style={styles.championsName}>
                        {entry.username}{entry.is_current_user ? ' (You)' : ''}
                      </Text>
                      <Text style={styles.championsStats}>
                        {entry.donation_count} donation{entry.donation_count !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Text style={styles.championsAmount}>${entry.total_donated.toFixed(0)}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.championsFooterBtn}
              onPress={() => { setShowChampionsModal(false); navigation.navigate('TakeAction'); }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#2F4A3E', '#1A2F26']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.championsFooterGradient}
              >
                <Text style={styles.championsFooterText}>💚 Donate & Climb the Leaderboard</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  titleWhite: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  titleBlack: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.small,
  },
  profileButtonEmoji: {
    fontSize: 22,
  },
  profileButtonImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  takeActionWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    shadowColor: '#2F4A3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  takeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  takeActionEmoji: {
    fontSize: 28,
  },
  takeActionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  takeActionSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    marginTop: 3,
  },
  takeActionArrow: {
    fontSize: 26,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.7)',
  },
  championsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    marginBottom: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    ...shadows.small,
  },
  championsLinkIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  championsLinkText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  championsLinkArrow: {
    fontSize: 22,
    fontWeight: '300',
    color: colors.textMuted,
  },
  championsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  championsContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.lg,
    paddingBottom: 36,
    maxHeight: '75%',
  },
  championsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  championsTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  championsSub: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  championsClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F4F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  championsCloseText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  championsScroll: {
    paddingHorizontal: spacing.lg,
  },
  championsEmpty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  championsEmptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  championsEmptySub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 20,
  },
  championsDonateBtn: {
    backgroundColor: '#2F4A3E',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  championsDonateBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  championsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F2',
  },
  championsRowMe: {
    backgroundColor: '#E7EFEA',
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    borderBottomWidth: 0,
    marginBottom: 4,
  },
  championsRank: {
    fontSize: 22,
    width: 40,
    textAlign: 'center',
  },
  championsInfo: {
    flex: 1,
    marginLeft: 8,
  },
  championsName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  championsStats: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
    marginTop: 1,
  },
  championsAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2F4A3E',
  },
  championsFooterBtn: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: 14,
    overflow: 'hidden',
  },
  championsFooterGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
  },
  championsFooterText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  progressCard: {
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  progressLeft: {
    position: 'relative',
    marginRight: 10,
  },
  progressTextContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  progressRight: {
    flex: 1,
  },
  progressLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
    fontWeight: '600',
  },
  progressValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  progressHint: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  sanctuarySection: {
    marginBottom: spacing.lg,
  },
  sanctuaryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  sanctuaryContainer: {
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E7EFEA',
  },
  sanctuaryLandscape: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sanctuaryLottie: {
    width: '100%',
    height: 300,
    position: 'absolute',
    top: -80,
    left: 0,
  },
  sanctuaryAnimals: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sanctuaryAnimal: {
    position: 'absolute',
  },
  sanctuaryAnimalImage: {
    width: 56,
    height: 56,
  },
  sanctuaryAnimalEmoji: {
    fontSize: 38,
  },
  sanctuaryGround: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 12,
    backgroundColor: 'rgba(76, 145, 80, 0.15)',
  },
  sanctuaryMoreBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sanctuaryMoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  viewSanctuaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    gap: 6,
  },
  viewSanctuaryBtnEmoji: {
    fontSize: 16,
  },
  viewSanctuaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  viewSanctuaryBtnTextWhite: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sanctuaryClickHint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    fontStyle: 'italic',
  },
  sanctuaryCaption: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
  // Full Sanctuary Modal
  sanctuaryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingTop: 44,
    paddingBottom: 24,
  },
  sanctuaryModalContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
  },
  sanctuaryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sanctuaryModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sanctuaryModalSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  sanctuaryModalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sanctuaryModalCloseText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  sanctuaryScroll: {
    flex: 1,
  },
  sanctuaryScrollContent: {
    flexGrow: 1,
  },
  sanctuaryDragWrapper: {
    position: 'relative',
  },
  sanctuaryModalScene: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#A9BDAF',
    marginHorizontal: spacing.sm,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sanctuaryModalLandscapeBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sanctuaryModalLottie: {
    width: '100%',
    height: '160%',
    position: 'absolute',
    top: '-55%' as any,
    left: 0,
  },
  sanctuaryModalCloud1: {
    position: 'absolute',
    top: 12,
    left: '15%',
    fontSize: 28,
    opacity: 0.5,
  } as any,
  sanctuaryModalCloud2: {
    position: 'absolute',
    top: 22,
    right: '12%',
    fontSize: 22,
    opacity: 0.4,
  } as any,
  sanctuaryModalSun: {
    position: 'absolute',
    top: 8,
    right: '35%',
    fontSize: 32,
    opacity: 0.6,
  } as any,
  sanctuaryModalAnimals: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sanctuaryModalAnimal: {
    position: 'absolute',
    alignItems: 'center',
  },
  sanctuaryModalAnimalImg: {
    width: 58,
    height: 58,
  },
  sanctuaryModalAnimalEmoji: {
    fontSize: 36,
  },
  sanctuaryModalNameTag: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 2,
    maxWidth: 70,
  },
  sanctuaryModalNameText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sanctuaryModalGround: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: 'rgba(76, 145, 80, 0.12)',
  },
  decorationRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    zIndex: 3,
  },
  decorationImg: {
    position: 'absolute',
    width: 42,
    height: 42,
  },
  decorationRowPreview: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    zIndex: 3,
  },
  decorationImgPreview: {
    position: 'absolute',
    width: 32,
    height: 32,
  },
  shopEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.sm,
  },
  shopEntryEmoji: {
    fontSize: 26,
  },
  shopEntryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  shopEntrySub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  shopEntryArrow: {
    fontSize: 24,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
  sanctuaryModalFooter: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  sanctuaryModalFooterText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  sanctuaryModalDoneBtn: {
    paddingVertical: 12,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.full,
    width: '100%',
    alignItems: 'center',
  },
  sanctuaryModalDoneBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  placedItemPreview: {
    width: 20,
    height: 20,
    position: 'absolute',
    zIndex: 10,
  },
  draggableItem: {
    position: 'absolute',
    zIndex: 100,
    width: 28,
    height: 28,
  },
  draggableItemImg: {
    width: 24,
    height: 24,
  },
  itemTrayFooter: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.sm,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder + '80',
  },
  itemTrayLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  itemTrayRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    flexGrow: 1,
    gap: 8,
  },
  itemTraySlot: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.cardBorder + '30',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.cardBorder + '80',
    borderStyle: 'dashed' as any,
  },
  itemTraySlotEmpty: {
    borderColor: colors.cardBorder + '40',
    backgroundColor: 'transparent',
    opacity: 0.4,
  },
  itemTraySlotImg: {
    width: 28,
    height: 28,
    opacity: 0.3,
  },
  itemTrayItem: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
  },
  itemTrayItemAssigned: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  itemTrayImg: {
    width: 34,
    height: 34,
  },
  itemTrayCheck: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTrayCheckText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  countBadge: {
    marginLeft: spacing.sm,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  animalCard: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderLeftWidth: 4,
    ...shadows.small,
  },
  animalEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  animalImage: {
    width: 70,
    height: 70,
    marginBottom: spacing.sm,
  },
  animalName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
    textAlign: 'center',
    lineHeight: 15,
  },
  animalCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  animalCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  tapToNickname: {
    fontSize: 10,
    fontStyle: 'italic',
    color: colors.textMuted,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  rarityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  rarityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  dexGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: spacing.xl,
  },
  dexCard: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    position: 'relative',
  },
  dexCardLocked: {
    opacity: 0.5,
    backgroundColor: colors.surfaceAlt,
  },
  dexEmoji: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  dexImage: {
    width: 45,
    height: 45,
    marginBottom: spacing.xs,
  },
  dexEmojiLocked: {
    opacity: 0.6,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockEmoji: {
    fontSize: 20,
    marginTop: -8,
  },
  dexName: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 13,
  },
  dexNameLocked: {
    color: colors.textMuted,
  },
  dexRarityDot: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalScrollView: {
    maxHeight: '90%',
  },
  modalScrollContent: {
    flexGrow: 1,
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl + 20,
    width: '100%',
    alignItems: 'center',
  },
  modalHeader: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  modalAnimalContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalEmoji: {
    fontSize: 64,
  },
  modalImage: {
    width: 120,
    height: 120,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  modalSpecies: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  modalRarity: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  modalRarityText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textOnPrimary,
    letterSpacing: 0.5,
  },
  modalStatus: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  modalDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  nicknameSection: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  nicknameLabel: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  nicknameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nicknameInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  // Info sections
  infoSection: {
    width: '100%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoSectionIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  infoSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  infoSectionText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  funFactSection: {
    width: '100%',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  funFactText: {
    fontSize: 14,
    color: colors.primaryDark,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
