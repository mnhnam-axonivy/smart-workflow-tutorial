package tutorial;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.annotation.PostConstruct;
import javax.faces.bean.ManagedBean;
import javax.faces.bean.ViewScoped;

import ch.ivyteam.ivy.cm.ContentObject;
import ch.ivyteam.ivy.cm.ContentObjectValue;
import ch.ivyteam.ivy.environment.Ivy;

@ManagedBean
@ViewScoped
public class TutorialPagesBean {

  private static final Pattern CMS_IMG_PATTERN = Pattern.compile("\\(cms:(/[^)]+)\\)");

  private final Map<String, String> features = new LinkedHashMap<>();
  private final Map<String, String> jpFeatures = new LinkedHashMap<>();
  private List<String> cmsImagePaths = new ArrayList<>();

  @PostConstruct
  public void init() {
    Set<String> seen = new LinkedHashSet<>();
    for (int i = 1; i <= 7; i++) {
      String id = String.format("%02d", i);
      String en = readCmsMarkdown("/Files/Features/feature-" + id);
      String jp = readCmsMarkdownLocale("/Files/Features/feature-" + id, "ja");
      features.put(id, en);
      jpFeatures.put(id, jp);
      collectImagePaths(en, seen);
      collectImagePaths(jp, seen);
    }
    cmsImagePaths = new ArrayList<>(seen);
  }

  public String getFeature(String id) {
    return features.getOrDefault(id, "");
  }

  public String getJpFeature(String id) {
    return jpFeatures.getOrDefault(id, "");
  }

  public List<String> getCmsImagePaths() {
    return cmsImagePaths;
  }

  private void collectImagePaths(String md, Set<String> seen) {
    Matcher m = CMS_IMG_PATTERN.matcher(md);
    while (m.find()) {
      seen.add(m.group(1));
    }
  }

  private String readCmsMarkdownLocale(String cmsPath, String langCode) {
    Optional<ContentObject> obj = Ivy.cm().findObject(cmsPath);
    if (!obj.map(ContentObject::exists).orElse(false)) {
      Ivy.log().warn("CMS file not found: " + cmsPath);
      return "";
    }
    ContentObjectValue target = null;
    for (ContentObjectValue v : obj.get().values()) {
      if (langCode.equals(v.locale().getLanguage())) {
        target = v;
        break;
      }
    }
    if (target == null) return "";
    try (InputStream is = target.read().inputStream()) {
      if (is == null) return "";
      return new String(is.readAllBytes(), StandardCharsets.UTF_8);
    } catch (Exception e) {
      Ivy.log().error("Could not read CMS file: " + cmsPath + " locale: " + langCode, e);
      return "";
    }
  }

  private String readCmsMarkdown(String cmsPath) {
    Optional<ContentObject> obj = Ivy.cm().findObject(cmsPath);
    if (!obj.map(ContentObject::exists).orElse(false)) {
      Ivy.log().warn("CMS file not found: " + cmsPath);
      return "";
    }
    try (InputStream is = obj.map(ContentObject::values)
                             .map(v -> v.getFirst().read().inputStream())
                             .orElse(null)) {
      if (is == null) return "";
      return new String(is.readAllBytes(), StandardCharsets.UTF_8);
    } catch (Exception e) {
      Ivy.log().error("Could not read CMS file: " + cmsPath, e);
      return "";
    }
  }
}
