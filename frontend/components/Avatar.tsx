import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Text } from './StyledText';

const PALETTE = [
  '#5F8C87', '#4A7C59', '#3B5466', '#6B8F71',
  '#7B9E87', '#8A7BAB', '#B07D62', '#4E7A8A',
];

function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number;
  style?: object;
  fontSize?: number;
}

export default function Avatar({ uri, name, size = 48, style, fontSize }: AvatarProps) {
  const initial = (name || '?')[0].toUpperCase();
  const bg = colorFromName(name || '?');
  const textSize = fontSize ?? Math.round(size * 0.38);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      />
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          justifyContent: 'center',
          alignItems: 'center',
        },
        style,
      ]}
    >
      <Text style={{ color: '#fff', fontSize: textSize, fontWeight: '700', letterSpacing: 0.5 }}>
        {initial}
      </Text>
    </View>
  );
}
