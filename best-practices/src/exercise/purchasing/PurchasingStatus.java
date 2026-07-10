package exercise.purchasing;

public enum PurchasingStatus {
  DRAFT("Draft"),
  SUBMITTED("Submitted");

  private final String displayName;

  PurchasingStatus(String displayName) {
    this.displayName = displayName;
  }

  public String getDisplayName() {
    return displayName;
  }
}
