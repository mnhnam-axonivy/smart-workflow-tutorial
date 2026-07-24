package exercise.purchasing.bean;

import java.io.Serializable;
import java.util.Locale;

import jakarta.faces.application.FacesMessage;
import jakarta.inject.Named;
import jakarta.faces.view.ViewScoped;
import jakarta.faces.context.FacesContext;

import ch.ivyteam.ivy.environment.Ivy;
import ch.ivyteam.ivy.scripting.objects.List;
import ch.ivyteam.ivy.security.exec.Sudo;
import exercise.purchasing.Item;
import exercise.purchasing.ItemType;
import exercise.purchasing.LineItem;
import exercise.purchasing.PurchasingData;
import exercise.purchasing.PurchasingStatus;
import exercise.purchasing.Region;

@Named
@ViewScoped
public class PurchasingFormBean implements Serializable {

  private static final long serialVersionUID = 1L;

  private PurchasingData purchasing;

  /**
   * Called by XHTML:
   *   <f:event listener="#{purchasingFormBean.preRender(data.purchasing)}" type="preRenderComponent" />
   */
  public void preRender(PurchasingData p) {
    this.purchasing = p != null ? p : new PurchasingData();
    if (this.purchasing.getLineItems() == null) {
      this.purchasing.setLineItems(new List<>());
    }
    if (this.purchasing.getStatus() == null) {
      this.purchasing.setStatus(PurchasingStatus.DRAFT);
    }
    if (this.purchasing.getRegion() == null) {
      Locale sessionLocale = Ivy.session().getContentLocale();
      Region defaultRegion = Region.EU;
      for (Region r : Region.values()) {
        if (r.getLocale().getLanguage().equals(sessionLocale.getLanguage())) {
          defaultRegion = r;
          break;
        }
      }
      this.purchasing.setRegion(defaultRegion);
    }
  }

  public void addLineItem() {
    LineItem lineItem = new LineItem();
    lineItem.setItem(new Item());
    purchasing.getLineItems().add(lineItem);
    recalculateTotal();
  }

  public void removeLineItem(LineItem lineItem) {
    purchasing.getLineItems().remove(lineItem);
    recalculateTotal();
  }

  private void recalculateTotal() {
    double total = 0;
    for (LineItem li : purchasing.getLineItems()) {
      if (li.getQuantity() != null && li.getUnitPrice() != null) {
        double lineTotal = li.getQuantity() * li.getUnitPrice();
        li.setTotalPrice(lineTotal);
        total += lineTotal;
      }
    }
    purchasing.setTotalAmount(total);
  }

  public void validate() {
    recalculateTotal();
    FacesContext fc = FacesContext.getCurrentInstance();
    if (purchasing.getLineItems() == null || purchasing.getLineItems().isEmpty()) {
      fc.addMessage("form:form-messages",
          new FacesMessage(FacesMessage.SEVERITY_ERROR, "Line Items Required",
              "Please add at least one line item before submitting."));
      fc.validationFailed();
    }
  }

  public ItemType[] getItemTypeValues() {
    return ItemType.values();
  }

  public Region[] getRegionValues() {
    return Region.values();
  }

  public void onRegionChange() {
    if (purchasing.getRegion() != null) {
      Sudo.get(() -> {
        Ivy.session().setContentLocale(purchasing.getRegion().getLocale());
        return null;
      });
    }
  }

  public PurchasingData getPurchasing() {
    return purchasing;
  }

  public void setPurchasing(PurchasingData purchasing) {
    this.purchasing = purchasing;
  }
}
