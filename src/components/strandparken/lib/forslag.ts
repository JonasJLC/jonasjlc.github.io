import { createForslagApi } from '../../../lib/forslag/api';
import { getClient } from './auth';

export * from '../../../lib/forslag/model';
/** Forslag backend calls bound to Strandparken requests. */
export const { askChat, loadBoard, saveRequest, triage, subscribeRequests, loadIssueStates } = createForslagApi(getClient, 'strandparken');
