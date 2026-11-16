package tutorial.guardrail;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.axonivy.utils.smart.workflow.guardrails.entity.GuardrailResult;
import com.axonivy.utils.smart.workflow.guardrails.entity.SmartWorkflowInputGuardrail;

/**
 * Custom input guardrail that does not block: it rewrites the message, replacing Acme Corp
 * employee IDs such as {@code EMP-004211} with a placeholder before the message reaches the model.
 */
public class EmployeeIdRedactionGuardrail implements SmartWorkflowInputGuardrail {

  private static final Pattern EMPLOYEE_ID = Pattern.compile("\\bEMP-\\d{4,6}\\b");
  private static final String PLACEHOLDER = "[EMPLOYEE-ID]";

  @Override
  public GuardrailResult evaluate(String message) {
    if (message == null) {
      return GuardrailResult.allow();
    }
    Matcher matcher = EMPLOYEE_ID.matcher(message);
    if (!matcher.find()) {
      return GuardrailResult.allow();
    }
    return GuardrailResult.allowWithRewrite(matcher.replaceAll(Matcher.quoteReplacement(PLACEHOLDER)));
  }
}
