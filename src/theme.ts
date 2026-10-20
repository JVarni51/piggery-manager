import { Platform, StyleSheet } from 'react-native';

export const colors = {
  ink: '#1B2430',
  inkRaised: '#243044',
  cream: '#F3EEE4',
  paper: '#FBF7F1',
  card: '#FFFFFF',
  line: '#E4D8C8',
  copper: '#C4622D',
  copperDark: '#8C4318',
  moss: '#2C6B4F',
  clay: '#9C3B32',
  gold: '#A9792E',
  text: '#1C2430',
  muted: '#6F675E',
  male: '#2C5F8A',
  female: '#A3476A',
  white: '#FFFFFF',
};

export const serif = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia, "Iowan Old Style", Palatino, serif',
}) as string;

export const sans = Platform.select({
  ios: 'Avenir Next',
  android: 'sans-serif',
  default: '"Avenir Next", "Segoe UI", sans-serif',
}) as string;

export const ui = StyleSheet.create({
  h1: { fontFamily: serif, fontSize: 32, color: colors.text, letterSpacing: -0.4 },
  h2: { fontFamily: serif, fontSize: 22, color: colors.text },
  body: { fontFamily: sans, fontSize: 16, color: colors.text, lineHeight: 22 },
  small: { fontFamily: sans, fontSize: 13, color: colors.muted, lineHeight: 18 },
  label: { fontFamily: sans, fontSize: 13, color: colors.muted, fontWeight: '600', marginBottom: 6 },
});
