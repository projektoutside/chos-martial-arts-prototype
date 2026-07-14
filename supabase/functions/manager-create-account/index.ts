import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const allowedRoles = new Set(["staff", "student", "guardian"]);
const allowedStatuses = new Set(["active", "inactive"]);
const allowedAccess = new Set([
  "dashboard",
  "messages",
  "students",
  "classes",
  "studyGuide",
  "events",
  "scheduling",
  "merchandise",
  "videos",
  "reports"
]);

type AccountRequest = {
  displayName?: unknown;
  username?: unknown;
  role?: unknown;
  status?: unknown;
  email?: unknown;
  phone?: unknown;
  title?: unknown;
  notes?: unknown;
  access?: unknown;
  studentId?: unknown;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUsername(value: unknown) {
  return cleanString(value)
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/^[._-]+|[._-]+$/g, "");
}

function normalizeAccess(value: unknown, role: string) {
  if (role !== "staff" || !Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && allowedAccess.has(item)))];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const inviteRedirectUrl = Deno.env.get("INVITE_REDIRECT_URL") ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !inviteRedirectUrl) {
    return jsonResponse({ error: "Supabase function secrets are not configured." }, 500);
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return jsonResponse({ error: "Missing manager session." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return jsonResponse({ error: "Invalid manager session." }, 401);

  const { data: callerProfile, error: callerProfileError } = await userClient
    .from("profiles")
    .select("id, username, role, status, is_owner")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (
    callerProfileError ||
    !callerProfile ||
    callerProfile.role !== "staff" ||
    callerProfile.status !== "active" ||
    callerProfile.is_owner !== true
  ) {
    return jsonResponse({ error: "Only an active Developer or Manager owner account can manage accounts." }, 403);
  }

  let body: AccountRequest;
  try {
    body = await req.json() as AccountRequest;
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const username = normalizeUsername(body.username);
  const displayName = cleanString(body.displayName);
  const role = allowedRoles.has(cleanString(body.role)) ? cleanString(body.role) : "";
  const status = allowedStatuses.has(cleanString(body.status)) ? cleanString(body.status) : "active";
  const contactEmail = cleanString(body.email).toLowerCase();
  const phone = cleanString(body.phone) || null;
  const title = cleanString(body.title) || null;
  const notes = cleanString(body.notes) || null;
  const studentId = cleanString(body.studentId) || null;
  const access = normalizeAccess(body.access, role);
  const authEmail = contactEmail;

  if (!username || username.length < 3 || !displayName || !contactEmail || !role) {
    return jsonResponse({ error: "Display name, username, email, and role are required." }, 400);
  }
  if (username === "manager123" || username === "manager1" || username === "dev123" || username.endsWith(".child")) {
    return jsonResponse({ error: "That username is reserved." }, 400);
  }
  if (role === "student" && !studentId) {
    return jsonResponse({ error: "Student accounts require a linked student id." }, 400);
  }

  const { data: existingProfile, error: existingProfileError } = await adminClient
    .from("profiles")
    .select("id")
    .or(`username.eq.${username},auth_email.eq.${authEmail}`)
    .maybeSingle();

  if (existingProfileError) return jsonResponse({ error: "Could not check existing profiles." }, 500);
  if (existingProfile) return jsonResponse({ error: "An account with that username already exists." }, 409);

  const { data: createdUser, error: createUserError } = await adminClient.auth.admin.inviteUserByEmail(
    authEmail,
    {
      redirectTo: inviteRedirectUrl,
      data: {
        username,
        role,
        display_name: displayName,
        contact_email: contactEmail
      }
    }
  );

  if (createUserError || !createdUser.user) {
    return jsonResponse({ error: createUserError?.message ?? "Could not send the account invitation." }, 400);
  }

  const profileRow = {
    id: createdUser.user.id,
    username,
    auth_email: authEmail,
    contact_email: contactEmail,
    display_name: displayName,
    role,
    status,
    is_owner: false,
    welcome_seen_at: null,
    invitation_status: "pending",
    invited_at: new Date().toISOString(),
    invitation_accepted_at: null,
    phone,
    title,
    notes,
    access,
    student_id: studentId,
    created_by: authData.user.id
  };

  const { error: profileError } = await adminClient.from("profiles").insert(profileRow);
  if (profileError) {
    const { error: rollbackError } = await adminClient.auth.admin.deleteUser(createdUser.user.id);
    if (rollbackError) {
      return jsonResponse({
        error: "Profile creation failed and the incomplete invitation could not be removed. Contact an administrator."
      }, 500);
    }
    return jsonResponse({ error: profileError.message }, 400);
  }

  const { error: auditError } = await adminClient.from("account_creation_audit").insert({
    created_by: authData.user.id,
    created_user_id: createdUser.user.id,
    created_username: username,
    created_auth_email: authEmail,
    created_contact_email: contactEmail,
    created_role: role,
    request_ip: req.headers.get("x-forwarded-for"),
    user_agent: req.headers.get("user-agent")
  });

  if (auditError) {
    const { error: rollbackError } = await adminClient.auth.admin.deleteUser(createdUser.user.id);
    if (rollbackError) {
      return jsonResponse({
        error: "Account audit failed and the incomplete account could not be removed. Contact an administrator."
      }, 500);
    }
    return jsonResponse({ error: "Could not record account creation. No account was created." }, 500);
  }

  return jsonResponse({
    email: authEmail,
    invited: true,
    invitationStatus: "pending",
    account: {
      id: createdUser.user.id,
      username,
      role,
      status,
      invitationStatus: "pending"
    }
  });
});
