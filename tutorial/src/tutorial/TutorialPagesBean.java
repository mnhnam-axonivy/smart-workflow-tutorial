package tutorial;

import java.io.Serializable;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import jakarta.annotation.PostConstruct;
import jakarta.inject.Named;
import jakarta.faces.view.ViewScoped;
import jakarta.faces.context.ExternalContext;
import jakarta.faces.context.FacesContext;

import ch.ivyteam.ivy.cm.ContentObject;
import ch.ivyteam.ivy.cm.ContentObjectValue;
import ch.ivyteam.ivy.environment.Ivy;

@Named
@ViewScoped
public class TutorialPagesBean implements Serializable {

  private static final Pattern CMS_IMG_PATTERN = Pattern.compile("\\(cms:(/[^)]+)\\)");

  private final Map<String, String> features = new LinkedHashMap<>();
  private final Map<String, String> jpFeatures = new LinkedHashMap<>();
  private final Map<String, String> practices = new LinkedHashMap<>();
  private final Map<String, String> jpPractices = new LinkedHashMap<>();
  private final Map<String, String> appendices = new LinkedHashMap<>();
  private final Map<String, String> jpAppendices = new LinkedHashMap<>();
  private List<String> cmsImagePaths = new ArrayList<>();
  private List<String> jpCmsImagePaths = new ArrayList<>();
  private final Map<String, String> jpImageDataUrls = new LinkedHashMap<>();

  @PostConstruct
  public void init() {
    Set<String> seen = new LinkedHashSet<>();
    for (int i = 1; i <= 14; i++) {
      String id = String.format("%02d", i);
      String en = readCmsMarkdown("/Files/Features/feature-" + id);
      String jp = readCmsMarkdownLocale("/Files/Features/feature-" + id, "ja");
      features.put(id, en);
      jpFeatures.put(id, jp);
      collectImagePaths(en, seen);
      collectImagePaths(jp, seen);
    }
    for (int i = 1; i <= 5; i++) {
      String id = String.format("%02d", i);
      String en = readCmsMarkdown("/Files/Practices/practice-" + id);
      String jp = readCmsMarkdownLocale("/Files/Practices/practice-" + id, "ja");
      practices.put(id, en);
      jpPractices.put(id, jp);
      collectImagePaths(en, seen);
      collectImagePaths(jp, seen);
    }
    for (int i = 1; i <= 9; i++) {
      String id = String.format("%02d", i);
      String en = readCmsMarkdown("/Files/Appendix/appendix-" + id);
      String jp = readCmsMarkdownLocale("/Files/Appendix/appendix-" + id, "ja");
      appendices.put(id, en);
      jpAppendices.put(id, jp);
      collectImagePaths(en, seen);
      collectImagePaths(jp, seen);
    }
    cmsImagePaths = new ArrayList<>(seen);

    // Build JP image data URLs for paths that have a "ja" locale variant
    List<String> jpPaths = new ArrayList<>();
    for (String path : seen) {
      String dataUrl = readJpImageDataUrl(path);
      if (!dataUrl.isEmpty()) {
        jpPaths.add(path);
        jpImageDataUrls.put(path, dataUrl);
      }
    }
    jpCmsImagePaths = jpPaths;
  }

  public String getFeature(String id) {
    return features.getOrDefault(id, "");
  }

  public String getJpFeature(String id) {
    return jpFeatures.getOrDefault(id, "");
  }

  public String getPractice(String id) {
    return practices.getOrDefault(id, "");
  }

  public String getJpPractice(String id) {
    return jpPractices.getOrDefault(id, "");
  }

  public String getAppendix(String id) {
    return appendices.getOrDefault(id, "");
  }

  public String getJpAppendix(String id) {
    return jpAppendices.getOrDefault(id, "");
  }

  public List<String> getCmsImagePaths() {
    return cmsImagePaths;
  }

  public List<String> getJpCmsImagePaths() {
    return jpCmsImagePaths;
  }

  public Map<String, String> getJpImageDataUrls() {
    return jpImageDataUrls;
  }

  public String getSessionLang() {
    return "ja".equals(Ivy.session().getContentLocale().getLanguage()) ? "jp" : "en";
  }

