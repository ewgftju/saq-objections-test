export type CaseType = "notice" | "audit" | "control";
export type Role =
  | "work"
  | "director"
  | "dvga"
  | "kvga"
  | "commission"
  | "subject"
  | "higher";
export type CaseStatus =
  | "received"
  | "accepted"
  | "requested"
  | "request_approval"
  | "request_signed"
  | "request_approved"
  | "response_approval"
  | "response_signed"
  | "response_ready"
  | "materials"
  | "certificate_approval"
  | "certificate_signed"
  | "certificate_approved"
  | "documents_review"
  | "commission_members"
  | "commission_voting"
  | "circulated"
  | "hearing"
  | "hearing_ready"
  | "meeting"
  | "protocol"
  | "decided"
  | "delivered"
  | "completed"
  | "refused"
  | "withdrawn"
  | "forwarded"
  | "paused"
  | "court";
export type Outcome = "accept" | "partial" | "reject" | "refuse";
export type Page =
  | "registry"
  | "detail"
  | "sessions"
  | "notifications"
  | "processes"
  | "sources";
export type CaseTab = "overview" | "review" | "documents" | "history";

export interface ViolationPoint {
  id: string;
  number: string;
  title: string;
  finding: string;
  argument: string;
  amount: number;
  disputed: boolean;
  evidence?: string;
  authorityFinding?: string;
  position?: string;
  analysis?: string;
  legal?: string;
  proposal?: Outcome;
  final?: Outcome;
  remainingAmount?: number;
}

export interface CommissionMember {
  id: string;
  name: string;
  present: boolean;
  recused: boolean;
  reason: string;
}

export interface VoteResult {
  yes: number;
  no: number;
  approved: boolean;
  chair: string;
  present: number;
  eligible: number;
  votes?: Record<string, string>;
  voteReasons?: Record<string, string>;
}

export interface CaseResult {
  label: string;
  kind?: string;
  reason: string;
  effect: string;
  date: string;
  number?: string;
}

export interface Hearing {
  skip: boolean;
  reason?: string;
  notice?: string;
  date?: string;
  subject?: string;
  issuer?: string;
  note?: string;
  held?: string;
}

export interface Meeting {
  date: string;
  number: string;
  audio: string;
  recommendations?: string;
  signed?: string;
}

export interface Delivery {
  date: string;
  number: string;
  receipt: string;
  channel: string;
  recipient?: string;
  appealCourt: string;
  appealProcedure: string;
  published?: string | null;
  received?: string;
}

export interface CaseDocument {
  name: string;
  kind: string;
  text: string;
  date: string;
  author: string;
  dataUrl?: string;
  filename?: string;
  requestId?: string;
  snapshot?: {
    issues: ViolationPoint[];
    result: CaseResult | null;
    members: CommissionMember[];
    votes: Record<string, VoteResult> | null;
    meeting: Meeting | null;
    hearing: Hearing | null;
    delivery: Delivery | null;
    certificate: CaseCertificate | null;
  };
}

export interface CaseRequest {
  id: string;
  recipient: string;
  date: string;
  text: string;
  deadline: string;
  template?: "dvga" | "other";
  author?: string;
  customText?: string;
  sent?: string;
  responded?: string;
  /** Ответ органа хранится в запросе и недоступен другому адресату. */
  authorityResponses?: Record<
    string,
    { finding: string; response: string }
  >;
  responseApproved?: string;
  responseSigned?: string;
  confirmed?: string;
}

export interface CertificateMemberPosition {
  id: string;
  name: string;
  /** Итоговая позиция члена АК по обращению на этапе заседания. */
  result: Outcome | "";
  /** Комментарий члена АК либо исполнителя рабочего органа. */
  comment: string;
}

export interface CaseCertificate {
  davgaArguments: string;
  memberPositions: CertificateMemberPosition[];
}

export interface AgendaRegistryEntry {
  id: string;
  number: number;
  meetingDate: string;
  caseIds: string[];
  documentHtml: string;
  resultsHtml?: string;
  created: string;
}

/** Реквизиты, используемые исключительно для текста пункта повестки дня. */
export interface AgendaDetails {
  cameraControlNumber?: string;
  cameraControlDate?: string;
  procurementNumber?: string;
  lotNumber?: string;
  procurementSubject?: string;
  relatedDocumentNumber?: string;
  relatedDocumentDate?: string;
  decisionKind?:
    | "prescription-audit"
    | "prescription-preventive"
    | "quality-control"
    /** Значения сохранённых до обновления карточек. */
    | "prescription"
    | "inspection-act";
}

