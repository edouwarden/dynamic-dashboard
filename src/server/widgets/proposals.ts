/**
 * Gestion des proposals de tables en attente d'approbation (in-memory store)
 * Utilisé par tables.ts et widget-sessions.ts
 */

import { v4 as uuidv4 } from 'uuid';

export interface TableProposal {
  id: string;
  widgetId: string;
  type: 'create' | 'alter';
  name: string;
  schema?: any;
  alterations?: any;
  createdAt: string;
}

const pendingProposals = new Map<string, TableProposal[]>();

export function addProposal(widgetId: string, proposal: TableProposal) {
  const list = pendingProposals.get(widgetId) || [];
  list.push(proposal);
  pendingProposals.set(widgetId, list);
}

export function getProposals(widgetId: string): TableProposal[] {
  return pendingProposals.get(widgetId) || [];
}

export function consumeProposals(widgetId: string): TableProposal[] {
  const list = pendingProposals.get(widgetId) || [];
  pendingProposals.delete(widgetId);
  return list;
}

export function removeProposal(widgetId: string, proposalId: string): TableProposal | undefined {
  const list = pendingProposals.get(widgetId) || [];
  const index = list.findIndex(p => p.id === proposalId);
  if (index === -1) return undefined;
  const [removed] = list.splice(index, 1);
  pendingProposals.set(widgetId, list);
  return removed;
}

export function createProposalId(): string {
  return uuidv4();
}
