import { Pressable, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { ms, fs } from '@/utils/scaling';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'warning';
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

export const Button = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  textStyle,
  testID,
}: ButtonProps) => {
  const getButtonStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.buttonSecondary;
      case 'danger':
        return styles.buttonDanger;
      case 'warning':
        return styles.buttonWarning;
      default:
        return styles.buttonPrimary;
    }
  };

  return (
    <Pressable
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        getButtonStyle(),
        disabled && styles.buttonDisabled,
        pressed && styles.buttonPressed,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled, textStyle]}>
        {title}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: ms(14),
    paddingHorizontal: ms(24),
    borderRadius: ms(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#4CAF50',
  },
  buttonSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  buttonDanger: {
    backgroundColor: '#F44336',
  },
  buttonWarning: {
    backgroundColor: '#FF9800',
  },
  buttonDisabled: {
    backgroundColor: '#555',
    opacity: 0.5,
  },
  buttonText: {
    fontSize: fs(16),
    fontWeight: 'bold',
    color: '#fff',
  },
  buttonTextDisabled: {
    color: '#888',
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
