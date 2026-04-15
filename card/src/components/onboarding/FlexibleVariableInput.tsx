import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface FlexibleVariableInputProps {
  visible: boolean;
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  onCancel: () => void;
  onSubmit: (value: number) => void;
}

export default function FlexibleVariableInput({
  visible,
  title,
  confirmLabel,
  cancelLabel,
  onCancel,
  onSubmit,
}: FlexibleVariableInputProps) {
  const [value, setValue] = useState('0');

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={styles.input}
            value={value}
            keyboardType="number-pad"
            onChangeText={setValue}
            maxLength={2}
          />
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.secondary]} onPress={onCancel}>
              <Text style={styles.secondaryTxt}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => {
                const parsed = Number(value);
                onSubmit(Number.isFinite(parsed) ? parsed : 0);
              }}
            >
              <Text style={styles.primaryTxt}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  box: {
    width: '100%',
    maxWidth: 310,
    borderRadius: 14,
    backgroundColor: '#111827',
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  title: { color: '#F9FAFB', fontSize: 16, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 10,
    color: '#fff',
    fontSize: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  btn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#22C55E' },
  secondary: { backgroundColor: 'rgba(255,255,255,0.12)' },
  primaryTxt: { color: '#05131b', fontWeight: '800' },
  secondaryTxt: { color: '#E5E7EB', fontWeight: '700' },
});
