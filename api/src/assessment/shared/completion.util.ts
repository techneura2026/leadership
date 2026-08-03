import { AssessmentParticipant } from '../engine/entities/assessment-participant.entity';
import { RaterNomination } from '../uc1-feedback/entities/rater-nomination.entity';

/** True once every participant has finished their part (or withdrawn). */
export function allParticipantsDone(participants: AssessmentParticipant[]): boolean {
  return (
    participants.length > 0 &&
    participants.every((p) => p.status === 'completed' || p.status === 'withdrawn')
  );
}

/** True once every rater nomination has reached a terminal state (360 only). */
export function allNominationsDone(nominations: RaterNomination[]): boolean {
  return (
    nominations.length > 0 &&
    nominations.every((n) => n.status === 'completed' || n.status === 'declined')
  );
}
