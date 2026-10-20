import type { Gender, Role, Stage } from '../domain/herd';

export type Farm = {
  id: string;
  name: string;
  premisesId: string | null;
  gestationDays: number;
  weaningAgeDays: number;
  heatCycleDays: number;
  farrowingIntervalDays: number;
  lowFeedLb: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: string;
};

export type NamedRow = {
  id: string;
  farmId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: string;
};

export type FeedType = NamedRow & { unit: string; reorderLb: number };

export type Contact = NamedRow & {
  kind: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export type FarmUser = {
  id: string;
  farmId: string;
  name: string;
  email: string;
  role: Role;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: string;
};

export type Pig = {
  id: string;
  farmId: string;
  tag: string;
  name: string | null;
  litterNumber: string | null;
  gender: Gender;
  stage: Stage;
  status: string;
  breedId: string | null;
  groupId: string | null;
  weightLb: number | null;
  dob: string | null;
  entryDate: string | null;
  source: string;
  sourceDetail: string | null;
  sireId: string | null;
  sireText: string | null;
  damId: string | null;
  damText: string | null;
  notes: string | null;
  photoUri: string | null;
  earNotch: string | null;
  showTag: string | null;
  registrationNo: string | null;
  litterId: string | null;
  castrated: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: string;
  updatedBy: string | null;
};

export type Litter = {
  id: string;
  farmId: string;
  sowId: string;
  sireId: string | null;
  breedingEventId: string | null;
  farrowDate: string;
  parity: number | null;
  bornAlive: number;
  stillborn: number;
  mummies: number;
  birthWeightLb: number | null;
  litterNumber: string | null;
  weanedCount: number | null;
  weanDate: string | null;
  weanWeightLb: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: string;
};

export type FosterMove = {
  id: string;
  farmId: string;
  moveDate: string;
  fromLitterId: string;
  toLitterId: string;
  count: number;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: string;
};

export type HerdEvent = {
  id: string;
  farmId: string;
  pigId: string | null;
  massEventId: string | null;
  eventType: string;
  eventDate: string;
  notes: string | null;
  weightLb: number | null;
  weightContext: string | null;
  sireId: string | null;
  sireName: string | null;
  matingMethod: string | null;
  technician: string | null;
  dueDate: string | null;
  breedingEventId: string | null;
  pregResult: string | null;
  pregMethod: string | null;
  litterId: string | null;
  bornAlive: number | null;
  stillborn: number | null;
  mummies: number | null;
  birthWeightLb: number | null;
  weanedCount: number | null;
  weanWeightLb: number | null;
  drugName: string | null;
  dose: string | null;
  route: string | null;
  withdrawalDays: number | null;
  withdrawalEnds: string | null;
  diagnosis: string | null;
  symptoms: string | null;
  treatedBy: string | null;
  vetName: string | null;
  vfdNumber: string | null;
  lotNo: string | null;
  productExpiry: string | null;
  eldu: number | null;
  elduVet: string | null;
  vfdExpiry: string | null;
  vfdDocUri: string | null;
  heatId: string | null;
  vaccineName: string | null;
  nextDueDate: string | null;
  buyerId: string | null;
  buyerName: string | null;
  saleAmountCents: number | null;
  cause: string | null;
  customName: string | null;
  transactionId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: string;
  updatedBy: string | null;
};

export type MassEvent = {
  id: string;
  farmId: string;
  eventDate: string;
  eventType: string;
  groupId: string | null;
  medicineName: string | null;
  customName: string | null;
  notes: string | null;
  withdrawalDays: number | null;
  lotNo: string | null;
  productExpiry: string | null;
  eldu: number | null;
  elduVet: string | null;
  vfdExpiry: string | null;
  vfdDocUri: string | null;
  costCents: number | null;
  expenseId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: string;
  updatedBy: string | null;
};

export type MassPig = {
  id: string;
  massEventId: string;
  pigId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: string;
};

export type Transaction = {
  id: string;
  farmId: string;
  kind: 'income' | 'expense';
  txnDate: string;
  txnType: string;
  categoryId: string | null;
  feedTypeId: string | null;
  quantity: number | null;
  title: string;
  amountCents: number;
  receiptNo: string | null;
  notes: string | null;
  pigId: string | null;
  buyerId: string | null;
  feedMoveId: string | null;
  eventId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: string;
  updatedBy: string | null;
};

export type FeedMove = {
  id: string;
  farmId: string;
  feedTypeId: string;
  movement: 'addition' | 'reduction';
  moveDate: string;
  quantity: number;
  costCents: number | null;
  remark: string | null;
  doneBy: string | null;
  notes: string | null;
  expenseId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: string;
  updatedBy: string | null;
};

export type Show = {
  id: string;
  farmId: string;
  name: string;
  showDate: string;
  location: string | null;
  targetWeightLb: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: string;
};

export type ShowEntry = {
  id: string;
  farmId: string;
  showId: string;
  pigId: string;
  exhibitor: string | null;
  className: string | null;
  targetWeightLb: number | null;
  weighInLb: number | null;
  placing: string | null;
  premiumCents: number | null;
  division: string | null;
  weightClass: string | null;
  exhibitorContactId: string | null;
  buyerContactId: string | null;
  saleCents: number | null;
  addonCents: number | null;
  saleEventId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: string;
};

export type RemovedRef = {
  table: string;
  id: string;
  label: string;
  deletedAt: string;
};

export type PigInput = {
  tag: string;
  name: string;
  litterNumber: string;
  gender: Gender;
  stage: Stage;
  status: string;
  breedId: string | null;
  groupId: string | null;
  weightLb: number | null;
  dob: string | null;
  entryDate: string | null;
  source: string;
  sourceDetail: string;
  sireId: string | null;
  sireText: string;
  damId: string | null;
  damText: string;
  notes: string;
  photoUri: string | null;
  earNotch: string;
  showTag: string;
  registrationNo: string;
  litterId: string | null;
  castrated: boolean;
};

export type EventInput = {
  pigId: string;
  eventType: string;
  eventDate: string;
  notes: string;
  weightLb: number | null;
  weightContext: string | null;
  sireId: string | null;
  sireName: string;
  matingMethod: string | null;
  technician: string;
  breedingEventId: string | null;
  pregResult: string | null;
  pregMethod: string | null;
  bornAlive: number | null;
  stillborn: number | null;
  mummies: number | null;
  birthWeightLb: number | null;
  litterNumber: string;
  parity: number | null;
  weanedCount: number | null;
  weanWeightLb: number | null;
  litterId: string | null;
  drugName: string;
  dose: string;
  route: string;
  withdrawalDays: number | null;
  diagnosis: string;
  symptoms: string;
  treatedBy: string;
  vetName: string;
  vfdNumber: string;
  lotNo: string;
  productExpiry: string | null;
  eldu: boolean;
  elduVet: string;
  vfdExpiry: string | null;
  vfdDocUri: string;
  vaccineName: string;
  nextDueDate: string | null;
  buyerId: string | null;
  buyerName: string;
  saleAmountCents: number | null;
  cause: string;
  customName: string;
  markBarrow: boolean;
};

export type MassInput = {
  eventDate: string;
  eventType: string;
  groupId: string | null;
  pigIds: string[];
  medicineName: string;
  customName: string;
  notes: string;
  withdrawalDays: number | null;
  lotNo: string;
  productExpiry: string | null;
  eldu: boolean;
  elduVet: string;
  vfdExpiry: string | null;
  vfdDocUri: string;
  costCents: number | null;
};

export type TxnInput = {
  kind: 'income' | 'expense';
  txnDate: string;
  txnType: string;
  categoryId: string | null;
  feedTypeId: string | null;
  quantity: number | null;
  title: string;
  amountCents: number;
  receiptNo: string;
  notes: string;
  pigId: string | null;
  buyerName: string;
};

export type FeedInput = {
  movement: 'addition' | 'reduction';
  feedTypeId: string;
  moveDate: string;
  quantity: number;
  costCents: number | null;
  remark: string;
  doneBy: string;
  notes: string;
};

export type ShowInput = {
  name: string;
  showDate: string;
  location: string;
  targetWeightLb: number | null;
  notes: string;
};

export type EntryInput = {
  showId: string;
  pigId: string;
  exhibitor: string;
  className: string;
  targetWeightLb: number | null;
  division?: string;
  weightClass?: string;
  exhibitorContactId?: string | null;
  buyerContactId?: string | null;
  saleCents?: number | null;
  addonCents?: number | null;
  weighInLb?: number | null;
  saleEventId?: string | null;
};

export type FosterInput = {
  moveDate: string;
  fromLitterId: string;
  toLitterId: string;
  count: number;
  reason: string;
};

export type LookupKind = 'breed' | 'group' | 'feed' | 'income' | 'expense';

export type Actor = {
  userId: string;
  name: string;
  role: Role;
};

export type Snapshot = {
  engine: string;
  farm: Farm;
  actor: Actor;
  users: FarmUser[];
  breeds: NamedRow[];
  groups: NamedRow[];
  feedTypes: FeedType[];
  incomeCategories: NamedRow[];
  expenseCategories: NamedRow[];
  contacts: Contact[];
  pigs: Pig[];
  events: HerdEvent[];
  massEvents: MassEvent[];
  massPigs: MassPig[];
  litters: Litter[];
  fosters: FosterMove[];
  transactions: Transaction[];
  feedMoves: FeedMove[];
  shows: Show[];
  entries: ShowEntry[];
  removed: RemovedRef[];
  userModified: boolean;
};
