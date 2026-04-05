import { TextStyle } from 'react-native';

export const fontFamily = {
  light: 'DMSans_300Light',
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semiBold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
  extraBold: 'DMSans_800ExtraBold',
};

export function dmFont(weight: TextStyle['fontWeight'] = '400'): { fontFamily: string } {
  const w = String(weight);
  if (w === '300' || w === 'light') return { fontFamily: fontFamily.light };
  if (w === '500' || w === 'medium') return { fontFamily: fontFamily.medium };
  if (w === '600' || w === 'semibold') return { fontFamily: fontFamily.semiBold };
  if (w === '700' || w === 'bold') return { fontFamily: fontFamily.bold };
  if (w === '800' || w === '900') return { fontFamily: fontFamily.extraBold };
  return { fontFamily: fontFamily.regular };
}
