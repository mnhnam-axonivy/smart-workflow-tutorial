package tutorial.guardrail;

import java.util.List;

import com.axonivy.utils.smart.workflow.guardrails.entity.SmartWorkflowInputGuardrail;
import com.axonivy.utils.smart.workflow.guardrails.provider.GuardrailProvider;

/**
 * Exposes the tutorial's custom guardrails to Smart Workflow.
 * Registered in META-INF/services/com.axonivy.utils.smart.workflow.guardrails.provider.GuardrailProvider.
 */
public class TutorialGuardrailProvider implements GuardrailProvider {

  @Override
  public List<SmartWorkflowInputGuardrail> getInputGuardrails() {
    return List.of(new ConfidentialProjectGuardrail(), new EmployeeIdRedactionGuardrail());
  }
}
