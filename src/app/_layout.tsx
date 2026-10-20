import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HerdProvider } from '@/data/context';
import { Shell } from '@/components/Shell';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <HerdProvider>
        <Shell>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }} />
        </Shell>
      </HerdProvider>
    </SafeAreaProvider>
  );
}
