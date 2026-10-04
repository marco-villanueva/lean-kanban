import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Column } from "../api";
import ColorPicker from "./ColorPicker";

export default function IssueDrawer({ issueId, columns, onClose, onChanged }: {
  issueId: string; columns: Column[]; onClose: () => void; onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState("");
  const [comment, setComment] = useState("");
  const [commentMenu, setCommentMenu] = useState<string | null>(null);
  const [issueMenu, setIssueMenu] = useState(false);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [error, setError] = useState("");

  const detail = useQuery({ queryKey: ["issue", issueId], queryFn: () => api.getIssue(issueId) });
  const refresh = () => {
    detail.refetch();
    onChanged();
    qc.invalidateQueries({ queryKey: ["issue", issueId] });
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !editingComment) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, editingComment]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest?.(".menu-wrap")) {
        setIssueMenu(false);
        setCommentMenu(null);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const issue = detail.data?.issue;
  const current = issue ? columns.find((column) => column.id === issue.columnId) : undefined;

  const saveTitle = useMutation({
    mutationFn: () => api.updateIssue(issueId, { title: title.trim() }),
    onSuccess: () => { setTitle(""); setEditing(false); refresh(); },
    onError: (e: any) => setError(e.message),
  });
  const saveDesc = useMutation({
    mutationFn: () => api.updateIssue(issueId, { description: desc }),
    onSuccess: () => { setEditingDesc(false); refresh(); },
    onError: (e: any) => setError(e.message),
  });
  const remove = useMutation({
    mutationFn: () => api.deleteIssue(issueId),
    onSuccess: () => { onChanged(); onClose(); },
    onError: (e: any) => setError(e.message),
  });
  const addComment = useMutation({
    mutationFn: () => api.addComment(issueId, comment.trim()),
    onSuccess: () => { setComment(""); refresh(); },
    onError: (e: any) => setError(e.message),
  });

  async function moveTo(columnId: string) {
    if (!issue || columnId === issue.columnId) return;
    setError("");
    try {
      await api.moveIssue(issueId, columnId, 999);
      refresh();
    } catch (e: any) { setError(e.message); }
  }

  async function setColor(color: string | null) {
    setError("");
    try {
      await api.updateIssue(issueId, { color });
      refresh();
    } catch (e: any) { setError(e.message); }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={issue ? issue.title : "Issue detail"} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <span className="muted">#{issueId.slice(0, 4)}</span>
          <div className="row">
            <div className="menu-wrap">
              <button className="icon-btn" aria-label="Issue actions" aria-haspopup="menu"
                aria-expanded={issueMenu} onClick={() => setIssueMenu((value) => !value)}>
                ⋯
              </button>
              {issueMenu && (
                <div className="menu" role="menu">
                  <button className="menu-item danger" role="menuitem" onClick={() => {
                    setIssueMenu(false);
                    if (confirm("Delete issue?")) remove.mutate();
                  }}>Delete issue</button>
                </div>
              )}
            </div>
            <button className="icon-btn" onClick={onClose} aria-label="Close issue">×</button>
          </div>
        </div>

        {detail.isLoading && <p className="muted">Loading…</p>}
        {detail.isError && <div className="error">Could not load issue. Try again.</div>}
        {error && <div className="error">{error}</div>}

        {issue && (
          <>
            {!editing ? (
              <div className="drawer-title-row">
                <h2 className="drawer-title">{issue.title}</h2>
                <button className="btn-ghost" onClick={() => { setTitle(issue.title); setEditing(true); }}>Edit</button>
              </div>
            ) : (
              <div className="drawer-edit">
                <label className="field-label">Title</label>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Issue title" />
                <div className="row">
                  <button className="btn primary" disabled={!title.trim()} onClick={() => saveTitle.mutate()}>Save</button>
                  <button className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </div>
            )}

            <div className="drawer-section">
              <div className="field-label">Description</div>
              {!editingDesc ? (
                issue.description ? (
                  <div className="row" style={{ alignItems: "flex-start" }}>
                    <p className="drawer-desc" style={{ flex: 1 }}>{issue.description}</p>
                    <button className="btn-ghost" onClick={() => { setDesc(issue.description); setEditingDesc(true); }}>Edit</button>
                  </div>
                ) : (
                  <button className="add-ghost" onClick={() => { setDesc(""); setEditingDesc(true); }}>Add a description…</button>
                )
              ) : (
                <div className="drawer-edit">
                  <textarea className="textarea" value={desc} onChange={(e) => setDesc(e.target.value)} aria-label="Issue description" />
                  <div className="row">
                    <button className="btn primary" onClick={() => saveDesc.mutate()}>Save</button>
                    <button className="btn-ghost" onClick={() => setEditingDesc(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>

            <div className="drawer-section">
              <div className="field-label">Status</div>
              <div className="status-control">
                <span className="dot" style={{ background: current?.color ?? "#64748B" }} aria-hidden="true" />
                <select
                  className="select"
                  value={issue.columnId}
                  onChange={(e) => moveTo(e.target.value)}
                  aria-label="Move issue to column"
                >
                  {columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}
                </select>
              </div>
            </div>

            <div className="drawer-section">
              <div className="field-label">Color</div>
              <ColorPicker value={issue.color} allowNone label="Issue color" onChange={setColor} />
            </div>

            <div className="drawer-section">
              <div className="field-label">Comments ({detail.data?.comments.length ?? 0})</div>
              {(detail.data?.comments ?? []).map((item) => (
                <div key={item.id} className="comment">
                  {editingComment === item.id ? (
                    <div className="row">
                      <input className="input" value={editContent} onChange={(e) => setEditContent(e.target.value)} aria-label="Edit comment" />
                      <button className="btn primary" disabled={!editContent.trim()} onClick={async () => {
                        await api.updateComment(item.id, editContent.trim());
                        setEditingComment(null);
                        refresh();
                      }}>Save</button>
                    </div>
                  ) : (
                    <>
                      <div className="comment-body">{item.content}</div>
                      <div className="comment-meta">
                        <span>{new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                        <div className="menu-wrap">
                          <button className="icon-btn" style={{ width: 22, height: 22 }} aria-label="Comment actions"
                            aria-haspopup="menu" aria-expanded={commentMenu === item.id}
                            onClick={() => setCommentMenu(commentMenu === item.id ? null : item.id)}>
                            ⋯
                          </button>
                          {commentMenu === item.id && (
                            <div className="menu" role="menu">
                              <button className="menu-item" role="menuitem" onClick={() => {
                                setCommentMenu(null);
                                setEditingComment(item.id);
                                setEditContent(item.content);
                              }}>Edit</button>
                              <button className="menu-item danger" role="menuitem" onClick={async () => {
                                setCommentMenu(null);
                                await api.deleteComment(item.id);
                                refresh();
                              }}>Delete</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
              <div className="row" style={{ marginTop: 8 }}>
                <input
                  className="input" placeholder="Add a comment…" value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && comment.trim()) addComment.mutate(); }}
                  aria-label="Add a comment"
                />
                <button className="btn primary" disabled={!comment.trim()} onClick={() => addComment.mutate()}>Add</button>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
