import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { roleLabel } from '@/domain/herd';
import { EVENT_LABELS, STAGE_LABELS } from '@/domain/labels';
import { money } from '@/domain/format';
import { useHerd } from '@/data/context';
import { pigLabel, searchHerd } from '@/lib/view';
import { colors, sans, serif, ui } from '@/theme';
import { useNarrow } from './ui';

type Fab = { label: string; href: string } | null;
const FabContext = createContext<(fab: Fab) => void>(() => undefined);

export function useStickyAdd(action: { label: string; href: string } | null) {
  const setFab = useContext(FabContext);
  useEffect(() => {
    setFab(action);
    return () => setFab(null);
  }, [setFab, action?.href, action?.label]);
}

const NAV = [
  { href: '/', label: 'Today' },
  { href: '/pigs', label: 'Pigs' },
  { href: '/events', label: 'Events' },
  { href: '/litters', label: 'Litters' },
  { href: '/shows', label: 'Shows' },
  { href: '/income', label: 'Income' },
  { href: '/expenses', label: 'Expenses' },
  { href: '/feed', label: 'Feed' },
  { href: '/reports', label: 'Reports' },
  { href: '/pedigree', label: 'Family tree' },
  { href: '/setup', label: 'Farm setup' },
  { href: '/account', label: 'This device' },
];

function isActive(path: string, href: string) {
  if (href === '/') return path === '/';
  return path === href || path.startsWith(`${href}/`);
}

export function Shell({ children }: { children: ReactNode }) {
  const { narrow } = useNarrow();
  const insets = useSafeAreaInsets();
  const [menu, setMenu] = useState(false);
  const [fab, setFab] = useState<Fab>(null);
  const path = usePathname();
  const { flash, clearFlash } = useHerd();
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => clearFlash(), 2500);
    return () => clearTimeout(timer);
  }, [flash, clearFlash]);

  return (
    <FabContext.Provider value={setFab}>
      <View style={{ flex: 1, backgroundColor: colors.cream, flexDirection: narrow ? 'column' : 'row' }}>
        {!narrow ? <Sidebar path={path} onNavigate={() => undefined} /> : null}
        <View style={{ flex: 1 }}>
          <TopBar menuOpen={menu} onMenu={() => setMenu(true)} topInset={insets.top} />
          {flash ? (
            <View style={{ backgroundColor: colors.moss, paddingVertical: 10, paddingHorizontal: 16 }}>
              <Text style={{ color: colors.white, fontFamily: sans, fontWeight: '700' }}>{flash}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }}>{children}</View>
        </View>
        {narrow ? <BottomNav path={path} bottom={insets.bottom} onMore={() => setMenu(true)} fab={fab} /> : null}
        {narrow && menu ? <Sidebar path={path} onNavigate={() => setMenu(false)} overlay /> : null}
      </View>
    </FabContext.Provider>
  );
}

function TopBar({ onMenu, menuOpen, topInset }: { onMenu: () => void; menuOpen: boolean; topInset: number }) {
  const { narrow } = useNarrow();
  const { snap } = useHerd();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const hits = snap && query.trim() ? searchHerd(snap, query) : null;
  const any = hits && (hits.pigs.length || hits.events.length || hits.txns.length || hits.shows.length);

  return (
    <View style={{ backgroundColor: colors.paper, borderBottomWidth: 1, borderBottomColor: colors.line, paddingTop: topInset, zIndex: 10 }}>
      <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 }}>
        {narrow ? (
          <Pressable accessibilityRole="button" accessibilityLabel={menuOpen ? 'Close menu' : 'Open menu'} onPress={onMenu} style={iconBtn}>
            <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '700' }}>☰</Text>
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <TextInput
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search tag, pig, buyer, show"
            placeholderTextColor="#A3988C"
            accessibilityLabel="Search the herd"
            style={{
              minHeight: 44,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: colors.cream,
              paddingHorizontal: 12,
              fontFamily: sans,
              fontSize: 16,
              color: colors.text,
            }}
          />
        </View>
        {snap ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/account')} style={{ maxWidth: 140 }}>
            <Text style={{ fontFamily: sans, fontSize: 12, color: colors.muted }} numberOfLines={1}>
              {snap.farm.name}
            </Text>
            <Text style={{ fontFamily: sans, fontSize: 13, fontWeight: '700', color: colors.text }} numberOfLines={1}>
              {roleLabel(snap.actor.role)}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {open && query.trim() ? (
        <View style={{ backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line, padding: 12, gap: 8 }}>
          {!any ? <Text style={ui.small}>Nothing in the herd book matches “{query.trim()}”.</Text> : null}
          {hits?.pigs.map((pig) => (
            <Hit
              key={pig.id}
              title={pigLabel(pig)}
              meta={STAGE_LABELS[pig.stage] || pig.stage}
              onPress={() => {
                setOpen(false);
                setQuery('');
                router.push(`/pigs/${pig.id}`);
              }}
            />
          ))}
          {hits?.events.map((event) => (
            <Hit
              key={event.id}
              title={EVENT_LABELS[event.eventType] || event.eventType}
              meta={pigLabel(snap?.pigs.find((pig) => pig.id === event.pigId))}
              onPress={() => {
                setOpen(false);
                setQuery('');
                router.push(`/events/${event.id}`);
              }}
            />
          ))}
          {hits?.txns.map((txn) => (
            <Hit
              key={txn.id}
              title={txn.title}
              meta={money(txn.amountCents)}
              onPress={() => {
                setOpen(false);
                setQuery('');
                router.push(txn.kind === 'income' ? `/income/${txn.id}` : `/expenses/${txn.id}`);
              }}
            />
          ))}
          {hits?.shows.map((show) => (
            <Hit
              key={show.id}
              title={show.name}
              meta={show.showDate}
              onPress={() => {
                setOpen(false);
                setQuery('');
                router.push('/shows');
              }}
            />
          ))}
          <Pressable onPress={() => setOpen(false)} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: colors.copper, fontFamily: sans, fontWeight: '700' }}>Close search</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Hit({ title, meta, onPress }: { title: string; meta?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 48, justifyContent: 'center' }}>
      <Text style={{ fontFamily: sans, fontSize: 16, fontWeight: '700', color: colors.text }}>{title}</Text>
      {meta ? <Text style={ui.small}>{meta}</Text> : null}
    </Pressable>
  );
}

