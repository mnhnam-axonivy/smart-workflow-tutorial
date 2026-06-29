package tutorial.tool;

import java.util.List;
import java.util.Map;

import com.axonivy.utils.smart.workflow.tools.provider.SmartWorkflowTool;

public class FxRateConverterTool implements SmartWorkflowTool {

  private static final Map<String, Double> RATES_TO_USD = Map.of(
      "USD", 1.0,
      "EUR", 1.09,
      "GBP", 1.27,
      "JPY", 0.0067,
      "CHF", 1.13,
      "AUD", 0.65,
      "CAD", 0.74,
      "SGD", 0.75
  );

  @Override
  public String name() {
    return "convertToUSD";
  }

  @Override
  public String description() {
    return """
        Convert an invoice amount from its original currency to USD using fixed exchange rates.
        Pass the total amount as a plain number string and the ISO 4217 currency code.
        Returns the converted amount as a formatted string showing the original amount, USD equivalent, and rate used.""";
  }

  @Override
  public List<ToolParameter> parameters() {
    return List.of(
        new ToolParameter("amount",
            "Invoice total amount as a plain number string (digits and decimal point only)",
            "String"),
        new ToolParameter("currency",
            "ISO 4217 currency code of the invoice (e.g. JPY, EUR, GBP, USD)",
            "String")
    );
  }

  @Override
  public Object execute(Map<String, Object> args) {
    String amountStr = (String) args.get("amount");
    String currency = ((String) args.get("currency")).toUpperCase().trim();

    double amount = Double.parseDouble(amountStr.replaceAll("[^0-9.]", ""));
    double rate = RATES_TO_USD.getOrDefault(currency, 1.0);
    double usd = amount * rate;

    return String.format("%.2f %s = %.2f USD (rate: %.4f)", amount, currency, usd, rate);
  }
}
