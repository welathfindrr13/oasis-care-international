import { registerEnumType } from '@nestjs/graphql';
import {
  AccessGrantScope,
  CareRoomMembershipStatus,
  CareRoomRole,
  CareRoomStatus,
  CarebridgeContentStatus,
  ConcernCategory,
  ConcernEventType,
  ConcernOutcome,
  ConcernPriority,
  ConcernSeverity,
  ConcernStatus,
  FamilyAccessBasis,
} from '@oasis/db';

registerEnumType(CareRoomStatus, { name: 'CareRoomStatus' });
registerEnumType(CareRoomRole, { name: 'CareRoomRole' });
registerEnumType(CareRoomMembershipStatus, { name: 'CareRoomMembershipStatus' });
registerEnumType(FamilyAccessBasis, { name: 'FamilyAccessBasis' });
registerEnumType(AccessGrantScope, { name: 'AccessGrantScope' });
registerEnumType(CarebridgeContentStatus, { name: 'CarebridgeContentStatus' });
registerEnumType(ConcernSeverity, { name: 'ConcernSeverity' });
registerEnumType(ConcernPriority, { name: 'ConcernPriority' });
registerEnumType(ConcernStatus, { name: 'ConcernStatus' });
registerEnumType(ConcernCategory, { name: 'ConcernCategory' });
registerEnumType(ConcernOutcome, { name: 'ConcernOutcome' });
registerEnumType(ConcernEventType, { name: 'ConcernEventType' });

export {
  AccessGrantScope,
  CareRoomMembershipStatus,
  CareRoomRole,
  CareRoomStatus,
  CarebridgeContentStatus,
  ConcernCategory,
  ConcernEventType,
  ConcernOutcome,
  ConcernPriority,
  ConcernSeverity,
  ConcernStatus,
  FamilyAccessBasis,
};
