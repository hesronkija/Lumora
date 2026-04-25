import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomeScreen } from './src/screens/HomeScreen';
import { FeesScreen } from './src/screens/FeesScreen';
import type { Locale } from '@lumora/shared-i18n';
import { t } from '@lumora/shared-i18n';

const Tab = createBottomTabNavigator();
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5 * 60 * 1000 }, // 5 min stale
  },
});

// Auth state would come from MMKV-persisted token in production
const DEV_CONFIG = {
  apiBaseUrl: process.env['API_BASE_URL'] ?? 'http://10.0.2.2:3000/api',
  authToken: process.env['DEV_AUTH_TOKEN'] ?? '',
  locale: 'en-TZ' as Locale,
};

export default function App() {
  const [locale] = useState<Locale>(DEV_CONFIG.locale);

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            tabBarActiveTintColor: '#2563eb',
            tabBarInactiveTintColor: '#9ca3af',
            headerStyle: { backgroundColor: '#1a1a2e' },
            headerTintColor: '#fff',
          }}
        >
          <Tab.Screen
            name="Home"
            options={{ title: t(locale, 'parent.myChildren') }}
          >
            {() => <HomeScreen locale={locale} authToken={DEV_CONFIG.authToken} apiBaseUrl={DEV_CONFIG.apiBaseUrl} />}
          </Tab.Screen>

          <Tab.Screen
            name="Fees"
            options={{ title: t(locale, 'parent.fees') }}
          >
            {(props) => (
              <FeesScreen
                childId={(props.route.params as { childId?: string })?.childId ?? ''}
                locale={locale}
                authToken={DEV_CONFIG.authToken}
                apiBaseUrl={DEV_CONFIG.apiBaseUrl}
              />
            )}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </QueryClientProvider>
  );
}
