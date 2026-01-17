import React from 'react';
import { StyleSheet, View, ViewStyle, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenWrapperProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** SafeAreaViewを使わない場合（戦闘画面など全画面表示時） */
  noSafeArea?: boolean;
  /** 背景色を変更する場合 */
  backgroundColor?: string;
  /** 特定のエッジのみSafeAreaを適用（デフォルトは全エッジ） */
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

const DEFAULT_BACKGROUND = '#1a1a2e';

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({
  children,
  style,
  noSafeArea = false,
  backgroundColor = DEFAULT_BACKGROUND,
  edges = ['top', 'bottom', 'left', 'right'],
}) => {
  const containerStyle = [
    styles.container,
    { backgroundColor },
    style,
  ];

  if (noSafeArea) {
    return (
      <View style={containerStyle}>
        <StatusBar barStyle="light-content" backgroundColor={backgroundColor} />
        {children}
      </View>
    );
  }

  return (
    <SafeAreaView style={containerStyle} edges={edges}>
      <StatusBar barStyle="light-content" backgroundColor={backgroundColor} />
      {children}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default ScreenWrapper;