  public void exportZip() {
    FacesContext ctx = FacesContext.getCurrentInstance();
    ExternalContext ec = ctx.getExternalContext();

    ec.responseReset();
    ec.setResponseContentType("application/zip");
    ec.setResponseHeader("Content-Disposition", "attachment; filename=\"tutorial-docs.zip\"");

    try (ZipOutputStream zos = new ZipOutputStream(ec.getResponseOutputStream())) {
      for (Map.Entry<String, String> e : features.entrySet()) {
        if (!e.getValue().isEmpty()) {
          addZipEntry(zos, "en/feature-" + e.getKey() + ".md",
              rewriteImageRefs(e.getValue(), false).getBytes(StandardCharsets.UTF_8));
        }
      }
      for (Map.Entry<String, String> e : practices.entrySet()) {
        if (!e.getValue().isEmpty()) {
          addZipEntry(zos, "en/practice-" + e.getKey() + ".md",
              rewriteImageRefs(e.getValue(), false).getBytes(StandardCharsets.UTF_8));
        }
      }
      for (Map.Entry<String, String> e : appendices.entrySet()) {
        if (!e.getValue().isEmpty()) {
          addZipEntry(zos, "en/appendix-" + e.getKey() + ".md",
              rewriteImageRefs(e.getValue(), false).getBytes(StandardCharsets.UTF_8));
        }
      }
      for (Map.Entry<String, String> e : jpFeatures.entrySet()) {
        if (!e.getValue().isEmpty()) {
          addZipEntry(zos, "jp/feature-" + e.getKey() + ".md",
              rewriteImageRefs(e.getValue(), true).getBytes(StandardCharsets.UTF_8));
        }
      }
      for (Map.Entry<String, String> e : jpPractices.entrySet()) {
        if (!e.getValue().isEmpty()) {
          addZipEntry(zos, "jp/practice-" + e.getKey() + ".md",
              rewriteImageRefs(e.getValue(), true).getBytes(StandardCharsets.UTF_8));
        }
      }
      for (Map.Entry<String, String> e : jpAppendices.entrySet()) {
        if (!e.getValue().isEmpty()) {
          addZipEntry(zos, "jp/appendix-" + e.getKey() + ".md",
              rewriteImageRefs(e.getValue(), true).getBytes(StandardCharsets.UTF_8));
        }
      }
      for (String imgPath : cmsImagePaths) {
        String filename = imgPath.substring(imgPath.lastIndexOf('/') + 1) + ".png";
        Optional<ContentObject> obj = Ivy.cm().findObject(imgPath);
        if (obj.map(ContentObject::exists).orElse(false)) {
          try (InputStream is = obj.get().values().getFirst().read().inputStream()) {
            if (is != null) {
              addZipEntry(zos, "images/" + filename, is.readAllBytes());
            }
          }
        }
      }
      for (String imgPath : jpCmsImagePaths) {
        String filename = imgPath.substring(imgPath.lastIndexOf('/') + 1) + ".png";
        Optional<ContentObject> obj = Ivy.cm().findObject(imgPath);
        if (obj.map(ContentObject::exists).orElse(false)) {
          for (ContentObjectValue v : obj.get().values()) {
            if ("ja".equals(v.locale().getLanguage())) {
              try (InputStream is = v.read().inputStream()) {
                if (is != null) {
                  addZipEntry(zos, "images-jp/" + filename, is.readAllBytes());
                }
              }
              break;
            }
          }
        }
      }
    } catch (IOException e) {
      Ivy.log().error("Export ZIP failed", e);
    }

    ctx.responseComplete();
  }

  private String rewriteImageRefs(String md, boolean jpMode) {
    Matcher m = CMS_IMG_PATTERN.matcher(md);
    StringBuffer sb = new StringBuffer();
    while (m.find()) {
      String path = m.group(1);
      String filename = path.substring(path.lastIndexOf('/') + 1);
      if (jpMode && jpImageDataUrls.containsKey(path)) {
        m.appendReplacement(sb, "(../images-jp/" + filename + ".png)");
      } else {
        m.appendReplacement(sb, "(../images/" + filename + ".png)");
      }
    }
    m.appendTail(sb);
    return sb.toString();
  }

  private static void addZipEntry(ZipOutputStream zos, String name, byte[] data) throws IOException {
    zos.putNextEntry(new ZipEntry(name));
    zos.write(data);
    zos.closeEntry();
  }

  private void collectImagePaths(String md, Set<String> seen) {
    Matcher m = CMS_IMG_PATTERN.matcher(md);
    while (m.find()) {
      seen.add(m.group(1));
    }
  }

  private String readJpImageDataUrl(String cmsPath) {
    Optional<ContentObject> obj = Ivy.cm().findObject(cmsPath);
    if (!obj.map(ContentObject::exists).orElse(false)) return "";
    ContentObjectValue target = null;
    for (ContentObjectValue v : obj.get().values()) {
      if ("ja".equals(v.locale().getLanguage())) {
        target = v;
        break;
      }
    }
    if (target == null) return "";
    try (InputStream is = target.read().inputStream()) {
      if (is == null) return "";
      byte[] bytes = is.readAllBytes();
      return "data:image/png;base64," + Base64.getEncoder().encodeToString(bytes);
    } catch (Exception e) {
      Ivy.log().warn("Could not read JP image: " + cmsPath, e);
      return "";
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
    ContentObjectValue target = null;
    for (ContentObjectValue v : obj.get().values()) {
      String lang = v.locale() != null ? v.locale().getLanguage() : "";
      if (!"ja".equals(lang)) {
        target = v;
        break;
      }
    }
    if (target == null) {
      target = obj.get().values().getFirst();
    }
    try (InputStream is = target.read().inputStream()) {
      if (is == null) return "";
      return new String(is.readAllBytes(), StandardCharsets.UTF_8);
    } catch (Exception e) {
      Ivy.log().error("Could not read CMS file: " + cmsPath, e);
      return "";
    }
  }
}
