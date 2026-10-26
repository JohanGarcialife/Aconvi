export type AgreementType =
  | "INFORMATIVO"
  | "RUEGOS_Y_PREGUNTAS"
  | "MAYORIA_SIMPLE"
  | "UN_TERCIO"
  | "TRES_QUINTOS"
  | "UNANIMIDAD";

export interface LphVoterInput {
  userId: string;
  memberId: string;
  name?: string;
  door?: string;
  coefficient: number; // e.g. 4.5 (%)
  choice: "APPROVE" | "REJECT" | "ABSTAIN";
  fromHome: boolean; // Pre-meeting vote cast via app
  inPersonPresent: boolean; // Present or represented at meeting
}

export interface LphCalculationResult {
  agreementType: AgreementType;
  requiresVoting: boolean;
  status: "APPROVED" | "REJECTED" | "PENDING_ABSENTEES";
  statusLabel: string;
  // Raw Counts
  totalApprove: number;
  totalReject: number;
  totalAbstain: number;
  // From home breakdown
  approveFromHome: number;
  rejectFromHome: number;
  abstainFromHome: number;
  // In person breakdown
  approveInPerson: number;
  rejectInPerson: number;
  abstainInPerson: number;
  // Progress Bar 1: Owners metrics
  ownersFavor: number;
  ownersBase: number;
  ownersPct: number;
  ownersThresholdPct: number;
  ownersThresholdText: string;
  ownersReached: boolean;
  ownersMissing: number;
  // Progress Bar 2: Coefficient metrics
  coeffFavor: number;
  coeffBase: number;
  coeffFavorPct: number;
  coeffThresholdPct: number;
  coeffThresholdText: string;
  coeffReached: boolean;
  coeffMissingPct: number;
  // Details
  summaryText: string;
}

export const AGREEMENT_TYPE_CONFIG: Record<
  AgreementType,
  {
    label: string;
    requiresVoting: boolean;
    description: string;
    thresholdOwnersFraction: number; // e.g. 0.6 for 3/5
    thresholdCoeffFraction: number;
    requiresAbsenteesNotice: boolean;
  }
> = {
  INFORMATIVO: {
    label: "Informativo (sin votación)",
    requiresVoting: false,
    description: "Punto meramente informativo. No requiere votación.",
    thresholdOwnersFraction: 0,
    thresholdCoeffFraction: 0,
    requiresAbsenteesNotice: false,
  },
  RUEGOS_Y_PREGUNTAS: {
    label: "Ruegos y preguntas (sin votación)",
    requiresVoting: false,
    description: "Turno de intervenciones y ruegos. No requiere votación.",
    thresholdOwnersFraction: 0,
    thresholdCoeffFraction: 0,
    requiresAbsenteesNotice: false,
  },
  MAYORIA_SIMPLE: {
    label: "Mayoría simple (>50 % de los votos emitidos)",
    requiresVoting: true,
    description:
      "Art. 17.7 LPH. Mayoría de los votos y cuotas de los asistentes que voten.",
    thresholdOwnersFraction: 0.5,
    thresholdCoeffFraction: 0.5,
    requiresAbsenteesNotice: false,
  },
  UN_TERCIO: {
    label: "1/3 del total",
    requiresVoting: true,
    description:
      "Art. 17.1 LPH. Al menos 1/3 de propietarios y 1/3 de cuotas del total de la comunidad.",
    thresholdOwnersFraction: 1 / 3,
    thresholdCoeffFraction: 1 / 3,
    requiresAbsenteesNotice: false,
  },
  TRES_QUINTOS: {
    label: "3/5 del total",
    requiresVoting: true,
    description:
      "Art. 17.3/4/12 LPH. Al menos 3/5 (60%) de propietarios y cuotas del total.",
    thresholdOwnersFraction: 3 / 5,
    thresholdCoeffFraction: 3 / 5,
    requiresAbsenteesNotice: true,
  },
  UNANIMIDAD: {
    label: "Unanimidad",
    requiresVoting: true,
    description:
      "Art. 17.6 LPH. Totalidad de propietarios y cuotas sin votos en contra.",
    thresholdOwnersFraction: 1.0,
    thresholdCoeffFraction: 1.0,
    requiresAbsenteesNotice: true,
  },
};

