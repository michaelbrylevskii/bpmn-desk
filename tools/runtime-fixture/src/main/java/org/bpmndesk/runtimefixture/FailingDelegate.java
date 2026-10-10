package org.bpmndesk.runtimefixture;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
public class FailingDelegate implements JavaDelegate {
    public void execute(DelegateExecution execution) {
        throw new IllegalStateException("Fixture failure: remote system is unavailable");
    }
}