function Sidebar({ path, onNavigate, overlay }: { path: string; onNavigate: () => void; overlay?: boolean }) {
  const router = useRouter();
  const { snap } = useHerd();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={
        overlay
          ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, backgroundColor: 'rgba(27,36,48,0.45)' }
          : { width: 248, backgroundColor: colors.ink }
      }
    >
      <Pressable style={{ flex: 1 }} onPress={onNavigate}>
        <Pressable
          onPress={() => undefined}
          style={{ width: 280, maxWidth: '86%', backgroundColor: colors.ink, flex: 1, paddingTop: insets.top + 16, paddingBottom: 16 }}
        >
          <Text style={{ fontFamily: serif, fontSize: 28, color: colors.cream, paddingHorizontal: 16 }}>Herdkeep</Text>
          <Text style={{ fontFamily: sans, color: '#C9B8A4', paddingHorizontal: 16, marginBottom: 12 }}>
            {snap?.farm.name || 'CG Ranch'}
          </Text>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            {NAV.map((item) => {
              const on = isActive(path, item.href);
              return (
                <Pressable
                  key={item.href}
                  accessibilityRole="button"
                  onPress={() => {
                    router.push(item.href);
                    onNavigate();
                  }}
                  style={{
                    minHeight: 48,
                    justifyContent: 'center',
                    paddingHorizontal: 16,
                    backgroundColor: on ? colors.inkRaised : 'transparent',
                  }}
                >
                  <Text style={{ color: on ? colors.white : '#E7D7C6', fontFamily: sans, fontSize: 16, fontWeight: on ? '700' : '500' }}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {overlay ? (
            <Pressable onPress={onNavigate} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 }}>
              <Text style={{ color: colors.cream, fontFamily: sans, fontWeight: '700' }}>Close</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
    </View>
  );
}

function BottomNav({ path, bottom, onMore, fab }: { path: string; bottom: number; onMore: () => void; fab: Fab }) {
  const router = useRouter();
  const items = [
    { href: '/', label: 'Today' },
    { href: '/pigs', label: 'Pigs' },
    { href: '/events', label: 'Events' },
    { href: '/reports', label: 'Reports' },
  ];
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.ink,
        paddingBottom: bottom,
        borderTopWidth: 1,
        borderTopColor: colors.inkRaised,
      }}
    >
      {items.map((item) => {
        const on = isActive(path, item.href);
        return (
          <Pressable
            key={item.href}
            accessibilityRole="button"
            onPress={() => router.push(item.href)}
            style={{ flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: on ? '#F3C7A8' : '#E7D7C6', fontFamily: sans, fontWeight: '700', fontSize: 13 }}>{item.label}</Text>
          </Pressable>
        );
      })}
      <Pressable accessibilityRole="button" accessibilityLabel="More" onPress={onMore} style={{ flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#E7D7C6', fontFamily: sans, fontWeight: '700', fontSize: 13 }}>More</Text>
      </Pressable>
      {fab ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={fab.label}
          onPress={() => router.push(fab.href)}
          style={{ minHeight: 56, paddingHorizontal: 14, backgroundColor: colors.copper, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: colors.white, fontFamily: sans, fontWeight: '700', fontSize: 13 }}>Add</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const iconBtn = {
  width: 48,
  height: 48,
  borderRadius: 12,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: colors.cream,
};
