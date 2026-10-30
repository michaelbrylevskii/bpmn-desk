import type { DeadLetterJob } from '../../shared/runtime';

export interface MonitorDestination { kind: 'instance' | 'definition' | 'job'; id: string; name: string; businessKey?: string; version?: number }
export interface MonitorVisit { definitionId: string; instanceId: string; history: boolean; job?: DeadLetterJob; destination: MonitorDestination }
export interface MonitorNavigation { current?: MonitorVisit; past: MonitorVisit[]; future: MonitorVisit[] }
export type NavigationAction = { type: 'open'; visit: MonitorVisit; leaving?: MonitorDestination }
  | { type: 'move'; direction: 'back' | 'forward'; leaving?: MonitorDestination }
  | { type: 'mode'; history: boolean };
const limit = 100;
const identify = (visit: MonitorVisit) => visit.job ? `job:${visit.job.id}` : visit.instanceId ? `instance:${visit.instanceId}` : `definition:${visit.definitionId}`;
export function navigateMonitor(state: MonitorNavigation, action: NavigationAction): MonitorNavigation {
  if (action.type === 'mode') return state.current ? { ...state, current: { ...state.current, history: action.history } } : state;
  const current = state.current && { ...state.current, destination: action.leaving ?? state.current.destination };
  if (action.type === 'open') {
    if (current && identify(current) === identify(action.visit)) return { ...state, current: { ...action.visit, destination: action.visit.destination.name ? action.visit.destination : current.destination } };
    return { current: action.visit, past: current ? [...state.past, current].slice(-limit) : state.past, future: [] };
  }
  const source = action.direction === 'back' ? state.past : state.future;
  const target = source.at(-1);
  if (!target || !current) return state;
  return action.direction === 'back'
    ? { current: target, past: state.past.slice(0, -1), future: [...state.future, current].slice(-limit) }
    : { current: target, past: [...state.past, current].slice(-limit), future: state.future.slice(0, -1) };
}
