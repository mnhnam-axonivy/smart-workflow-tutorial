package exercise.purchasing;

public class PurchasingTaxCalculator {

  private static final double DEFAULT_TAX_RATE = 0.10;

  public static void calculate(PurchasingData purchasing) {
    if (purchasing == null || purchasing.getLineItems() == null || purchasing.getLineItems().isEmpty()) {
      purchasing.setSubtotal(0.0);
      purchasing.setTaxAmount(0.0);
      purchasing.setTotalWithTax(0.0);
      purchasing.setTaxBreakdown("");
      return;
    }

    double subtotal = 0;
    double totalTax = 0;
    StringBuilder breakdown = new StringBuilder();

    for (LineItem li : purchasing.getLineItems()) {
      if (li.getItem() == null) {
        continue;
      }
      double lineTotal;
      if (li.getTotalPrice() != null && li.getTotalPrice() > 0) {
        lineTotal = li.getTotalPrice();
      } else if (li.getQuantity() != null && li.getUnitPrice() != null) {
        lineTotal = li.getQuantity() * li.getUnitPrice();
      } else {
        lineTotal = 0.0;
      }
      double rate = getTaxRate(li.getItem().getItemType());
      double lineTax = lineTotal * rate;

      subtotal += lineTotal;
      totalTax += lineTax;

      String itemName = (li.getItem().getName() != null) ? li.getItem().getName() : "Unknown";
      breakdown.append(String.format("%s: %.2f @ %.0f%% tax = %.2f%n",
          itemName, lineTotal, rate * 100, lineTax));
    }

    purchasing.setSubtotal(subtotal);
    purchasing.setTaxAmount(totalTax);
    purchasing.setTotalWithTax(subtotal + totalTax);
    purchasing.setTaxBreakdown(breakdown.toString().trim());
  }

  private static double getTaxRate(ItemType itemType) {
    if (itemType == null) {
      return DEFAULT_TAX_RATE;
    }
    return switch (itemType) {
      case ELECTRONICS -> 0.10;
      case OFFICE_SUPPLIES -> 0.08;
      case FURNITURE -> 0.10;
      case SOFTWARE -> 0.05;
      case SERVICES -> 0.08;
      default -> DEFAULT_TAX_RATE;
    };
  }
}