export interface CaseNotification {
  id: string;
  caseId: string;
  recipient: string;
  text: string;
  date: string;
  read: boolean;
  kind?: "attendance-poll";
  attendancePollId?: string;
  commissionMemberId?: string;
}

export interface CommissionAttendanceMember {
  id: string;
  name: string;
}

export interface CommissionAttendancePoll {
  id: string;
  dateTime: string;
  caseIds: string[];
  sentAt: string;
  responses: Record<string, "pending" | "yes" | "no">;
  manualResponseChanges?: Record<
    string,
    {
      changedBy: string;
      changedAt: string;
    }
  >;
}

export interface HistoryEvent {
  date: string;
  actor: string;
  title: string;
  text: string;
}

export interface ObjectionCase {
  id: string;
  type: CaseType;
  appealType?: string;
  appealNumber?: string;
  appealDate?: string;
  org: string;
  bin: string;
  address: string;
  applicant: string;
  registered: string;
  filed: string;
  channel: string;
  issuer: string;
  authority: string;
  document: {
    number: string;
    date: string;
    received: string;
    name: string;
    appealExplained?: boolean;
  };
  procurement?: string;
  amount: number;
  request: string;
  affectedParties?: string;
  issues: ViolationPoint[];
  status: CaseStatus;
  assignee: string;
  extensionDays: number;
  pauseDays: number;
  documents: CaseDocument[];
  requests: CaseRequest[];
  members: CommissionMember[];
  history: HistoryEvent[];
  screening?: string;
  actEffect?: string;
  memberPosition?: string;
  /** Новое обращение, поступившее через SAQ и ещё не открытое директором. */
  unread?: boolean;
  /** Новое назначение, которое ещё не открыто исполнителем рабочего органа. */
  unreadForAssignee?: boolean;
  agendaMeetingDate?: string;
  certificate?: CaseCertificate | null;
  hearing?: Hearing | null;
  meeting?: Meeting | null;
  agendaDetails?: AgendaDetails;
  votes?: Record<string, VoteResult> | null;
  result?: CaseResult | null;
  delivery?: Delivery | null;
  pause?: { date: string; recipient: string; text: string } | null;
  requestPauseStartedAt?: string;
  resumeStatus?: CaseStatus;
  selfReview?: boolean;
  court?: {
    number: string;
    date: string;
    note: string;
    effect: string;
    result?: string;
  };
}

export type NewCaseInput = Pick<
  ObjectionCase,
  | "id"
  | "type"
  | "appealType"
  | "appealNumber"
  | "appealDate"
  | "org"
  | "bin"
  | "address"
  | "applicant"
  | "registered"
  | "filed"
  | "channel"
  | "issuer"
  | "authority"
  | "document"
  | "amount"
  | "request"
  | "issues"
> &
  Partial<
    Pick<ObjectionCase, "procurement" | "affectedParties" | "agendaDetails">
  >;
export interface DemoState {
  version: number;
  date: string;
  cases: ObjectionCase[];
  agendas: AgendaRegistryEntry[];
  notifications: CaseNotification[];
  attendancePolls: CommissionAttendancePoll[];
  activeCommissionMemberId: string;
}
export interface Route {
  page: Page;
  caseId?: string;
  tab?: CaseTab;
}

export type Action =
  | "screen"
  | "assign-work-executor"
  | "request"
  | "request-other"
  | "send-request-approval"
  | "approve-request"
  | "sign-request"
  | "approve-response"
  | "sign-response"
  | "approve-certificate"
  | "sign-certificate"
  | "send-certificate-to-commission"
  | "fill-meeting-certificate"
  | "review-commission-documents"
  | "choose-commission-members"
  | "commission-vote"
  | "fill-request-response"
  | "position"
  | "analysis"
  | "members"
  | "hearing"
  | "hearing-held"
  | "vote"
  | "sign"
  | "deliver"
  | "execute"
  | "forward"
  | "control-analysis"
  | "control-decision"
  | "supplement"
  | "pause"
  | "resume"
  | "withdraw"
  | "refuse"
  | "return-analysis"
  | "postpone"
  | "court"
  | "court-result"
  | "receipt"
  | "upload";
export interface ActionOption {
  action: Action;
  label: string;
  role: Role;
}
