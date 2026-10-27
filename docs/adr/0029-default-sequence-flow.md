# 0029 — Поток по умолчанию в свойствах стрелки

## Контекст

Узел уже позволяет выбрать default из исходящих SequenceFlow. На самой стрелке эта настройка была недоступна; элемент flowable:is-default-flow может ошибочно восприниматься как обязательный второй способ задания потока.

## Решение

В «Основные · BPMN» у SequenceFlow показывается поле «Поток по умолчанию», если исходный узел имеет стандартное свойство default. Поле меняет default исходного узла через modeling.updateProperties и общий command stack этого документа. Включение заменяет предыдущую стрелку по умолчанию; выключение снимает только текущую. Поле узла и поле стрелки читают одну модель.

Список исходящих стрелок для поля узла вычисляется по sourceRef: наличие явных outgoing в импортированном XML не требуется.

Используется стандартный default="flowId" на задаче/шлюзе. Это описано в [документации Flowable](https://www.flowable.com/open-source/docs/bpmn/ch07b-BPMN-Constructs#default-sequence-flow) и реализовано в [BaseBpmnXMLConverter](https://github.com/flowable/flowable-engine/blob/main/modules/flowable-bpmn-converter/src/main/java/org/flowable/bpmn/converter/BaseBpmnXMLConverter.java). В проверенном конвертере нет трактовки flowable:is-default-flow как замены default.

## Альтернативы и последствия

Дублирование состояния в extensionElements не вводится: оно создало бы два потенциально противоречивых источника истины. Существующий неизвестный XML внутри extensionElements сохраняется и доступен в XML-редакторе расширений. Условия на стрелках не удаляются; согласно документации Flowable условие default-потока движок игнорирует.
