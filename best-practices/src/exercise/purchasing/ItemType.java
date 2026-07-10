package exercise.purchasing;

public enum ItemType {
  ELECTRONICS("/itemType/ELECTRONICS"),
  OFFICE_SUPPLIES("/itemType/OFFICE_SUPPLIES"),
  FURNITURE("/itemType/FURNITURE"),
  SOFTWARE("/itemType/SOFTWARE"),
  SERVICES("/itemType/SERVICES"),
  OTHER("/itemType/OTHER");

  private final String titleCms;

  ItemType(String titleCms) {
    this.titleCms = titleCms;
  }

  public String getTitleCms() {
    return titleCms;
  }
}
