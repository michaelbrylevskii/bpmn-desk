package org.bpmndesk.runtimefixture;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.flowable.engine.ProcessEngine;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import com.fasterxml.jackson.databind.ObjectMapper;

@Component
public class FixtureSeed {
    private final ProcessEngine engine;
    private final ServletWebServerApplicationContext context;
    public FixtureSeed(ProcessEngine engine, ServletWebServerApplicationContext context) { this.engine = engine; this.context = context; }

    @EventListener(ApplicationReadyEvent.class)
    public void seed() throws Exception {
        var repository = engine.getRepositoryService();
        for (var name : List.of("review", "parallel", "failure", "parent")) {
            repository.createDeployment().name("BPMN Desk fixture").addClasspathResource("processes/" + name + ".bpmn20.xml").deploy();
        }
        var first = repository.createProcessDefinitionQuery().processDefinitionKey("deskReview").singleResult();
        var vars = Map.<String, Object>of("documentId", "DOC-001", "amount", 42, "approved", false, "reviewers", List.of("alice", "bob", "carol"));
        var review = engine.getRuntimeService().startProcessInstanceById(first.getId(), "review-v1", vars);
        var source = new String(getClass().getResourceAsStream("/processes/review.bpmn20.xml").readAllBytes(), StandardCharsets.UTF_8);
        repository.createDeployment().name("Review v2").addString("processes/review.bpmn20.xml", source.replace("Review document", "Review document v2")).deploy();
        var parallel = engine.getRuntimeService().startProcessInstanceByKey("deskParallel", "parallel-review", vars);
        var failure = engine.getRuntimeService().startProcessInstanceByKey("deskFailure", "failed-delivery", vars);
        var parent = engine.getRuntimeService().startProcessInstanceByKey("deskParent", "parent-review", vars);
        // Ошибка создаётся настоящим async executor и сохраняется самим движком.
        var deadline = System.nanoTime() + 60_000_000_000L;
        while (engine.getManagementService().createDeadLetterJobQuery().processInstanceId(failure.getId()).count() == 0) {
            if (System.nanoTime() > deadline) throw new IllegalStateException("Dead-letter fixture did not become ready");
            Thread.sleep(100);
        }
        var job = engine.getManagementService().createDeadLetterJobQuery().processInstanceId(failure.getId()).singleResult();
        var execution = engine.getRuntimeService().createExecutionQuery().processInstanceId(parallel.getId()).activityId("ReviewA").singleResult();
        engine.getRuntimeService().setVariableLocal(execution.getId(), "localReviewerNote", "execution-specific value");
        var output = Path.of(System.getenv("BPMN_DESK_FIXTURE_OUTPUT"));
        Files.writeString(output, new ObjectMapper().writeValueAsString(Map.of(
            "baseUrl", "http://127.0.0.1:" + context.getWebServer().getPort() + "/process-api/",
            "reviewInstanceId", review.getId(), "reviewDefinitionId", first.getId(), "parallelInstanceId", parallel.getId(),
            "failedInstanceId", failure.getId(), "deadLetterId", job.getId(), "parentInstanceId", parent.getId()
        )));
    }
}
