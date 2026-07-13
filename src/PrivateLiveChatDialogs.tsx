import { Search, Trash2, UserPlus, Users, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { PrivateChatInvitee, PrivateChatRoom } from "./supabasePrivateLiveChat";

function roleLabel(role: PrivateChatInvitee["role"]) {
  return role === "staff" ? "Staff" : role === "student" ? "Student" : "Parent / Guardian";
}

function PersonPicker({ invitees, selectedIds, onToggle }: { invitees: PrivateChatInvitee[]; selectedIds: Set<string>; onToggle: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const visibleInvitees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? invitees.filter((person) => `${person.displayName} ${roleLabel(person.role)}`.toLowerCase().includes(query)) : invitees;
  }, [invitees, search]);
  return (
    <section className="live-chat-room-invite-panel" aria-label="Invite people">
      <label className="private-chat-search-field">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">Search people</span>
        <input type="search" aria-label="Search people" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search names or roles" />
      </label>
      <div className="live-chat-room-invite-list">
        {visibleInvitees.map((person) => (
          <label className={`live-chat-room-invite-option${selectedIds.has(person.id) ? " is-selected" : ""}`} key={person.id}>
            <input type="checkbox" aria-label={`Invite ${person.displayName}`} checked={selectedIds.has(person.id)} onChange={() => onToggle(person.id)} />
            <span className="private-chat-person-avatar" aria-hidden="true">{person.displayName.slice(0, 1).toUpperCase()}</span>
            <span><strong>{person.displayName}</strong><small>{roleLabel(person.role)}</small></span>
          </label>
        ))}
        {!visibleInvitees.length && <p className="private-chat-empty-picker">No active accounts match that search.</p>}
      </div>
    </section>
  );
}

function DialogShell({ label, eyebrow, title, onClose, children }: { label: string; eyebrow: string; title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return (
    <div className="manager-compose-backdrop live-chat-create-room-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="manager-compose-modal live-chat-create-room-modal" role="dialog" aria-modal="true" aria-label={label}>
        <header className="manager-compose-head">
          <div><p>{eyebrow}</p><h2>{title}</h2></div>
          <button className="manager-compose-close" type="button" aria-label={`Close ${label.toLowerCase()}`} onClick={onClose}><X size={20} /></button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function CreatePrivateRoomDialog({ open, invitees, isLoadingInvitees, error, onClose, onCreate }: {
  open: boolean; invitees: PrivateChatInvitee[]; isLoadingInvitees: boolean; error: string; onClose: () => void;
  onCreate: (input: { name: string; memberIds: string[] }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  useEffect(() => { if (open) { setName(""); setSelectedIds(new Set()); setPending(false); } }, [open]);
  if (!open) return null;
  const toggle = (id: string) => setSelectedIds((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !selectedIds.size || pending) return;
    setPending(true);
    try { await onCreate({ name: name.trim(), memberIds: [...selectedIds] }); } finally { setPending(false); }
  };
  return (
    <DialogShell label="Create chat room" eyebrow="Private Live Chat" title="Create Room" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="live-chat-create-room-layout">
          <section className="live-chat-create-room-settings" aria-label="Room settings">
            <label className="manager-compose-field"><span>Room name</span><input autoFocus required aria-label="Room name" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Leadership Team" /></label>
            <p className="private-chat-dialog-help"><UserPlus size={16} /> Choose at least one active Cho's account. You can change members later.</p>
          </section>
          {isLoadingInvitees ? <p>Loading active accounts...</p> : <PersonPicker invitees={invitees} selectedIds={selectedIds} onToggle={toggle} />}
        </div>
        {error && <p className="live-chat-error" role="alert">{error}</p>}
        <footer className="manager-compose-actions"><button type="button" className="manager-compose-cancel" onClick={onClose}>Cancel</button><button type="submit" className="manager-compose-submit" disabled={pending || !name.trim() || !selectedIds.size}>{pending ? "Creating..." : "Create Room"}</button></footer>
      </form>
    </DialogShell>
  );
}

export function ManagePrivateRoomDialog({ open, room, currentProfileId, invitees, error, onClose, onUpdate, onDelete, onLeave }: {
  open: boolean; room: PrivateChatRoom; currentProfileId: string; invitees: PrivateChatInvitee[]; error: string; onClose: () => void;
  onUpdate: (input: { name: string; memberIds: string[] }) => Promise<void>; onDelete: () => Promise<void>; onLeave: () => Promise<void>;
}) {
  const isCreator = room.creatorId === currentProfileId;
  const [name, setName] = useState(room.name);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(room.members.filter((member) => member.profileId !== room.creatorId).map((member) => member.profileId)));
  const [pending, setPending] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"delete" | "leave" | null>(null);
  useEffect(() => {
    setName(room.name);
    setSelectedIds(new Set(room.members.filter((member) => member.profileId !== room.creatorId).map((member) => member.profileId)));
    setConfirmAction(null);
  }, [room]);
  if (!open) return null;
  const toggle = (id: string) => setSelectedIds((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const act = async (action: () => Promise<void>) => { setPending(true); try { await action(); } finally { setPending(false); } };
  return (
    <DialogShell label="Manage private room" eyebrow="Private Live Chat" title={room.name} onClose={onClose}>
      {isCreator ? (
        <form onSubmit={(event) => { event.preventDefault(); void act(() => onUpdate({ name: name.trim(), memberIds: [...selectedIds] })); }}>
          <div className="live-chat-create-room-layout">
            <section className="live-chat-create-room-settings"><label className="manager-compose-field"><span>Room name</span><input aria-label="Room name" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label><p className="private-chat-dialog-help"><Users size={16} /> Only you can manage this room.</p></section>
            <PersonPicker invitees={invitees} selectedIds={selectedIds} onToggle={toggle} />
          </div>
          {error && <p className="live-chat-error" role="alert">{error}</p>}
          {confirmAction === "delete" && <p className="private-chat-confirmation" role="alert">Delete this room and all of its messages for everyone?</p>}
          <footer className="manager-compose-actions private-chat-manage-actions">
            <button type="button" className="private-chat-danger-button" disabled={pending} onClick={() => confirmAction === "delete" ? void act(onDelete) : setConfirmAction("delete")}><Trash2 size={16} />{confirmAction === "delete" ? "Confirm Delete" : "Delete Room"}</button>
            <button type="submit" className="manager-compose-submit" disabled={pending || !name.trim() || !selectedIds.size}>Save Changes</button>
          </footer>
        </form>
      ) : (
        <section className="private-chat-member-view"><p>This private room has {room.members.length} members. Only its creator can edit membership.</p>{error && <p className="live-chat-error" role="alert">{error}</p>}{confirmAction === "leave" && <p className="private-chat-confirmation" role="alert">Leave this room and lose access to its message history?</p>}<footer className="manager-compose-actions"><button type="button" className="private-chat-danger-button" disabled={pending} onClick={() => confirmAction === "leave" ? void act(onLeave) : setConfirmAction("leave")}>{confirmAction === "leave" ? "Confirm Leave" : "Leave Room"}</button></footer></section>
      )}
    </DialogShell>
  );
}
