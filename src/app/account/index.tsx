import { useState } from 'react';
import { Text, View } from 'react-native';
import { can, roleLabel, type Role } from '@/domain/herd';
import { ui } from '@/theme';
import { Gate } from '@/components/Gate';
import { useSave } from '@/components/useSave';
import { Badge, Button, Card, Field, Fields, Notice, Page, Select, confirmAsync } from '@/components/ui';

export default function AccountPage() {
  return (
    <Gate title="This device">
      {(snap) => <Account snap={snap} />}
    </Gate>
  );
}

function Account({ snap }: { snap: import('@/data/types').Snapshot }) {
  const { error, busy, submit } = useSave();
  const owner = can(snap.actor.role, 'roles');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('data_entry');
  return (
    <Page title="This device" lede="Herdkeep keeps the herd book on this device. The role below is whoever is holding it, not a password.">
      {error ? <Notice tone="bad" text={error} /> : null}
      <Notice tone="info" text={`Signed in on this device as ${snap.actor.name}, ${roleLabel(snap.actor.role)}. Switching roles does not check a password.`} />
      <Card>
        <Text style={ui.h2}>Who is using the barn book</Text>
        {snap.users.filter((user) => user.status === 'enabled').map((user) => {
          const on = user.id === snap.actor.userId;
          return (
            <View key={user.id} style={{ gap: 4, paddingVertical: 6 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Text style={ui.body}>{user.name}</Text>
                <Badge label={roleLabel(user.role)} tone={user.role === 'owner' ? 'warn' : 'neutral'} />
                {on ? <Badge label="On this device" tone="info" /> : null}
              </View>
              <Text style={ui.small}>{user.email}</Text>
              {!on ? (
                <Button label={`Use as ${user.name}`} tone="secondary" disabled={busy} onPress={() => void submit((repo) => repo.setActiveUser(user.id))} />
              ) : null}
            </View>
          );
        })}
        <Text style={ui.small}>Owner can change farm settings, roles, and the demo. Manager can edit setup and delete. Data entry can add and edit records only.</Text>
      </Card>
      {owner ? (
        <Card>
          <Text style={ui.h2}>People</Text>
          {snap.users.map((user) => (
            <UserRow key={user.id} user={user} />
          ))}
          <Fields>
            <Field label="Name" value={name} onChange={setName} placeholder="Saturday help" />
            <Field label="Email" value={email} onChange={setEmail} placeholder="help@cgranch.example" />
            <Select
              label="Role"
              value={role}
              onChange={(value) => setRole(value as Role)}
              options={[
                { value: 'owner', label: 'Owner' },
                { value: 'manager', label: 'Manager' },
                { value: 'data_entry', label: 'Data entry' },
              ]}
            />
          </Fields>
          <Button
            label="Add person"
            disabled={busy || !name.trim() || !email.trim()}
            onPress={() => {
              void submit(async (repo, actor) => {
                await repo.saveUser(actor, { name, email, role, status: 'enabled' });
                setName('');
                setEmail('');
              });
            }}
          />
        </Card>
      ) : null}
      <Card>
        <Text style={ui.h2}>Storage</Text>
        <Text style={ui.body}>Records are stored with {snap.engine === 'sql.js' ? 'a local database in this browser' : 'SQLite on the device'}. Each row carries an id and a pending sync mark so a server can be added later. Nothing leaves this device today.</Text>
        {snap.userModified ? <Text style={ui.small}>The demo has been edited on this device.</Text> : <Text style={ui.small}>This is still the original demo herd.</Text>}
      </Card>
      {can(snap.actor.role, 'reset_demo') ? (
        <Button
          tone="danger"
          label={busy ? 'Resetting…' : 'Reset demo herd'}
          disabled={busy}
          onPress={() => {
            void (async () => {
              const ok = await confirmAsync('Replace everything on this device with the CG Ranch demo? Edits you made here will be erased.');
              if (!ok) return;
              await submit((repo, actor) => repo.resetDemo(actor));
            })();
          }}
        />
      ) : null}
    </Page>
  );
}

function UserRow({ user }: { user: import('@/data/types').FarmUser }) {
  const { busy, submit, error } = useSave();
  const [role, setRole] = useState<Role>(user.role);
  const [status, setStatus] = useState(user.status);
  return (
    <View style={{ gap: 6, paddingVertical: 8 }}>
      <Text style={ui.body}>{user.name}</Text>
      {error ? <Notice tone="bad" text={error} /> : null}
      <Fields>
        <Select
          label="Role"
          value={role}
          onChange={(value) => setRole(value as Role)}
          options={[
            { value: 'owner', label: 'Owner' },
            { value: 'manager', label: 'Manager' },
            { value: 'data_entry', label: 'Data entry' },
          ]}
        />
        <Select
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'enabled', label: 'Enabled' },
            { value: 'disabled', label: 'Disabled' },
          ]}
        />
      </Fields>
      <Button
        tone="ghost"
        label={busy ? 'Saving…' : 'Save person'}
        disabled={busy}
        onPress={() => void submit((repo, actor) => repo.saveUser(actor, { name: user.name, email: user.email, role, status }, user.id))}
      />
    </View>
  );
}
