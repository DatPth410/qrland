import React, { Suspense } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

// Bundle-split the three.js / WebGPU code so it only runs in client environments.
const QRApp = React.lazy(() =>
  import("@/ui/QRApp").then((m) => ({ default: m.QRApp })),
);

export default function Page() {
  return (
    <Suspense
      fallback={
        <View style={styles.loading}>
          <ActivityIndicator animating />
        </View>
      }
    >
      <QRApp />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fbeef1" },
});
