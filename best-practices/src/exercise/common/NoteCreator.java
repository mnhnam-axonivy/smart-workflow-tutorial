package exercise.common;

import ch.ivyteam.ivy.environment.Ivy;
import ch.ivyteam.ivy.security.exec.Sudo;

public class NoteCreator {

  public static void addNote(String note) {
    Sudo.get(() -> {
      Ivy.wfTask().getCase().createNote(Ivy.session(), note);
      return null;
    });
  }
}
