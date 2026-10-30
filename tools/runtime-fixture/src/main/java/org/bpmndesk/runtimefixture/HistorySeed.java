package org.bpmndesk.runtimefixture;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.flowable.engine.ProcessEngine;

/** Оригинальный MIT-сценарий: два прохода вложенной задачи и завершённый вызванный процесс. */
final class HistorySeed {
    static Map<String, String> seed(ProcessEngine engine) throws Exception {
        var repository = engine.getRepositoryService();
        repository.createDeployment().name("History v1").addClasspathResource("processes/history.bpmn20.xml").deploy();
        var definition = repository.createProcessDefinitionQuery().processDefinitionKey("deskHistory").singleResult();
        var instance = engine.getRuntimeService().startProcessInstanceById(definition.getId(), "HISTORY:ORDER:123", Map.of("round", 0, "approved", false));
        for (int round = 1; round <= 2; round++) {
            var task = engine.getTaskService().createTaskQuery().processInstanceId(instance.getId()).taskDefinitionKey("HistoryReview").singleResult();
            engine.getTaskService().setAssignee(task.getId(), round == 1 ? "alice" : "bob");
            engine.getTaskService().setVariableLocal(task.getId(), "reviewerNote", round == 1 ? "First review" : "Final review");
            engine.getTaskService().complete(task.getId(), Map.of("round", round));
        }
        var child = engine.getRuntimeService().createProcessInstanceQuery().superProcessInstanceId(instance.getId()).singleResult();
        var childTask = engine.getTaskService().createTaskQuery().processInstanceId(child.getId()).singleResult();
        engine.getTaskService().complete(childTask.getId());
        var source = new String(HistorySeed.class.getResourceAsStream("/processes/history.bpmn20.xml").readAllBytes(), StandardCharsets.UTF_8);
        repository.createDeployment().name("History v2").addString("processes/history.bpmn20.xml", source.replace("Historical review", "Historical review v2")).deploy();
        var terminated = engine.getRuntimeService().startProcessInstanceById(definition.getId(), "HISTORY:TERMINATED");
        engine.getRuntimeService().deleteProcessInstance(terminated.getId(), "Fixture cancellation");
        return Map.of("historyInstanceId", instance.getId(), "historyDefinitionId", definition.getId(), "historyChildId", child.getId(), "terminatedInstanceId", terminated.getId());
    }
}
