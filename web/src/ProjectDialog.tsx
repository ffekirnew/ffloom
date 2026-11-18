import { useState } from "react";
import { Project, api } from "./api";
import { Dialog } from "./ui";

// Creates a project, or edits one's name and description.
export function ProjectDialog({ project, onClose, onSaved }: {
  project?: Project;
  onClose: () => void;
  onSaved: (p: Project) => void;
}) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const changed = !project || name.trim() !== project.name || description.trim() !== project.description;

  const save = async () => {
    if (!name.trim() || !changed) return;
    setBusy(true);
    setError(null);
    try {
      const body = { name: name.trim(), description: description.trim() };
      const saved = project ? await api.updateProject(project.id, body) : await api.createProject(body.name, body.description);
      onSaved(saved);
      onClose();
    } catch (e) {
      // e.g. "409: a project named 'home' already exists": show it next to the field
      setError(e instanceof Error ? e.message.replace(/^\d+: /, "") : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={project ? "Edit project" : "New project"} onClose={onClose} onSubmit={save} actions={
      <>
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn primary" disabled={!name.trim() || !changed || busy}>
          {project ? "Save" : "Create"}
        </button>
      </>
    }>
      <label className="dialog-field">Name
        <input type="text" value={name} autoFocus placeholder="e.g. self-host" onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="dialog-field">Description <span className="optional">optional</span>
        <textarea rows={3} value={description} placeholder="What goes in this project?" onChange={(e) => setDescription(e.target.value)} />
      </label>
      {error && <p className="dialog-error">{error}</p>}
    </Dialog>
  );
}
