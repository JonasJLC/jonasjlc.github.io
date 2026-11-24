import { createForslagApi } from '../../../lib/forslag/api';
import { areaLabels } from '../../../lib/forslag/model';
import { getClient } from './remote';

// The Forslag logic is shared with /strandparken/ (src/lib/forslag), bound here to Ferieplan requests.
export * from '../../../lib/forslag/model';
export const { askChat, loadBoard, saveRequest, triage, subscribeRequests, loadIssueStates } = createForslagApi(getClient, 'ferie');
export const AREA_LABEL = areaLabels('ferie'); // keeps the existing import in Chat.tsx and RequestList.tsx working
