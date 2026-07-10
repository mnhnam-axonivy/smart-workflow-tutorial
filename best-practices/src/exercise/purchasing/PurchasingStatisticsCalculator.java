package exercise.purchasing;

import java.util.HashSet;
import java.util.Set;

public class PurchasingStatisticsCalculator {

  public static void calculate(PurchasingData purchasing) {
    if (purchasing == null || purchasing.getLineItems() == null || purchasing.getLineItems().isEmpty()) {
      purchasing.setItemCount(0);
      purchasing.setUniqueProductCount(0);
      purchasing.setAverageUnitPrice(0.0);
      purchasing.setTaxPercentage(0.0);
      return;
    }

    int totalQuantity = 0;
    Set<String> uniqueNames = new HashSet<>();
    double totalUnitPrice = 0;
    int priceCount = 0;

    for (LineItem li : purchasing.getLineItems()) {
      if (li.getItem() != null && li.getItem().getName() != null) {
        uniqueNames.add(li.getItem().getName());
      }
      if (li.getQuantity() != null) {
        totalQuantity += li.getQuantity();
      }
      if (li.getUnitPrice() != null && li.getUnitPrice() > 0) {
        totalUnitPrice += li.getUnitPrice();
        priceCount++;
      }
    }

    purchasing.setItemCount(totalQuantity);
    purchasing.setUniqueProductCount(uniqueNames.size());
    purchasing.setAverageUnitPrice(priceCount > 0 ? totalUnitPrice / priceCount : 0.0);

    double subtotal = purchasing.getSubtotal() != null ? purchasing.getSubtotal() : 0;
    double taxAmount = purchasing.getTaxAmount() != null ? purchasing.getTaxAmount() : 0;
    purchasing.setTaxPercentage(subtotal > 0 ? (taxAmount / subtotal) * 100 : 0.0);
  }
}
