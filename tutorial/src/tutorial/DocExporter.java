package tutorial;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class DocExporter {

  // Same regex as TutorialPagesBean — matches (cms:/Files/Images/xxx)
  private static final Pattern CMS_IMG_PATTERN = Pattern.compile("\\(cms:(/[^)]+)\\)");

  /**
   * Exports all tutorial markdown docs and referenced images to outputPath.
   *
   * @param projectDir  Absolute path to the tutorial project root (contains doc/, cms/)
   * @param outputPath  Absolute path of the desired export root directory
   * @return            Multi-line human-readable summary of files written and any warnings
   */
  public static String export(String projectDir, String outputPath) {
    List<String> log = new ArrayList<>();
    List<String> warnings = new ArrayList<>();

    Path root    = Path.of(projectDir);
    Path outRoot = Path.of(outputPath);
    Path enSrc   = root.resolve("doc");
    Path jpSrc   = root.resolve("doc/jp");
    Path imgsSrc = root.resolve("cms/Files/Images");

    try {
      Files.createDirectories(outRoot.resolve("en"));
      Files.createDirectories(outRoot.resolve("jp"));
      Files.createDirectories(outRoot.resolve("images"));
    } catch (IOException e) {
      return "ERROR: Could not create output directories — " + e.getMessage();
    }

    exportMarkdownDir(enSrc, outRoot.resolve("en"), log, warnings);
    exportMarkdownDir(jpSrc, outRoot.resolve("jp"), log, warnings);
    copyImages(imgsSrc, outRoot.resolve("images"), log, warnings);

    StringBuilder sb = new StringBuilder("Export completed → ").append(outRoot.toAbsolutePath()).append("\n");
    log.forEach(l -> sb.append(l).append("\n"));
    if (!warnings.isEmpty()) {
      sb.append("Warnings:\n");
      warnings.forEach(w -> sb.append(w).append("\n"));
    }
    return sb.toString();
  }

  private static void exportMarkdownDir(Path src, Path dest, List<String> log, List<String> warnings) {
    if (!Files.isDirectory(src)) {
      warnings.add("  [WARN] Source not found: " + src);
      return;
    }
    try (var stream = Files.list(src)) {
      stream.filter(p -> p.toString().endsWith(".md")).sorted().forEach(f -> {
        try {
          String content   = Files.readString(f, StandardCharsets.UTF_8);
          String rewritten = rewriteImageRefs(content);
          Files.writeString(dest.resolve(f.getFileName()), rewritten, StandardCharsets.UTF_8);
          log.add("  [md]  " + dest.getFileName() + "/" + f.getFileName());
        } catch (IOException e) {
          warnings.add("  [WARN] " + f.getFileName() + ": " + e.getMessage());
        }
      });
    } catch (IOException e) {
      warnings.add("  [WARN] Could not list " + src + ": " + e.getMessage());
    }
  }

  private static void copyImages(Path src, Path dest, List<String> log, List<String> warnings) {
    if (!Files.isDirectory(src)) {
      warnings.add("  [WARN] Images directory not found: " + src);
      return;
    }
    try (var stream = Files.list(src)) {
      stream.filter(p -> p.toString().toLowerCase().matches(".*\\.(png|jpg|jpeg|gif)"))
            .sorted()
            .forEach(f -> {
              try {
                Files.copy(f, dest.resolve(f.getFileName()), StandardCopyOption.REPLACE_EXISTING);
                log.add("  [img] " + f.getFileName());
              } catch (IOException e) {
                warnings.add("  [WARN] Could not copy " + f.getFileName() + ": " + e.getMessage());
              }
            });
    } catch (IOException e) {
      warnings.add("  [WARN] Could not list images: " + e.getMessage());
    }
  }

  /**
   * Rewrites (cms:/Files/Images/xxx) → (../images/xxx.png)
   * The "../" prefix navigates from en/ or jp/ up to the shared images/ folder.
   */
  static String rewriteImageRefs(String markdown) {
    Matcher m = CMS_IMG_PATTERN.matcher(markdown);
    StringBuffer sb = new StringBuffer();
    while (m.find()) {
      String filename = Path.of(m.group(1)).getFileName().toString();
      m.appendReplacement(sb, "(../images/" + filename + ".png)");
    }
    m.appendTail(sb);
    return sb.toString();
  }
}
