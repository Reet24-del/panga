// Domain types shared by the browser and the server.

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CATEGORIES = ['design', 'build', 'content', 'integration', 'support', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

export type SourceKind = 'brief' | 'chat' | 'voice' | 'note';

/** An original upload kept in DigitalOcean Spaces. */
export interface StoredFile {
  key: string;
  name: string;
  size: number;
  contentType: string;
}

/** A piece of client material: a brief, a chat export, a voice-note transcript. */
export interface Source {
  id: string; // S1, S2, ...
  kind: SourceKind;
  label: string;
  text: string;
  file?: StoredFile | null;
}

/** A verbatim span of a source that supports a claim. Offsets index into source.text. */
export interface Evidence {
  sourceId: string;
  quote: string;
  start: number;
  end: number;
}

export type RequirementStatus = 'confirmed' | 'inferred' | 'removed';
export type HoursSource = 'suggested' | 'freelancer';

export interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
}

export interface Research {
  query: string;
  summary: string;
  sources: ResearchSource[];
  at: string;
}

export interface Requirement {
  id: string; // R1, R2, ...
  title: string;
  detail: string;
  category: Category;
  /** Work that is easy to miss when reading only the headline request. */
  hidden: boolean;
  evidence: Evidence[];
  /** confirmed: backed by a client quote or by the freelancer. inferred: no quote, not priced. */
  status: RequirementStatus;
  confirmedWithoutQuote: boolean;
  hours: number;
  hoursSource: HoursSource;
  suggestedHours: number | null;
  inStarter: boolean;
  starterHours: number;
  research: Research | null;
  addedBy: 'panga' | 'freelancer';
}

export type QuestionState = 'open' | 'ask_client' | 'assumed' | 'answered';

export interface Question {
  id: string; // Q1, Q2, ...
  text: string;
  requirementId: string | null;
  state: QuestionState;
}

export interface Assumptions {
  minimumRate: number;
  commsHours: number;
  revisionRounds: number;
  starterRevisionRounds: number;
  hoursPerRound: number;
  contingencyPct: number;
  priceStep: number;
  updateHoursPerMonth: number;
}

export type Difficulty = 'reasonable' | 'pushy' | 'hell';

export interface Turn {
  id: string;
  role: 'client' | 'freelancer';
  text: string;
  /** The requirement the simulated client was pressing on, if any. */
  requirementId: string | null;
}

export type CommitmentClass = 'in_scope' | 'out_of_scope' | 'ambiguous' | 'time' | 'price';

export interface Commitment {
  id: string;
  turnId: string;
  quote: string;
  kind: CommitmentClass;
  requirementId: string | null;
  suggestion: string;
  resolved: boolean;
}

export interface Replay {
  status: 'pending' | 'ready' | 'failed';
  commitments: Commitment[];
  error: string | null;
}

export interface Rehearsal {
  id: string;
  mode: 'text' | 'voice';
  difficulty: Difficulty;
  turns: Turn[];
  status: 'live' | 'ended';
  startedAt: string;
  endedAt: string | null;
  replay: Replay | null;
}

export type Choice = 'take' | 'change' | 'walk';
export type Tone = 'english_friendly' | 'english_formal' | 'hinglish_friendly';

export interface Decision {
  choice: Choice;
  tone: Tone;
  reply: string;
  draftedAt: string;
  approvedAt: string | null;
}

export interface Outcome {
  /** Which package the client went with. */
  package: 'starter' | 'full';
  actualHours: number;
  lesson: string;
  recordedAt: string;
}

export interface SimilarProject {
  id: string;
  title: string;
  summary: string;
  estimatedHours: number | null;
  actualHours: number | null;
  lesson: string;
  score: number;
}

export interface AnalysisMeta {
  model: string;
  ms: number;
  quotesChecked: number;
  quotesRejected: number;
  repaired: boolean;
  memoriesUsed: number;
}

export type DealStage = 'analyzing' | 'analysis_failed' | 'review' | 'decided' | 'closed';

/** The first extraction, kept so the freelancer's corrections can be remembered. */
export interface ExtractedSnapshot {
  id: string;
  title: string;
  suggestedHours: number | null;
}

export interface Deal {
  id: string;
  workspaceId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  stage: DealStage;
  error: string | null;
  currency: Currency;
  offeredPrice: number | null;
  priceEvidence: Evidence | null;
  summary: string;
  sources: Source[];
  requirements: Requirement[];
  questions: Question[];
  assumptions: Assumptions;
  rehearsals: Rehearsal[];
  decision: Decision | null;
  outcome: Outcome | null;
  /** Set by the workflow two weeks after approval, to ask how the project went. */
  outcomeRequestedAt: string | null;
  similar: SimilarProject[];
  analysis: AnalysisMeta | null;
  extracted: ExtractedSnapshot[];
  scopeConfirmedAt: string | null;
  workflowId: string | null;
}

/** Fields the freelancer edits directly in the deal room. */
export type DealPatch = Partial<Pick<Deal, 'title' | 'offeredPrice' | 'currency' | 'requirements' | 'questions' | 'assumptions'>>;

export interface DealSummary {
  id: string;
  title: string;
  stage: DealStage;
  currency: Currency;
  offeredPrice: number | null;
  decision: Choice | null;
  updatedAt: string;
}

export interface Preferences {
  minimumRate: number | null;
  currency: Currency;
  tone: Tone;
  neverInclude: string[];
}

export interface MemoryItem {
  id: string;
  content: string;
  kind: 'preference' | 'correction' | 'note';
  createdAt: string | null;
}

export interface PastProject {
  id: string;
  title: string;
  summary: string;
  requirements: string;
  estimatedHours: number | null;
  actualHours: number | null;
  quotedPrice: number | null;
  currency: Currency | null;
  lesson: string;
  dealId: string | null;
  createdAt: string;
}

export interface Integrations {
  model: boolean;
  modelId: string;
  database: 'tiger' | 'local';
  embeddings: boolean;
  temporal: boolean;
  voice: boolean;
  transcription: boolean;
  research: boolean;
  memory: 'backboard' | 'local';
  tracing: boolean;
  files: 'spaces' | 'none';
}
