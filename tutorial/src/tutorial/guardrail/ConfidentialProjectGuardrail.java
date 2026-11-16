package tutorial.guardrail;

import java.util.List;
import java.util.Locale;

import com.axonivy.utils.smart.workflow.guardrails.entity.GuardrailResult;
import com.axonivy.utils.smart.workflow.guardrails.entity.SmartWorkflowInputGuardrail;

/**
 * Custom input guardrail that blocks messages mentioning a confidential Acme Corp project codename.
 * The message never reaches the model: the agent call ends with the BPM error
 * {@code smartworkflow:guardrail:input:violation}.
 */
public class ConfidentialProjectGuardrail implements SmartWorkflowInputGuardrail {

  private static final List<String> CODENAMES = List.of("project falcon", "project aurora", "project titan");

  @Override
  public GuardrailResult evaluate(String message) {
    if (message == null) {
      return GuardrailResult.allow();
    }
    String lower = message.toLowerCase(Locale.ROOT);
    for (String codename : CODENAMES) {
      if (lower.contains(codename)) {
        return GuardrailResult.block("Message blocked: it mentions the confidential project '" + codename
            + "'. Confidential project names must not be sent to an AI model.");
      }
    }
    return GuardrailResult.allow();
  }
}
