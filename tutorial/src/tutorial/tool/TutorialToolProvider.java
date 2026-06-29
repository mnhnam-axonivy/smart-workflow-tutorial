package tutorial.tool;

import java.util.List;

import com.axonivy.utils.smart.workflow.tools.provider.SmartWorkflowTool;
import com.axonivy.utils.smart.workflow.tools.provider.SmartWorkflowToolsProvider;

public class TutorialToolProvider implements SmartWorkflowToolsProvider {

  @Override
  public List<SmartWorkflowTool> getTools() {
    return List.of(new FxRateConverterTool());
  }
}
