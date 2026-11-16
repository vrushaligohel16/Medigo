import { forwardRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Colors } from '@/constants/colors';

type InputFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

export const InputField = forwardRef<TextInput, InputFieldProps>(
  function InputField({ label, error, style, ...props }, ref) {
    return (
      <View style={styles.wrapper}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          ref={ref}
          placeholderTextColor={Colors.textSecondary}
          style={[styles.input, error ? styles.inputError : null, style]}
          {...props}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  input: {
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  inputError: {
    borderColor: Colors.error,
  },
  error: {
    fontSize: 13,
    color: Colors.error,
  },
});
