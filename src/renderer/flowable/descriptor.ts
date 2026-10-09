export const FLOWABLE_URI = 'http://flowable.org/bpmn';

// Реестр форм, а не moddle descriptor. XML сохраняется как generic extensions.
export const flowableStrings = [
  'class', 'expression', 'delegateExpression', 'resultVariableName', 'type',
  'assignee', 'owner', 'candidateUsers', 'candidateGroups', 'dueDate', 'priority',
  'category', 'formKey', 'formFieldValidation', 'taskIdVariableName',
  'initiator', 'candidateStarterUsers', 'candidateStarterGroups', 'historyLevel',
  'jobPriority', 'calledElementType', 'calledElement', 'collection', 'elementVariable',
  'elementIndexVariable', 'businessKey', 'sourceDockerX', 'sourceDockerY',
  'targetDockerX', 'targetDockerY', 'eventType', 'eventName', 'errorVariableName',
  'errorVariableLocalScope', 'errorVariableTransient', 'triggerable',
];

export const flowableBooleans = [
  'async', 'asyncLeave', 'exclusive', 'asyncLeaveExclusive', 'inheritVariables',
  'inheritBusinessKey', 'sameDeployment', 'fallbackToDefaultTenant',
  'autoStoreVariables',
];
