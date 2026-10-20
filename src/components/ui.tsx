import { createElement, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, sans, serif, ui } from '@/theme';
import { PopMenu } from './popMenu';

export function useNarrow() {
  const { width } = useWindowDimensions();
  return { width, narrow: width < 760, compact: width < 980 };
}

export function Page({
  title,
  lede,
  action,
  children,
}: {
  title: string;
  lede?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const { narrow } = useNarrow();
  return (
    <ScrollView contentContainerStyle={[styles.page, narrow && { paddingBottom: 32 }]}>
      <View style={[styles.titleRow, narrow && { flexDirection: 'column', alignItems: 'stretch' }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={ui.h1}>{title}</Text>
          {lede ? <Text style={ui.small}>{lede}</Text> : null}
        </View>
        {action}
      </View>
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  tone = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'primary' && { backgroundColor: colors.copper },
        tone === 'secondary' && { backgroundColor: colors.ink },
        tone === 'ghost' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
        tone === 'danger' && { backgroundColor: colors.clay },
        (pressed || disabled) && { opacity: disabled ? 0.45 : 0.85 },
      ]}
    >
      <Text style={[styles.buttonText, tone === 'ghost' && { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'good' | 'bad' | 'warn' | 'info' }) {
  const background =
    tone === 'good' ? '#E5F2EA' : tone === 'bad' ? '#F8E6E3' : tone === 'warn' ? '#F8EFDA' : tone === 'info' ? '#E6EEF5' : '#F3EEE6';
  const color = tone === 'good' ? colors.moss : tone === 'bad' ? colors.clay : tone === 'warn' ? colors.gold : tone === 'info' ? colors.male : colors.text;
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={{ color, fontFamily: sans, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Notice({ text, tone = 'info' }: { text: string; tone?: 'info' | 'warn' | 'bad' | 'good' }) {
  const background = tone === 'bad' ? '#F8E6E3' : tone === 'warn' ? '#F8EFDA' : tone === 'good' ? '#E5F2EA' : '#E6EEF5';
  return (
    <View style={[styles.notice, { backgroundColor: background }]}>
      <Text style={ui.body}>{text}</Text>
    </View>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={ui.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#A3988C"
        multiline={multiline}
        accessibilityLabel={label}
        style={[styles.input, multiline && { minHeight: 96, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={ui.label}>{label}</Text>
      {Platform.OS === 'web' ? (
        createElement('input', {
          type: 'date',
          value,
          'aria-label': label,
          onChange: (event: { target: { value: string } }) => onChange(event.target.value),
          style: webDate,
        })
      ) : (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="YYYY-MM-DD"
          accessibilityLabel={label}
          style={styles.input}
        />
      )}
    </View>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder = 'Choose',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const { narrow } = useNarrow();
  const anchor = useRef<{ getBoundingClientRect?: () => { bottom: number; left: number; width: number } } | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const current = options.find((option) => option.value === value);
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));
  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };
  useEffect(() => {
    if (!open || narrow || Platform.OS !== 'web') return;
    const place = () => {
      const node = anchor.current as unknown as { getBoundingClientRect?: () => { bottom: number; left: number; width: number } } | null;
      const rect = node?.getBoundingClientRect?.();
      if (!rect) return;
      setBox({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 180) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, narrow]);
  const list = (
    <ScrollView style={{ maxHeight: narrow ? 420 : 260 }} keyboardShouldPersistTaps="handled">
      {filtered.map((option) => (
        <Pressable key={option.value || 'empty'} accessibilityRole="button" onPress={() => choose(option.value)} style={styles.option}>
          <Text style={[ui.body, option.value === value && { color: colors.copper, fontWeight: '700' }]}>{option.label}</Text>
        </Pressable>
      ))}
      {filtered.length === 0 ? <Text style={ui.small}>Nothing matches.</Text> : null}
    </ScrollView>
  );
  return (
    <View style={[styles.field, open && !narrow ? { zIndex: 40 } : null]}>
      <Text style={ui.label}>{label}</Text>
      <Pressable
        ref={(node) => {
          anchor.current = node as typeof anchor.current;
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen((currentOpen) => !currentOpen)}
        style={styles.input}
      >
        <Text style={{ fontFamily: sans, fontSize: 16, color: current ? colors.text : '#A3988C' }}>
          {current?.label || placeholder}
        </Text>
      </Pressable>
      {open && !narrow && box ? (
        <PopMenu>
          <Pressable accessibilityLabel="Close menu" onPress={() => setOpen(false)} style={styles.scrim} />
          <View style={[styles.popover, { top: box.top, left: box.left, width: box.width }]}>
            {options.length > 8 ? (
              <TextInput value={query} onChangeText={setQuery} placeholder="Search" placeholderTextColor="#A3988C" style={styles.input} />
            ) : null}
            {list}
          </View>
        </PopMenu>
      ) : null}
      {open && narrow ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <Pressable style={styles.sheet} onPress={() => undefined}>
              <Text style={ui.h2}>{label}</Text>
              {options.length > 8 ? (
                <TextInput value={query} onChangeText={setQuery} placeholder="Search" placeholderTextColor="#A3988C" style={styles.input} />
              ) : null}
              {list}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

export function ChoiceList({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      {options.map((option) => {
        const on = value.includes(option.value);
        return (
          <Pressable
            key={option.value}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(on ? value.filter((item) => item !== option.value) : [...value, option.value])}
            style={[styles.choice, on && { borderColor: colors.copper, backgroundColor: '#F8EFE8' }]}
          >
            <Text style={ui.body}>{on ? '✓  ' : '○  '}{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StackList({
  rows,
}: {
  rows: { key: string; title: string; meta?: string; detail?: string; tone?: 'good' | 'bad' | 'warn' | 'info' | 'neutral'; onPress?: () => void; action?: ReactNode }[];
}) {
  if (rows.length === 0) return <Text style={ui.small}>Nothing in this list yet.</Text>;
  return (
    <View style={{ gap: 8 }}>
      {rows.map((row) => (
        <Pressable key={row.key} onPress={row.onPress} style={styles.rowCard} accessibilityRole={row.onPress ? 'button' : undefined}>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Text style={{ fontFamily: sans, fontSize: 16, fontWeight: '700', color: colors.text }}>{row.title}</Text>
              {row.meta ? <Badge label={row.meta} tone={row.tone || 'neutral'} /> : null}
            </View>
            {row.detail ? <Text style={ui.small}>{row.detail}</Text> : null}
          </View>
          {row.action}
        </Pressable>
      ))}
    </View>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Card>
      <Text style={ui.h2}>{title}</Text>
      <Text style={[ui.body, { marginTop: 6 }]}>{body}</Text>
      {action ? <View style={{ marginTop: 12 }}>{action}</View> : null}
    </Card>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

export function Fields({ children }: { children: ReactNode }) {
  return <View style={styles.fields}>{children}</View>;
}

export function Filters({ children, count = 0 }: { children: ReactNode; count?: number }) {
  const { narrow } = useNarrow();
  const [open, setOpen] = useState(!narrow);
  return (
    <View style={{ gap: 10 }}>
      {narrow ? (
        <Button
          tone="secondary"
          label={open ? 'Hide filters' : count ? `Filters (${count})` : 'Filters'}
          onPress={() => setOpen((value) => !value)}
        />
      ) : null}
      {!narrow || open ? <View style={styles.fields}>{children}</View> : null}
    </View>
  );
}

export function Chips({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(option.value)}
            style={[styles.chip, on && { backgroundColor: colors.ink, borderColor: colors.ink }]}
          >
            <Text style={{ color: on ? colors.white : colors.text, fontFamily: sans, fontSize: 14, fontWeight: '700' }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' | 'neutral' }) {
  const color = tone === 'good' ? colors.moss : tone === 'bad' ? colors.clay : colors.text;
  return (
    <Card style={styles.stat}>
      <Text style={ui.label}>{label}</Text>
      <Text style={{ fontFamily: serif, fontSize: 28, color }}>{value}</Text>
      {hint ? <Text style={ui.small}>{hint}</Text> : null}
    </Card>
  );
}

export function confirmAsync(message: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(message));
  return new Promise((resolve) => {
    const { Alert } = require('react-native') as typeof import('react-native');
    Alert.alert('Confirm', message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continue', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

const webDate = {
  width: '100%',
  minHeight: 48,
  borderRadius: 10,
  border: `1px solid ${colors.line}`,
  backgroundColor: colors.paper,
  color: colors.text,
  fontFamily: sans,
  fontSize: 16,
  padding: '0 12px',
  boxSizing: 'border-box',
} as const;

const styles = StyleSheet.create({
  page: { padding: 20, gap: 16, maxWidth: 1180, width: '100%', alignSelf: 'center' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-end' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 8,
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.white, fontFamily: sans, fontSize: 16, fontWeight: '700' },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  notice: { borderRadius: 12, padding: 12 },
  field: { flexGrow: 1, flexBasis: 220, gap: 0, position: 'relative' },
  scrim: {
    position: 'fixed' as 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
  },
  popover: {
    position: 'fixed' as 'absolute',
    zIndex: 50,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 8,
    maxHeight: 300,
  },
  input: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontFamily: sans,
    fontSize: 16,
    color: colors.text,
    justifyContent: 'center',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(27,36,48,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    gap: 12,
    maxHeight: '85%',
  },
  option: { minHeight: 48, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.line },
  choice: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: colors.card },
  rowCard: {
    minHeight: 64,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexGrow: 1, flexBasis: 180 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  chips: { gap: 8, paddingVertical: 4 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
