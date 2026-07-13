import { useEffect, useRef } from "react";
import type { SupabaseProfileOnboarding } from "./supabaseAccounts";

export function FirstLoginWelcomeDialog({
  profile,
  pending,
  error,
  onAcknowledge
}: {
  profile: SupabaseProfileOnboarding;
  pending: boolean;
  error: string;
  onAcknowledge: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const roleLabel = profile.role === "guardian" ? "parent or guardian" : profile.role;
  return (
    <div className="modal-backdrop first-login-welcome-backdrop" role="presentation">
      <section
        className="modal-card first-login-welcome-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-login-welcome-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <p className="first-login-welcome-eyebrow">Your account is ready</p>
        <h2 id="first-login-welcome-title">Welcome to Cho&apos;s Martial Arts</h2>
        <p className="first-login-welcome-name">Welcome, {profile.displayName}!</p>
        <p>You&apos;re signed in as a {roleLabel}. Your Cho&apos;s administrator can update your access whenever needed.</p>
        {error ? <p className="first-login-welcome-error" role="alert">{error}</p> : null}
        <button type="button" className="primary-button" disabled={pending} onClick={onAcknowledge}>
          {pending ? "Saving welcome" : error ? "Try Again" : "Enter Cho's App"}
        </button>
      </section>
    </div>
  );
}
