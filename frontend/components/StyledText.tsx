import React from 'react';
import {
  Text as RNText,
  TextInput as RNTextInput,
  TextProps,
  TextInputProps,
  StyleSheet,
} from 'react-native';

const WEIGHT_MAP: Record<string, string> = {
  '300': 'DMSans_300Light',
  light: 'DMSans_300Light',
  '400': 'DMSans_400Regular',
  normal: 'DMSans_400Regular',
  '500': 'DMSans_500Medium',
  medium: 'DMSans_500Medium',
  '600': 'DMSans_600SemiBold',
  semibold: 'DMSans_600SemiBold',
  '700': 'DMSans_700Bold',
  bold: 'DMSans_700Bold',
  '800': 'DMSans_800ExtraBold',
  '900': 'DMSans_800ExtraBold',
};

function resolve(style: any): string {
  const flat = StyleSheet.flatten(style) || {};
  if (flat.fontFamily) return flat.fontFamily;
  return WEIGHT_MAP[String(flat.fontWeight || '400')] || 'DMSans_400Regular';
}

export const Text = React.forwardRef<any, TextProps>((props, ref) => (
  <RNText {...props} ref={ref} style={[props.style, { fontFamily: resolve(props.style) }]} />
));

export const TextInput = React.forwardRef<any, TextInputProps>((props, ref) => (
  <RNTextInput {...props} ref={ref} style={[props.style, { fontFamily: resolve(props.style) }]} />
));
