package exercise.purchasing;

import java.util.Locale;

public enum Region {
  US("/region/US",  Locale.ENGLISH),
  EU("/region/EU",  Locale.ENGLISH),
  JP("/region/JP",  Locale.JAPANESE);

  private final String titleCms;
  private final Locale locale;

  Region(String titleCms, Locale locale) {
    this.titleCms = titleCms;
    this.locale = locale;
  }

  public String getTitleCms() {
    return titleCms;
  }

  public Locale getLocale() {
    return locale;
  }
}