export function calculateLphAgreement(params: {
  agreementType: AgreementType;
  totalCommunityOwners: number; // e.g. 42
  totalCommunityCoeff?: number; // default 100.0
  voters: LphVoterInput[];
}): LphCalculationResult {
  const {
    agreementType,
    totalCommunityOwners,
    totalCommunityCoeff = 100.0,
    voters,
  } = params;

  const cfg =
    AGREEMENT_TYPE_CONFIG[agreementType] ??
    AGREEMENT_TYPE_CONFIG.MAYORIA_SIMPLE;

  if (!cfg.requiresVoting) {
    return {
      agreementType,
      requiresVoting: false,
      status: "APPROVED",
      statusLabel: "Informativo",
      totalApprove: 0,
      totalReject: 0,
      totalAbstain: 0,
      approveFromHome: 0,
      rejectFromHome: 0,
      abstainFromHome: 0,
      approveInPerson: 0,
      rejectInPerson: 0,
      abstainInPerson: 0,
      ownersFavor: 0,
      ownersBase: totalCommunityOwners,
      ownersPct: 0,
      ownersThresholdPct: 0,
      ownersThresholdText: "Sin votación",
      ownersReached: true,
      ownersMissing: 0,
      coeffFavor: 0,
      coeffBase: totalCommunityCoeff,
      coeffFavorPct: 0,
      coeffThresholdPct: 0,
      coeffThresholdText: "Sin votación",
      coeffReached: true,
      coeffMissingPct: 0,
      summaryText: "Punto informativo sin votación.",
    };
  }

  // De-duplicate voters by userId to guarantee 1 vote per owner
  const uniqueMap = new Map<string, LphVoterInput>();
  for (const v of voters) {
    if (!uniqueMap.has(v.userId)) {
      uniqueMap.set(v.userId, v);
    }
  }
  const cleanVoters = Array.from(uniqueMap.values());

  let totalApprove = 0;
  let totalReject = 0;
  let totalAbstain = 0;

  let approveFromHome = 0;
  let rejectFromHome = 0;
  let abstainFromHome = 0;

  let approveInPerson = 0;
  let rejectInPerson = 0;
  let abstainInPerson = 0;

  let coeffApprove = 0;
  let coeffReject = 0;
  let coeffAbstain = 0;

  for (const v of cleanVoters) {
    if (v.choice === "APPROVE") {
      totalApprove += 1;
      coeffApprove += v.coefficient;
      if (v.fromHome) approveFromHome += 1;
      else approveInPerson += 1;
    } else if (v.choice === "REJECT") {
      totalReject += 1;
      coeffReject += v.coefficient;
      if (v.fromHome) rejectFromHome += 1;
      else rejectInPerson += 1;
    } else if (v.choice === "ABSTAIN") {
      totalAbstain += 1;
      coeffAbstain += v.coefficient;
      if (v.fromHome) abstainFromHome += 1;
      else abstainInPerson += 1;
    }
  }

  let ownersBase = totalCommunityOwners;
  let coeffBase = totalCommunityCoeff;
  let ownersThresholdFraction = cfg.thresholdOwnersFraction;
  let coeffThresholdFraction = cfg.thresholdCoeffFraction;

  let ownersFavor = totalApprove;
  let coeffFavor = coeffApprove;

  let status: "APPROVED" | "REJECTED" | "PENDING_ABSENTEES" = "REJECTED";
  let statusLabel = "Mayoría no alcanzada";

  if (agreementType === "MAYORIA_SIMPLE") {
    // Art. 17.7 LPH: base is voters who cast approve or reject
    const validVotersCount = totalApprove + totalReject;
    const validCoeffSum = coeffApprove + coeffReject;
    ownersBase = validVotersCount > 0 ? validVotersCount : 1;
    coeffBase = validCoeffSum > 0 ? validCoeffSum : 1;

    const ownersReached = totalApprove > totalReject;
    const coeffReached = coeffApprove > coeffReject;

    const ownersPct =
      validVotersCount > 0 ? (totalApprove / validVotersCount) * 100 : 0;
    const coeffFavorPct =
      validCoeffSum > 0 ? (coeffApprove / validCoeffSum) * 100 : 0;

    const isApproved = ownersReached && coeffReached;
    status = isApproved ? "APPROVED" : "REJECTED";
    statusLabel = isApproved ? "Mayoría alcanzada" : "Mayoría no alcanzada";

    return {
      agreementType,
      requiresVoting: true,
      status,
      statusLabel,
      totalApprove,
      totalReject,
      totalAbstain,
      approveFromHome,
      rejectFromHome,
      abstainFromHome,
      approveInPerson,
      rejectInPerson,
      abstainInPerson,
      ownersFavor,
      ownersBase,
      ownersPct: Number(ownersPct.toFixed(2)),
      ownersThresholdPct: 50,
      ownersThresholdText: ">50 %",
      ownersReached,
      ownersMissing: Math.max(0, totalReject - totalApprove + 1),
      coeffFavor: Number(coeffFavor.toFixed(2)),
      coeffBase: Number(coeffBase.toFixed(2)),
      coeffFavorPct: Number(coeffFavorPct.toFixed(2)),
      coeffThresholdPct: 50,
      coeffThresholdText: ">50 %",
      coeffReached,
      coeffMissingPct: Number(Math.max(0, 50.01 - coeffFavorPct).toFixed(2)),
      summaryText: isApproved
        ? `Aprobado por mayoría simple (${totalApprove} votos a favor, ${totalReject} en contra).`
        : `Rechazado por mayoría simple (${totalReject} votos en contra, ${totalApprove} a favor).`,
    };
  }

  // Qualified majorities: UN_TERCIO, TRES_QUINTOS, UNANIMIDAD
  // Base is total community (e.g. 42 owners and 100% coefficient)
  ownersBase = totalCommunityOwners;
  coeffBase = totalCommunityCoeff;

  const ownersPct = ownersBase > 0 ? (ownersFavor / ownersBase) * 100 : 0;
  const coeffFavorPct = coeffBase > 0 ? (coeffFavor / coeffBase) * 100 : 0;

  const targetOwnersCount = Math.ceil(ownersBase * ownersThresholdFraction);
  const targetCoeffPct = ownersThresholdFraction * 100;

  const ownersReached = ownersFavor >= targetOwnersCount;
  const coeffReached = coeffFavorPct >= targetCoeffPct - 0.001;

  const ownersMissing = Math.max(0, targetOwnersCount - ownersFavor);
  const coeffMissingPct = Number(
    Math.max(0, targetCoeffPct - coeffFavorPct).toFixed(2),
  );

  if (agreementType === "UN_TERCIO") {
    // 1/3 does not allow absentee presumed vote under Art. 17.1 LPH (requires express vote)
    if (ownersReached && coeffReached) {
      status = "APPROVED";
      statusLabel = "Mayoría alcanzada (1/3)";
    } else {
      status = "REJECTED";
      statusLabel = "Mayoría no alcanzada";
    }
  } else if (agreementType === "TRES_QUINTOS") {
    // 3/5 allows Art. 17.8 LPH: absentee notification with 30-day discrepancy period
    if (ownersReached && coeffReached) {
      status = "APPROVED";
      statusLabel = "Mayoría alcanzada (3/5)";
    } else {
      // Check if mathematically reachable via absentees:
      // If reject votes already exceed 2/5 (40%), impossible to reach 3/5
      const maxRejectAllowed = Math.floor(ownersBase * (2 / 5));
      if (totalReject > maxRejectAllowed || coeffReject > 40.0) {
        status = "REJECTED";
        statusLabel = "Mayoría no alcanzada (Rechazado)";
      } else {
        // Can be reached after notifying absentees
        status = "PENDING_ABSENTEES";
        statusLabel = "Mayoría no alcanzada";
      }
    }
  } else if (agreementType === "UNANIMIDAD") {
    // Unanimity (100% owners & coeff, 0 reject)
    if (totalReject > 0) {
      status = "REJECTED";
      statusLabel = "Rechazado (voto en contra)";
    } else if (ownersReached && coeffReached) {
      status = "APPROVED";
      statusLabel = "Aprobado por unanimidad";
    } else {
      // 0 reject in meeting, absentees pending 30 days under Art. 17.8
      status = "PENDING_ABSENTEES";
      statusLabel = "Pendiente de ausentes (Unanimidad)";
    }
  }

  const thresholdPctLabel =
    agreementType === "UN_TERCIO"
      ? "33,3 %"
      : agreementType === "TRES_QUINTOS"
        ? "60%"
        : "100%";

  return {
    agreementType,
    requiresVoting: true,
    status,
    statusLabel,
    totalApprove,
    totalReject,
    totalAbstain,
    approveFromHome,
    rejectFromHome,
    abstainFromHome,
    approveInPerson,
    rejectInPerson,
    abstainInPerson,
    ownersFavor,
    ownersBase,
    ownersPct: Number(ownersPct.toFixed(2)),
    ownersThresholdPct: Number((ownersThresholdFraction * 100).toFixed(1)),
    ownersThresholdText: thresholdPctLabel,
    ownersReached,
    ownersMissing,
    coeffFavor: Number(coeffFavor.toFixed(2)),
    coeffBase: Number(coeffBase.toFixed(2)),
    coeffFavorPct: Number(coeffFavorPct.toFixed(2)),
    coeffThresholdPct: Number((coeffThresholdFraction * 100).toFixed(1)),
    coeffThresholdText: thresholdPctLabel,
    coeffReached,
    coeffMissingPct,
    summaryText:
      status === "APPROVED"
        ? `Acuerdo aprobado (${ownersFavor} de ${ownersBase} propietarios, ${coeffFavorPct.toFixed(1)}% de cuota).`
        : status === "PENDING_ABSENTEES"
          ? `Acuerdo pendiente de cómputo de ausentes (faltan ${ownersMissing} votos favorables).`
          : `Acuerdo no aprobado (requería ${thresholdPctLabel} de votos y cuotas).`,
  };
}
