import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

type TagsInputProps = {
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
};

export function TagsInput({
  label,
  value,
  onChange,
  placeholder = 'Type and press Add',
}: TagsInputProps) {
  const [draft, setDraft] = useState('');

  const addTag = () => {
    const next = draft.trim();
    if (!next) {
      return;
    }
    if (value.some((tag) => tag.toLowerCase() === next.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...value, next]);
    setDraft('');
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((item) => item !== tag));
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          placeholderTextColor={Colors.textSecondary}
          style={styles.input}
          onSubmitEditing={addTag}
          returnKeyType="done"
        />
        <Pressable onPress={addTag} style={styles.addButton}>
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>
      {value.length > 0 ? (
        <View style={styles.tags}>
          {value.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
              <Pressable onPress={() => removeTag(tag)} hitSlop={8}>
                <Ionicons name="close" size={14} color={Colors.primary} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  addButton: {
    borderRadius: 14,
    backgroundColor: Colors.mint,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  addButtonText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.mint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
});
