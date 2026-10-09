import type { Translator } from '../../shared/i18n';
export const emptyDiagram = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="urn:bpmn-desk">
  <bpmn:process id="Process_1" name="Новый процесс" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="Начало" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_1"><bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1">
    <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1"><dc:Bounds x="240" y="200" width="36" height="36" /></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;

/** Локализуются только подписи вновь созданной схемы. */
export const diagramTemplate = (t: Translator): string => emptyDiagram.replace('Новый процесс', t('Новый процесс')).replace('Начало', t('Начало'));
