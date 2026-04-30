import React from 'react';
import { View, StyleSheet, Linking, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './StyledText';
import { colors, shadows, spacing } from '../theme/colors';
import type { ClientConfigPayload } from '../services/clientConfig';
import { storeUrlForPlatform } from '../services/clientConfig';

type Props = {
  config: ClientConfigPayload;
};

export default function ForceUpdateScreen({ config }: Props) {
  const url = storeUrlForPlatform(config);
  const body =
    config.update_message ||
    'A newer version of Endura is required to continue. Update from the store to keep studying with the latest fixes.';

  return (
    <LinearGradient
      colors={['#E7EFEA', '#D4E8E4', '#C5DFD8']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.card}>
          <Text style={styles.emoji}>📲</Text>
          <Text style={styles.title}>Update Endura</Text>
          <Text style={styles.body}>{body}</Text>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => Linking.openURL(url)}
          >
            <Text style={styles.buttonText}>
              {Platform.OS === 'android' ? 'Open in Play Store' : 'Open in App Store'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.xl,
    ...shadows.medium,
  },
  emoji: { fontSize: 48, textAlign: 'center', marginBottom: spacing.md },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.88 },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 17,
    fontWeight: '600',
  },
});
