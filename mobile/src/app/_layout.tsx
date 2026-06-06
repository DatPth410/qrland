import { Stack } from "expo-router";

export { ErrorBoundary } from "expo-router";

// Full-screen, immersive 3D — no navigation chrome.
export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
